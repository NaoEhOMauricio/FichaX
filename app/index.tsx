import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, Animated, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

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
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onboardingPending, setOnboardingPending] = useState(false);
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
      setOnboardingPending(!!session && !session.user.user_metadata?.onboarding_complete);
      if (session) fetchRecipes();
    };
    checkAndFetch();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setOnboardingPending(!!session && !session?.user.user_metadata?.onboarding_complete);
      if (session) fetchRecipes();
      else setRecipes([]);
    });

    // Nome único por montagem evita conflito no StrictMode do React
    const channelId = `recipes-changes-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
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

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #1e293b;
      line-height: 1.5;
    }
    .page { max-width: 680px; margin: 0 auto; padding: 40px 48px; }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 20px;
      border-bottom: 3px solid #6366f1;
      margin-bottom: 28px;
    }
    .brand-name { font-size: 26px; font-weight: 900; color: #007AFF; letter-spacing: -1px; line-height: 1; }
    .brand-name span { color: #FF9500; }
    .brand-sub { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px; }
    .header-right { text-align: right; }
    .header-date { font-size: 11px; color: #64748b; }
    .header-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }

    /* ── Título da receita ── */
    .recipe-header { margin-bottom: 24px; }
    .recipe-name { font-size: 26px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
    .recipe-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .badge {
      display: inline-block; padding: 3px 12px; border-radius: 20px;
      font-size: 11px; font-weight: 700;
    }
    .badge-category { background: #eef2ff; color: #6366f1; }

    /* ── Seção título ── */
    .section { margin-bottom: 24px; }
    .section-title {
      font-size: 11px; font-weight: 700; color: #64748b;
      text-transform: uppercase; letter-spacing: 1px;
      margin-bottom: 10px;
      display: flex; align-items: center; gap: 8px;
    }
    .section-title::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }

    /* ── Tabela ingredientes ── */
    .ing-table { width: 100%; border-collapse: collapse; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
    .ing-table thead tr { background: #6366f1; }
    .ing-table th { padding: 9px 14px; text-align: left; font-size: 11px; font-weight: 700; color: white; text-transform: uppercase; letter-spacing: 0.5px; }
    .ing-table th:last-child { text-align: right; }
    .ing-table td { padding: 9px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .ing-table tbody tr:last-child td { border-bottom: none; }
    .ing-table tbody tr:nth-child(even) td { background: #f8fafc; }
    .td-cost { text-align: right; font-weight: 600; color: #6366f1; }
    .type-pill {
      display: inline-block; padding: 1px 5px; border-radius: 3px;
      font-size: 8px; font-weight: 800; color: white; margin-right: 5px; vertical-align: middle;
    }
    .pill-ing { background: #22c55e; }
    .pill-rec { background: #f59e0b; }

    /* ── Cards financeiros ── */
    .finance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .finance-card {
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 10px; padding: 14px 16px;
    }
    .finance-card.accent { background: #eef2ff; border-color: #c7d2fe; }
    .finance-card.green  { background: #f0fdf4; border-color: #bbf7d0; }
    .fc-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .fc-value { font-size: 20px; font-weight: 800; color: #0f172a; }
    .finance-card.accent .fc-value { color: #6366f1; }
    .finance-card.green  .fc-value { color: #16a34a; }
    .fc-sub { font-size: 11px; color: #94a3b8; margin-top: 3px; }

    /* ── Porções ── */
    .portion-table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .portion-table td { padding: 9px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .portion-table tr:last-child td { border-bottom: none; }
    .portion-table tbody tr:nth-child(even) td { background: #f8fafc; }
    .pt-label { color: #64748b; }
    .pt-value { text-align: right; font-weight: 700; color: #0f172a; }

    /* ── Modo de preparo ── */
    .instructions-box {
      background: #fffbeb; border: 1px solid #fcd34d;
      border-left: 4px solid #f59e0b; border-radius: 10px; padding: 16px;
    }
    .instructions-text { font-size: 13px; color: #78350f; line-height: 1.75; white-space: pre-wrap; }

    /* ── Footer ── */
    .footer {
      margin-top: 36px; padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center;
    }
    .footer-brand { font-size: 15px; font-weight: 900; color: #007AFF; }
    .footer-brand span { color: #FF9500; }
    .footer-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }
    .footer-url { font-size: 10px; color: #94a3b8; text-align: right; }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { padding: 24px 36px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand-name">Ficha<span>X</span></div>
      <div class="brand-sub">Gestão de Fichas Técnicas</div>
    </div>
    <div class="header-right">
      <div class="header-label">Gerado em</div>
      <div class="header-date">${now}</div>
    </div>
  </div>

  <!-- Título da receita -->
  <div class="recipe-header">
    <div class="recipe-name">${recipe.name}</div>
    <div class="recipe-meta">
      ${recipe.category ? `<span class="badge badge-category">${recipe.category}</span>` : ''}
    </div>
  </div>

  <!-- Composição -->
  <div class="section">
    <div class="section-title">Composição</div>
    <table class="ing-table">
      <thead>
        <tr>
          <th>Ingrediente</th>
          <th style="text-align:center">Qtd</th>
          <th style="text-align:center">Unidade</th>
          <th style="text-align:right">Custo</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>
              <span class="type-pill ${item.type === 'ingredient' ? 'pill-ing' : 'pill-rec'}">${item.type === 'ingredient' ? 'ING' : 'REC'}</span>
              ${item.name}
            </td>
            <td style="text-align:center">${item.amount}</td>
            <td style="text-align:center">${item.unit}</td>
            <td class="td-cost">${formatCurrency(item.cost)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- Resumo financeiro -->
  ${calcs.hasPricing ? `
  <div class="section">
    <div class="section-title">Resumo Financeiro</div>
    <div class="finance-grid">
      <div class="finance-card">
        <div class="fc-label">Custo Total</div>
        <div class="fc-value">${formatCurrency(calcs.totalCost)}</div>
        <div class="fc-sub">Soma dos ingredientes</div>
      </div>
      <div class="finance-card">
        <div class="fc-label">Markup</div>
        <div class="fc-value">${calcs.markup.toFixed(0)}%</div>
        <div class="fc-sub">Sobre o custo</div>
      </div>
      <div class="finance-card accent">
        <div class="fc-label">Preço de Venda</div>
        <div class="fc-value">${formatCurrency(calcs.sellingPrice)}</div>
        <div class="fc-sub">Com markup aplicado</div>
      </div>
      <div class="finance-card green">
        <div class="fc-label">Lucro Bruto</div>
        <div class="fc-value">${formatCurrency(calcs.profit)}</div>
        <div class="fc-sub">Margem: ${calcs.profitMargin.toFixed(1)}%</div>
      </div>
    </div>
  </div>
  ` : `
  <div class="section">
    <div class="section-title">Custo da Receita</div>
    <div class="finance-grid">
      <div class="finance-card accent">
        <div class="fc-label">Custo Total</div>
        <div class="fc-value">${formatCurrency(calcs.totalCost)}</div>
        <div class="fc-sub">Soma dos ingredientes</div>
      </div>
    </div>
  </div>
  `}

  <!-- Porções -->
  ${portionData ? `
  <div class="section">
    <div class="section-title">Porções</div>
    <table class="portion-table">
      <tbody>
        <tr><td class="pt-label">Peso da porção</td><td class="pt-value">${recipe.portion_weight} ${recipe.portion_weight_unit || 'g'}</td></tr>
        <tr><td class="pt-label">Rende</td><td class="pt-value">${portionData.numPortions % 1 === 0 ? portionData.numPortions.toFixed(0) : portionData.numPortions.toFixed(1)} porções</td></tr>
        <tr><td class="pt-label">Custo por porção</td><td class="pt-value" style="color:#16a34a">${formatCurrency(portionData.costPerPortion)}</td></tr>
      </tbody>
    </table>
  </div>
  ` : recipe.total_weight && recipe.total_weight > 0 ? `
  <div class="section">
    <div class="section-title">Rendimento</div>
    <table class="portion-table">
      <tbody>
        <tr><td class="pt-label">Peso do prato (após preparo)</td><td class="pt-value">${recipe.total_weight} ${recipe.total_weight_unit || 'g'}</td></tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- Modo de preparo -->
  ${recipe.instructions ? `
  <div class="section">
    <div class="section-title">Modo de Preparo</div>
    <div class="instructions-box">
      <div class="instructions-text">${recipe.instructions}</div>
    </div>
  </div>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    <div>
      <div class="footer-brand">Ficha<span>X</span></div>
      <div class="footer-sub">fichax.netlify.app</div>
    </div>
    <div class="footer-url">Gerado automaticamente</div>
  </div>

</div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      Alert.alert('Erro', 'Permita pop-ups para gerar o PDF.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 600);
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Cardápio</Text>
            <Text style={styles.headerSubtitle}>Visão geral das suas receitas</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.7}>
            <Ionicons name={refreshing ? 'sync' : 'refresh-outline'} size={18} color="#6366f1" />
            <Text style={styles.refreshBtnText}>Atualizar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner onboarding pendente */}
      {isAuthenticated && onboardingPending && (
        <TouchableOpacity style={styles.onboardingBanner} onPress={() => router.push('/auth')} activeOpacity={0.85}>
          <Ionicons name="alert-circle" size={18} color="#f59e0b" />
          <Text style={styles.onboardingBannerText}>
            Complete seu cadastro — adicione nome, telefone, CPF e endereço.
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#f59e0b" />
        </TouchableOpacity>
      )}

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
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
  },
  section: {
    paddingHorizontal: 28,
    paddingBottom: 0,
    paddingTop: 20,
  },
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  onboardingBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
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
    paddingHorizontal: 28,
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
    paddingHorizontal: 28,
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