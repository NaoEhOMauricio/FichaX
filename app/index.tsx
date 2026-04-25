import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, Image, Animated, RefreshControl, Alert } from 'react-native';
import BrandLogo from '../components/BrandLogo';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Coloque seu logo em assets/logo.png
let logoImage: any = null;
try { logoImage = require('../assets/logo.png'); } catch (e) { logoImage = null; }

interface RecipeItem {
  id: number;
  name: string;
  amount: number;
  unit: string;
  cost: number;
  type: 'ingredient' | 'recipe';
}

interface Recipe {
  id: number;
  name: string;
  ingredients: RecipeItem[];
  instructions?: string;
  markup_percent?: number;
  category?: string;
  total_weight?: number;
  total_weight_unit?: string;
  portion_weight?: number;
  portion_weight_unit?: string;
}

const formatCurrency = (value: number): string => {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
};

const convertToBase = (value: number, unit: string): number => {
  switch (unit) {
    case 'kg': case 'L': return value * 1000;
    case 'g': case 'ml': default: return value;
  }
};

const getPortionInfo = (recipe: Recipe, totalCost: number) => {
  if (!recipe.portion_weight || recipe.portion_weight <= 0) return null;
  const portionInBase = convertToBase(recipe.portion_weight, recipe.portion_weight_unit || 'g');
  if (portionInBase <= 0) return null;
  // Peso efetivo: total_weight se existir, senão soma dos ingredientes
  const rawWeight = (recipe.ingredients || []).reduce((sum, item) => {
    const u = (item.unit || 'g').toLowerCase();
    if (['g','kg','ml','l'].includes(u)) return sum + convertToBase(item.amount, item.unit);
    return sum;
  }, 0);
  const effectiveWeight = recipe.total_weight && recipe.total_weight > 0
    ? convertToBase(recipe.total_weight, recipe.total_weight_unit || 'g')
    : rawWeight;
  // Se não tem peso efetivo, assume 1 porção = custo total
  const numPortions = effectiveWeight > 0 ? effectiveWeight / portionInBase : 1;
  const costPerPortion = totalCost / numPortions;
  return { numPortions, costPerPortion };
};

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showUpdateToast = () => {
    setShowToast(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setShowToast(false));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecipes();
    setRefreshing(false);
    showUpdateToast();
  };

  useEffect(() => {
    const checkAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      if (session) fetchRecipes();
    };
    checkAndFetch();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      if (session) fetchRecipes();
      else setRecipes([]);
    });

    // Auto-refresh quando receitas mudam no banco
    const channel = supabase
      .channel('recipes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, () => {
        fetchRecipes();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRecipes = async () => {
    const { data } = await supabase.from('recipes').select('*');
    setRecipes((data || []).sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR')));
  };

  const categories = ['Todos', ...Array.from(new Set(recipes.map(r => r.category || 'Sem categoria').filter(Boolean)))];

  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = searchText.length === 0 || r.name.toLowerCase().includes(searchText.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || (r.category || 'Sem categoria') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openRecipeDetail = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowDetail(true);
  };

  const getRecipeCalcs = (recipe: Recipe) => {
    const totalCost = (recipe.ingredients || []).reduce((sum, item) => sum + (item.cost || 0), 0);
    const hasPricing = recipe.markup_percent != null && recipe.markup_percent > 0;
    const markup = hasPricing ? recipe.markup_percent! : 0;
    const sellingPrice = hasPricing ? totalCost * (1 + markup / 100) : totalCost;
    const profit = sellingPrice - totalCost;
    const profitMargin = sellingPrice > 0 ? ((sellingPrice - totalCost) / sellingPrice) * 100 : 0;
    return { totalCost, markup, sellingPrice, profit, profitMargin, hasPricing };
  };

  const generatePDF = async (recipe: Recipe) => {
    const calcs = getRecipeCalcs(recipe);
    const items = (recipe.ingredients || []);
    const now = new Date().toLocaleDateString('pt-BR');
    const portionData = getPortionInfo(recipe, calcs.totalCost);

    const html = `
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Helvetica', sans-serif; padding: 30px; color: #333; }
          .brand-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #007AFF; padding-bottom: 14px; margin-bottom: 20px; }
          .brand-logo { font-size: 32px; font-weight: 900; color: #007AFF; letter-spacing: -1px; }
          .brand-logo span { color: #FF9500; }
          .brand-tagline { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 2px; }
          h1 { color: #007AFF; font-size: 28px; margin-bottom: 4px; margin-top: 0; }
          .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
          .category { display: inline-block; background: #E3F2FD; color: #007AFF; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th { background: #007AFF; color: white; text-align: left; padding: 10px 12px; font-size: 13px; }
          td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
          tr:nth-child(even) { background: #f9f9f9; }
          .totals { margin-top: 20px; background: #f5f5f5; border-radius: 10px; padding: 16px; }
          .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
          .total-label { color: #666; }
          .total-value { font-weight: bold; }
          .highlight { color: #007AFF; font-size: 18px; font-weight: bold; }
          .profit { color: #4CAF50; }
          .instructions { margin-top: 20px; padding: 16px; background: #FFF8E1; border-radius: 10px; border-left: 4px solid #FFC107; }
          .instructions h3 { margin: 0 0 8px; color: #F57C00; }
          .instructions p { font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
          .footer { margin-top: 40px; text-align: center; padding-top: 16px; border-top: 2px solid #E8E8E8; }
          .footer-brand { font-size: 16px; font-weight: 900; color: #007AFF; letter-spacing: -0.5px; }
          .footer-brand span { color: #FF9500; }
          .footer-sub { font-size: 10px; color: #bbb; margin-top: 4px; }
          .watermark { position: fixed; bottom: 10px; right: 20px; font-size: 9px; color: #ddd; }
        </style>
      </head>
      <body>
        <div class="brand-header">
          <div>
            <div class="brand-logo">Ficha<span>X</span></div>
            <div class="brand-tagline">Gestão de Custos Gastronômicos</div>
          </div>
        </div>

        <h1>${recipe.name}</h1>
        ${recipe.category ? `<span class="category">${recipe.category}</span>` : ''}
        <p class="subtitle">Ficha técnica gerada em ${now}</p>

        <table>
          <tr>
            <th>Ingrediente</th>
            <th>Qtd</th>
            <th>Unidade</th>
            <th style="text-align:right">Custo</th>
          </tr>
          ${items.map(item => `
            <tr>
              <td>${item.type === 'recipe' ? '🍽️ ' : ''}${item.name}</td>
              <td>${item.amount}</td>
              <td>${item.unit}</td>
              <td style="text-align:right">${formatCurrency(item.cost)}</td>
            </tr>
          `).join('')}
        </table>

        <div class="totals">
          <div class="total-row">
            <span class="total-label">Custo total</span>
            <span class="total-value">${formatCurrency(calcs.totalCost)}</span>
          </div>
          ${calcs.hasPricing ? `
          <div class="total-row">
            <span class="total-label">Markup</span>
            <span class="total-value">${calcs.markup}%</span>
          </div>
          <div class="total-row">
            <span class="total-label">Preço de venda</span>
            <span class="highlight">${formatCurrency(calcs.sellingPrice)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Lucro</span>
            <span class="total-value profit">${formatCurrency(calcs.profit)} (${calcs.profitMargin.toFixed(1)}%)</span>
          </div>
          ` : ''}
        </div>

        ${portionData ? `
          <div class="totals" style="margin-top:16px">
            <div class="total-row">
              <span class="total-label">🍽️ Peso da porção</span>
              <span class="highlight">${recipe.portion_weight} ${recipe.portion_weight_unit || 'g'}</span>
            </div>
            <div class="total-row">
              <span class="total-label">Rende</span>
              <span class="total-value">${portionData.numPortions % 1 === 0 ? portionData.numPortions.toFixed(0) : portionData.numPortions.toFixed(1)} porções</span>
            </div>
            <div class="total-row">
              <span class="total-label">Custo por porção</span>
              <span class="highlight" style="color:#4CAF50">${formatCurrency(portionData.costPerPortion)}</span>
            </div>
          </div>
        ` : recipe.total_weight && recipe.total_weight > 0 ? `
          <div class="totals" style="margin-top:16px">
            <div class="total-row">
              <span class="total-label">⚖️ Peso do Prato (após preparo)</span>
              <span class="highlight">${recipe.total_weight} ${recipe.total_weight_unit || 'g'}</span>
            </div>
          </div>
        ` : ''}

        ${recipe.instructions ? `
          <div class="instructions">
            <h3>Modo de preparo</h3>
            <p>${recipe.instructions}</p>
          </div>
        ` : ''}

        <div class="footer">
          <div class="footer-brand">Ficha<span>X</span></div>
          <div class="footer-sub">Documento gerado automaticamente pelo aplicativo FichaX — fichatecnica.app</div>
        </div>
        <div class="watermark">Gerado por FichaX</div>
      </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Ficha - ${recipe.name}` });
      } else {
        Alert.alert('PDF gerado', 'O PDF foi criado mas o compartilhamento não está disponível neste dispositivo.');
      }
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível gerar o PDF: ' + e.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {logoImage ? (
            <Image source={logoImage} style={styles.headerLogo} resizeMode="contain" />
          ) : (
            <View style={styles.headerLogoFallback}>
              <Text style={styles.headerLogoText}>FX</Text>
            </View>
          )}
          <View style={styles.headerTitleWrap}>
            <BrandLogo size={32} />
            <Text style={styles.headerSubtitle}>Gestão de Fichas Técnicas</Text>
          </View>
        </View>
      </View>

      {/* Navegação rápida */}
      <View style={styles.navRow}>
        <Link href="/auth" asChild>
          <TouchableOpacity style={styles.navCard} activeOpacity={0.7}>
            <View style={[styles.navIconWrap, { backgroundColor: '#1e293b' }]}>
              <Ionicons name="person" size={20} color="#6366f1" />
            </View>
            <Text style={styles.navText}>Conta</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/ingredients" asChild>
          <TouchableOpacity style={styles.navCard} activeOpacity={0.7}>
            <View style={[styles.navIconWrap, { backgroundColor: '#1e293b' }]}>
              <Ionicons name="leaf" size={20} color="#22c55e" />
            </View>
            <Text style={styles.navText}>Ingredientes</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/recipes" asChild>
          <TouchableOpacity style={styles.navCard} activeOpacity={0.7}>
            <View style={[styles.navIconWrap, { backgroundColor: '#1e293b' }]}>
              <Ionicons name="restaurant" size={20} color="#f59e0b" />
            </View>
            <Text style={styles.navText}>Receitas</Text>
          </TouchableOpacity>
        </Link>
      </View>

      {/* Cardápio */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📖 Cardápio</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6366f1" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar no cardápio..."
            placeholderTextColor="#94a3b8"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText !== '' && (
            <TouchableOpacity style={styles.clearButton} onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtro por categoria */}
        <TouchableOpacity
          style={[styles.filterButton, selectedCategory !== 'Todos' && styles.filterButtonActive]}
          onPress={() => setShowCategoryFilter(!showCategoryFilter)}
        >
          <Ionicons name="filter" size={18} color={selectedCategory !== 'Todos' ? 'white' : '#6366f1'} />
          <Text style={[styles.filterButtonText, selectedCategory !== 'Todos' && styles.filterButtonTextActive]}>
            {selectedCategory === 'Todos' ? 'Filtrar por categoria' : selectedCategory}
          </Text>
          <Ionicons
            name={showCategoryFilter ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={selectedCategory !== 'Todos' ? 'white' : '#6366f1'}
          />
          {selectedCategory !== 'Todos' && (
            <TouchableOpacity
              style={styles.filterClearBadge}
              onPress={(e) => { e.stopPropagation(); setSelectedCategory('Todos'); }}
            >
              <Ionicons name="close" size={14} color="white" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {showCategoryFilter && (
          <View style={styles.categoryDropdown}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryOption,
                  selectedCategory === cat && styles.categoryOptionActive,
                ]}
                onPress={() => {
                  setSelectedCategory(cat);
                  setShowCategoryFilter(false);
                }}
              >
                <Ionicons
                  name={cat === 'Todos' ? 'grid-outline' : 'pricetag-outline'}
                  size={16}
                  color={selectedCategory === cat ? 'white' : '#94a3b8'}
                />
                <Text style={[
                  styles.categoryOptionText,
                  selectedCategory === cat && styles.categoryOptionTextActive,
                ]}>
                  {cat}
                </Text>
                {selectedCategory === cat && (
                  <Ionicons name="checkmark-circle" size={18} color="white" style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Cabeçalho da tabela */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { flex: 1 }]}>PRATO</Text>
        <Text style={[styles.tableHeaderText, { width: 70, textAlign: 'center' }]}>ITENS</Text>
        <Text style={[styles.tableHeaderText, { width: 90, textAlign: 'right' }]}>PREÇO</Text>
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} tintColor="#6366f1" />
        }
      >
        {filteredRecipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={56} color="#334155" />
            <Text style={styles.emptyText}>
              {searchText ? 'Nenhum prato encontrado' : 'Nenhuma receita no cardápio'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchText ? 'Tente outro termo' : 'Crie receitas para vê-las aqui'}
            </Text>
          </View>
        ) : (
          filteredRecipes.map((recipe) => {
            const { totalCost, sellingPrice, hasPricing } = getRecipeCalcs(recipe);
            const portionInfo = getPortionInfo(recipe, totalCost);
            const itemCount = (recipe.ingredients || []).length;
            return (
              <TouchableOpacity
                key={recipe.id}
                style={styles.tableRow}
                onPress={() => openRecipeDetail(recipe)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.tableRowName}>{recipe.name}</Text>
                  {recipe.category ? (
                    <Text style={styles.tableRowCategory}>{recipe.category}</Text>
                  ) : null}
                </View>
                <Text style={styles.tableRowItems}>{itemCount}</Text>
                <View style={styles.tableRowPriceCol}>
                  {hasPricing ? (
                    <>
                      <Text style={styles.tableRowPrice}>{formatCurrency(sellingPrice)}</Text>
                      <Text style={styles.tableRowCost}>{formatCurrency(totalCost)}</Text>
                    </>
                  ) : portionInfo ? (
                    <>
                      <Text style={styles.tableRowPrice}>{formatCurrency(totalCost)}</Text>
                      <Text style={styles.tableRowCost}>Porção: {formatCurrency(portionInfo.costPerPortion)}</Text>
                    </>
                  ) : (
                    <Text style={styles.tableRowPrice}>{formatCurrency(totalCost)}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Toast de atualização */}
      {showToast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Ionicons name="checkmark-circle" size={18} color="white" />
          <Text style={styles.toastText}>Cardápio atualizado</Text>
        </Animated.View>
      )}

      {/* Modal Detalhes do Prato */}
      <Modal visible={showDetail} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowDetail(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>

            {selectedRecipe && (() => {
              const { totalCost, markup, sellingPrice, profit, profitMargin, hasPricing } = getRecipeCalcs(selectedRecipe);
              const portionInfo = getPortionInfo(selectedRecipe, totalCost);
              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.detailTitle}>{selectedRecipe.name}</Text>

                  {/* Itens */}
                  <Text style={styles.detailSectionTitle}>📋 Composição</Text>
                  {(selectedRecipe.ingredients || []).map((item, idx) => (
                    <View key={idx} style={styles.detailItem}>
                      <View style={[styles.detailBadge, item.type === 'ingredient' ? styles.badgeIng : styles.badgeRec]}>
                        <Text style={styles.detailBadgeText}>{item.type === 'ingredient' ? 'ING' : 'REC'}</Text>
                      </View>
                      <Text style={styles.detailItemName}>{item.name}</Text>
                      <Text style={styles.detailItemQty}>{item.amount} {item.unit}</Text>
                      <Text style={styles.detailItemCost}>{formatCurrency(item.cost)}</Text>
                    </View>
                  ))}

                  {/* Modo de preparo */}
                  {selectedRecipe.instructions ? (
                    <>
                      <Text style={styles.detailSectionTitle}>👨‍🍳 Modo de Preparo</Text>
                      <View style={styles.instructionsCard}>
                        <Text style={styles.instructionsText}>{selectedRecipe.instructions}</Text>
                      </View>
                    </>
                  ) : null}

                  {/* Porções */}
                  {portionInfo && (
                    <>
                      <Text style={styles.detailSectionTitle}>🍽️ Porções</Text>
                      <View style={styles.calcCard}>
                        <View style={styles.calcRow}>
                          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                            <Ionicons name="restaurant-outline" size={16} color="#FF9800" />
                            <Text style={styles.calcLabel}>Peso da porção</Text>
                          </View>
                          <Text style={[styles.calcValue, {color: '#FF9800', fontWeight: '700'}]}>
                            {selectedRecipe.portion_weight} {selectedRecipe.portion_weight_unit || 'g'}
                          </Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Rende</Text>
                          <Text style={[styles.calcValue, {color: '#FF9800', fontWeight: '700'}]}>
                            {portionInfo.numPortions % 1 === 0 ? portionInfo.numPortions.toFixed(0) : portionInfo.numPortions.toFixed(1)} porções
                          </Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Custo por porção</Text>
                          <Text style={[styles.calcValue, {color: '#4CAF50', fontWeight: '700'}]}>
                            {formatCurrency(portionInfo.costPerPortion)}
                          </Text>
                        </View>
                      </View>
                    </>
                  )}

                  {/* Peso do Prato (só quando não tem porção) */}
                  {!portionInfo && (() => {
                    const hasReady = selectedRecipe.total_weight && selectedRecipe.total_weight > 0;
                    if (!hasReady) return null;
                    return (
                      <>
                        <Text style={styles.detailSectionTitle}>⚖️ Peso do Prato</Text>
                        <View style={styles.calcCard}>
                          <View style={styles.calcRow}>
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                              <Ionicons name="scale-outline" size={16} color="#6366f1" />
                              <Text style={styles.calcLabel}>Peso do Prato (após preparo)</Text>
                            </View>
                            <Text style={[styles.calcValue, {color: '#6366f1', fontWeight: '700'}]}>
                              {selectedRecipe.total_weight} {selectedRecipe.total_weight_unit || 'g'}
                            </Text>
                          </View>
                        </View>
                      </>
                    );
                  })()}

                  {/* Cálculos */}
                  <Text style={styles.detailSectionTitle}>💰 {hasPricing ? 'Resumo Financeiro' : 'Custo da Receita'}</Text>
                  <View style={styles.calcCard}>
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Custo Total</Text>
                      <Text style={[styles.calcValueBig, !hasPricing && { color: '#6366f1' }]}>{formatCurrency(totalCost)}</Text>
                    </View>
                    {hasPricing && (
                      <>
                        <View style={styles.divider} />
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Markup</Text>
                          <Text style={styles.calcValue}>{markup.toFixed(0)}%</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Preço de Venda</Text>
                          <Text style={styles.calcValueBig}>{formatCurrency(sellingPrice)}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Lucro</Text>
                          <Text style={[styles.calcValue, { color: profit >= 0 ? '#4CAF50' : '#f44336' }]}>
                            {formatCurrency(profit)}
                          </Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Margem</Text>
                          <Text style={[styles.calcValue, { color: profitMargin >= 0 ? '#4CAF50' : '#f44336' }]}>
                            {profitMargin.toFixed(1)}%
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Botão PDF */}
                  <TouchableOpacity
                    style={styles.pdfButton}
                    onPress={() => generatePDF(selectedRecipe)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="document-text-outline" size={20} color="#fff" />
                    <Text style={styles.pdfButtonText}>Exportar PDF</Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    backgroundColor: '#0f172a',
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerLogo: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  headerLogoFallback: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(99,102,241,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogoText: {
    fontSize: 20,
    fontWeight: '900',
    color: 'white',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  navRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  navCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  navIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 0.2,
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  searchInput: {
    borderWidth: 1.5,
    borderColor: '#6366f1',
    padding: 13,
    paddingLeft: 40,
    paddingRight: 40,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    fontSize: 15,
    color: '#f1f5f9',
    flex: 1,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    padding: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    gap: 8,
  },
  filterButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  filterClearBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    padding: 2,
    marginLeft: 4,
  },
  categoryDropdown: {
    marginTop: 8,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  categoryOptionActive: {
    backgroundColor: '#6366f1',
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f1f5f9',
  },
  categoryOptionTextActive: {
    color: 'white',
    fontWeight: '600',
  },

  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
    marginTop: 10,
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tableRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  tableRowCategory: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  tableRowItems: {
    width: 70,
    textAlign: 'center',
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  tableRowPriceCol: {
    width: 90,
    alignItems: 'flex-end',
  },
  tableRowPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  tableRowCost: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  scrollContent: {
    flex: 1,
  },
  emptyState: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 20,
    borderWidth: 1.5,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },

  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  modalClose: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f1f5f9',
    marginTop: 16,
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  detailBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'white',
  },
  badgeIng: {
    backgroundColor: '#22c55e',
  },
  badgeRec: {
    backgroundColor: '#f59e0b',
  },
  detailItemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#f1f5f9',
  },
  detailItemQty: {
    fontSize: 12,
    color: '#94a3b8',
  },
  detailItemCost: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
    minWidth: 70,
    textAlign: 'right',
  },
  instructionsCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  instructionsText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 20,
  },
  calcCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  calcLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  calcValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  calcValueBig: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 2,
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#6366f1',
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 24,
    marginBottom: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  pdfButtonText: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  toast: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#22c55e',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});