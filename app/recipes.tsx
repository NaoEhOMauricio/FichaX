import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Modal, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';

// ── Sistema de unidades ──
type UnitCategory = 'peso' | 'volume' | 'unidade';

interface UnitDef {
  label: string;
  category: UnitCategory;
  toBase: number;
}

const UNITS: Record<string, UnitDef> = {
  g:      { label: 'g',      category: 'peso',     toBase: 1 },
  kg:     { label: 'kg',     category: 'peso',     toBase: 1000 },
  ml:     { label: 'ml',     category: 'volume',   toBase: 1 },
  L:      { label: 'L',      category: 'volume',   toBase: 1000 },
  'porção': { label: 'porção', category: 'peso', toBase: 1 },
  un:     { label: 'un',     category: 'unidade',  toBase: 1 },
};

const UNIT_GROUPS: { category: UnitCategory; label: string; icon: string; units: string[] }[] = [
  { category: 'peso',    label: 'Peso',    icon: 'scale-outline',  units: ['g', 'kg'] },
  { category: 'volume',  label: 'Volume',  icon: 'water-outline',  units: ['ml', 'L'] },
  { category: 'unidade', label: 'Unidade', icon: 'cube-outline',   units: ['un'] },
];

// Normaliza unidade para o formato do dict (case-insensitive)
const normalizeUnit = (unit: string): string => {
  if (!unit) return 'g';
  const lower = unit.toLowerCase();
  if (lower === 'l') return 'L';
  if (lower === 'ml') return 'ml';
  if (lower === 'kg') return 'kg';
  if (lower === 'g') return 'g';
  if (lower === 'porção' || lower === 'porcao') return 'porção';
  if (lower === 'un' || lower === 'unidade' || lower === 'unidades') return 'un';
  return unit;
};

const getUnitCategory = (unit: string): UnitCategory => UNITS[normalizeUnit(unit)]?.category || 'peso';

const getCompatibleUnits = (unit: string): string[] => {
  const cat = getUnitCategory(unit);
  return Object.keys(UNITS).filter(u => UNITS[u].category === cat && u !== 'porção');
};

const convertToBase = (value: number, unit: string): number => {
  return value * (UNITS[normalizeUnit(unit)]?.toBase || 1);
};

const getCategoryInfo = (cat: UnitCategory): { label: string; icon: string; color: string } => {
  switch (cat) {
    case 'peso':    return { label: 'Peso',    icon: 'scale-outline',  color: '#4CAF50' };
    case 'volume':  return { label: 'Volume',  icon: 'water-outline',  color: '#2196F3' };
    case 'unidade': return { label: 'Unidade', icon: 'cube-outline',   color: '#FF9800' };
  }
};

interface Ingredient {
  id: number;
  name: string;
  cost: number;
  package_weight: number;
  package_unit: string;
}

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

export default function Recipes() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipeName, setRecipeName] = useState('');
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [instructions, setInstructions] = useState('');
  const [markupPercent, setMarkupPercent] = useState('300');
  const [category, setCategory] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [totalWeightUnit, setTotalWeightUnit] = useState('g');
  const [portionWeight, setPortionWeight] = useState('');
  const [portionWeightUnit, setPortionWeightUnit] = useState('g');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [savedSearchText, setSavedSearchText] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editUnit, setEditUnit] = useState('g');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [showYieldSection, setShowYieldSection] = useState(false);
  const [showPortionSection, setShowPortionSection] = useState(false);
  const [showPricingSection, setShowPricingSection] = useState(false);
  // Modal cadastro rápido de ingrediente
  const [showNewIngredientModal, setShowNewIngredientModal] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [newIngCost, setNewIngCost] = useState('');
  const [newIngWeight, setNewIngWeight] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('kg');

  useEffect(() => {
    checkAuth();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchIngredients();
      fetchRecipes();
    }, [])
  );

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    if (!session) {
      Alert.alert('Atenção', 'Você precisa estar conectado para gerenciar receitas. Vá para a tela de login.');
    }
  };

  const fetchIngredients = async () => {
    const { data, error } = await supabase.from('ingredients').select('*');
    if (error) Alert.alert('Erro ao buscar ingredientes', error.message);
    else setIngredients((data || []).sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR')));
  };

  const fetchRecipes = async () => {
    const { data, error } = await supabase.from('recipes').select('*');
    if (error) Alert.alert('Erro ao buscar receitas', error.message);
    else setRecipes((data || []).sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR')));
  };

  // Busca unificada: ingredientes + receitas salvas
  const searchResults = searchText.length > 0
    ? [
        ...ingredients
          .filter(i => i.name.toLowerCase().includes(searchText.toLowerCase()))
          .map(i => ({ ...i, type: 'ingredient' as const })),
        ...recipes
          .filter(r => r.name.toLowerCase().includes(searchText.toLowerCase()))
          .map(r => ({ ...r, type: 'recipe' as const })),
      ]
    : [];

  const addIngredientToRecipe = (ingredient: Ingredient) => {
    // Usa a mesma unidade do pacote cadastrado (normalizada)
    const defaultUnit = normalizeUnit(ingredient.package_unit);
    setRecipeItems(prev => [
      ...prev,
      {
        id: ingredient.id,
        name: ingredient.name,
        amount: 0,
        unit: defaultUnit,
        cost: 0,
        type: 'ingredient',
      },
    ]);
    setSearchText('');
    setShowSearchResults(false);
  };

  const getRecipeEffectiveWeight = (recipe: Recipe): number => {
    if (recipe.total_weight && recipe.total_weight > 0) {
      return convertToBase(recipe.total_weight, recipe.total_weight_unit || 'g');
    }
    // Soma dos itens como fallback
    return (recipe.ingredients || []).reduce((sum, item) => {
      const cat = getUnitCategory(item.unit);
      if (item.amount > 0 && (cat === 'peso' || cat === 'volume') && item.unit !== 'porção') {
        return sum + convertToBase(item.amount, item.unit);
      }
      return sum;
    }, 0);
  };

  const getRecipePortionCost = (recipe: Recipe): number => {
    const recipeCost = (recipe.ingredients || []).reduce((sum: number, ri: RecipeItem) => sum + (ri.cost || 0), 0);
    if (recipe.portion_weight && recipe.portion_weight > 0) {
      const effectiveWeight = getRecipeEffectiveWeight(recipe);
      const portionInBase = convertToBase(recipe.portion_weight, recipe.portion_weight_unit || 'g');
      const numPortions = effectiveWeight > 0 && portionInBase > 0 ? effectiveWeight / portionInBase : 1;
      return recipeCost / numPortions;
    }
    return recipeCost; // sem porção definida = 1 porção = custo total
  };

  const addRecipeToRecipe = (recipe: Recipe) => {
    const costPerPortion = getRecipePortionCost(recipe);
    // Sempre adiciona como porção inicialmente — o modal permite trocar para peso
    setRecipeItems(prev => [
      ...prev,
      {
        id: recipe.id,
        name: recipe.name,
        amount: 1,
        unit: 'porção',
        cost: costPerPortion,
        type: 'recipe',
      },
    ]);
    setSearchText('');
    setShowSearchResults(false);
  };

  const updateItemAmount = (index: number, newAmount: string, newUnit?: string) => {
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount < 0) return;

    setRecipeItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      const unit = newUnit || item.unit;
      if (item.type === 'ingredient') {
        const ingredient = ingredients.find(i => i.id === item.id);
        if (ingredient) {
          // Converte tudo para unidade base para cálculo correto
          const packageInBase = convertToBase(ingredient.package_weight, ingredient.package_unit);
          const costPerBase = packageInBase > 0 ? ingredient.cost / packageInBase : 0;
          const amountInBase = convertToBase(amount, unit);
          updated[index] = { ...item, amount, unit, cost: costPerBase * amountInBase };
        }
      } else {
        const recipe = recipes.find(r => r.id === item.id);
        if (recipe) {
          const recipeCost = (recipe.ingredients || []).reduce((sum: number, ri: RecipeItem) => sum + (ri.cost || 0), 0);
          if (unit === 'porção') {
            // Modo porção: usa custo por porção
            const costPerPortion = getRecipePortionCost(recipe);
            updated[index] = { ...item, amount, unit, cost: costPerPortion * amount };
          } else {
            // Modo peso: calcula custo proporcional baseado no peso efetivo
            const effectiveWeight = getRecipeEffectiveWeight(recipe);
            const costPerBase = effectiveWeight > 0 ? recipeCost / effectiveWeight : 0;
            const amountInBase = convertToBase(amount, unit);
            updated[index] = { ...item, amount, unit, cost: costPerBase * amountInBase };
          }
        }
      }
      return updated;
    });
  };

  const removeItem = (index: number) => {
    Alert.alert('Remover item', 'Deseja remover este item da receita?', [
      { text: 'Cancelar' },
      { text: 'Remover', onPress: () => setRecipeItems(prev => prev.filter((_, i) => i !== index)) },
    ]);
  };

  const openEditAmount = (index: number) => {
    setEditingItemIndex(index);
    setEditAmount(recipeItems[index].amount.toString());
    const item = recipeItems[index];
    if (item.type === 'ingredient') {
      const ingredient = ingredients.find(i => i.id === item.id);
      if (ingredient) {
        const normalizedPkgUnit = normalizeUnit(ingredient.package_unit);
        const compatible = getCompatibleUnits(normalizedPkgUnit);
        const normalizedItemUnit = normalizeUnit(item.unit);
        if (!compatible.includes(normalizedItemUnit)) {
          setEditUnit(normalizedPkgUnit);
        } else {
          setEditUnit(normalizedItemUnit);
        }
      } else {
        setEditUnit(normalizeUnit(item.unit));
      }
    } else {
      // Para receitas: respeitar a unidade atual do item
      const normalizedItemUnit = normalizeUnit(item.unit);
      if (normalizedItemUnit === 'porção') {
        setEditUnit('porção');
      } else {
        const recipe = recipes.find(r => r.id === item.id);
        const effectiveW = recipe ? getRecipeEffectiveWeight(recipe) : 0;
        if (effectiveW > 0) {
          const recipeWeightUnit = normalizeUnit(recipe!.total_weight_unit || recipe!.portion_weight_unit || 'g');
          const compatible = getCompatibleUnits(recipeWeightUnit);
          if (compatible.includes(normalizedItemUnit)) {
            setEditUnit(normalizedItemUnit);
          } else {
            setEditUnit(recipeWeightUnit);
          }
        } else {
          setEditUnit('porção');
        }
      }
    }
    setShowEditModal(true);
  };

  const confirmEditAmount = () => {
    if (editingItemIndex !== null) {
      updateItemAmount(editingItemIndex, editAmount, editUnit);
      setShowEditModal(false);
      setEditingItemIndex(null);
    }
  };

  const clearForm = () => {
    setRecipeName('');
    setRecipeItems([]);
    setInstructions('');
    setMarkupPercent('300');
    setCategory('');
    setTotalWeight('');
    setTotalWeightUnit('g');
    setPortionWeight('');
    setPortionWeightUnit('g');
    setShowYieldSection(false);
    setShowPortionSection(false);
    setShowPricingSection(false);
    setEditingRecipeId(null);
  };

  const saveRecipe = async () => {
    if (!isAuthenticated) {
      Alert.alert('Erro', 'Você precisa estar conectado para salvar receitas.');
      return;
    }
    if (!recipeName.trim()) {
      Alert.alert('Erro', 'Digite um nome para a receita.');
      return;
    }
    if (recipeItems.length === 0) {
      Alert.alert('Erro', 'Adicione pelo menos um ingrediente ou receita.');
      return;
    }

    // Avisos de validação (confirmáveis)
    const warnings: string[] = [];
    const itemsSemQtd = recipeItems.filter(i => i.amount === 0);
    if (itemsSemQtd.length > 0) {
      warnings.push(`${itemsSemQtd.length} item(ns) sem quantidade definida (custo será R$ 0,00).`);
    }
    const itemsSemCusto = recipeItems.filter(i => i.cost === 0 && i.amount > 0);
    if (itemsSemCusto.length > 0) {
      warnings.push(`${itemsSemCusto.length} item(ns) com custo R$ 0,00. Verifique o preço cadastrado.`);
    }
    const mk = parseFloat(markupPercent) || 0;
    if (showPricingSection && mk <= 0) {
      warnings.push('Markup está 0% — o preço de venda será igual ao custo.');
    }
    if (showPricingSection && mk > 0 && mk < 100) {
      warnings.push(`Markup de ${mk}% — o preço de venda será menor que o custo.`);
    }

    if (warnings.length > 0) {
      return new Promise<void>((resolve) => {
        Alert.alert(
          'Atenção',
          warnings.join('\n\n') + '\n\nDeseja salvar mesmo assim?',
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => resolve() },
            { text: 'Salvar', onPress: () => { doSaveRecipe(); resolve(); } },
          ]
        );
      });
    }

    doSaveRecipe();
  };

  const quickAddIngredient = async () => {
    const ingCost = parseFloat(newIngCost);
    const ingWeight = parseFloat(newIngWeight);
    if (!newIngName.trim() || isNaN(ingCost) || isNaN(ingWeight) || ingWeight <= 0) {
      Alert.alert('Erro', 'Preencha nome, custo e quantidade válidos.');
      return;
    }
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('ingredients').insert([{
      name: newIngName.trim(),
      cost: ingCost,
      package_weight: ingWeight,
      package_unit: newIngUnit,
      user_id: session?.user?.id,
    }]);
    setLoading(false);
    if (error) {
      Alert.alert('Erro ao adicionar', error.message);
    } else {
      setShowNewIngredientModal(false);
      await fetchIngredients();
      // Preenche a busca com o nome do ingrediente recém-criado
      setSearchText(newIngName.trim());
      setShowSearchResults(true);
    }
  };

  const doSaveRecipe = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const payload = {
      name: recipeName.trim(),
      ingredients: recipeItems,
      instructions,
      markup_percent: showPricingSection ? (parseFloat(markupPercent) || 300) : null,
      category: category || null,
      total_weight: parseFloat(totalWeight) || null,
      total_weight_unit: totalWeightUnit || 'g',
      portion_weight: parseFloat(portionWeight) || null,
      portion_weight_unit: portionWeightUnit || 'g',
      user_id: session?.user?.id,
    };

    let error;
    if (editingRecipeId) {
      ({ error } = await supabase.from('recipes').update(payload).eq('id', editingRecipeId));
    } else {
      ({ error } = await supabase.from('recipes').insert([payload]));
    }
    setLoading(false);

    if (error) {
      Alert.alert('Erro ao salvar', error.message);
    } else {
      fetchRecipes();
      clearForm();
      Alert.alert('Sucesso', editingRecipeId ? 'Receita atualizada!' : 'Receita salva!');
    }
  };

  const loadRecipeForEdit = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setRecipeItems(recipe.ingredients || []);
    setInstructions(recipe.instructions || '');
    setMarkupPercent((recipe.markup_percent || 300).toString());
    setCategory(recipe.category || '');
    setTotalWeight(recipe.total_weight ? recipe.total_weight.toString() : '');
    setTotalWeightUnit(recipe.total_weight_unit || 'g');
    setPortionWeight(recipe.portion_weight ? recipe.portion_weight.toString() : '');
    setPortionWeightUnit(recipe.portion_weight_unit || 'g');
    setShowYieldSection(!!(recipe.total_weight && recipe.total_weight > 0));
    setShowPortionSection(!!(recipe.portion_weight && recipe.portion_weight > 0));
    setShowPricingSection(!!(recipe.markup_percent && recipe.markup_percent > 0));
  };

  const deleteRecipe = (id: number) => {
    Alert.alert('Confirmar exclusão', 'Tem certeza que deseja remover esta receita?', [
      { text: 'Cancelar' },
      {
        text: 'Remover',
        onPress: async () => {
          const { error } = await supabase.from('recipes').delete().eq('id', id);
          if (error) Alert.alert('Erro ao remover', error.message);
          else {
            fetchRecipes();
            Alert.alert('Sucesso', 'Receita removida!');
          }
        },
      },
    ]);
  };

  // Peso bruto (soma automática dos itens em gramas/ml — ignora unidades avulsas e porções)
  const rawWeightInBase = recipeItems.reduce((sum, item) => {
    const cat = getUnitCategory(item.unit);
    if (item.amount > 0 && (cat === 'peso' || cat === 'volume') && item.unit !== 'porção') {
      return sum + convertToBase(item.amount, item.unit);
    }
    return sum;
  }, 0);

  // Formata peso bruto para exibição
  const formatWeight = (valueInBase: number, unitHint: string): string => {
    const cat = getUnitCategory(unitHint);
    if (cat === 'volume') {
      return valueInBase >= 1000 ? `${(valueInBase / 1000).toFixed(2)} L` : `${valueInBase.toFixed(0)} ml`;
    }
    return valueInBase >= 1000 ? `${(valueInBase / 1000).toFixed(2)} kg` : `${valueInBase.toFixed(0)} g`;
  };

  // Cálculos
  const totalCost = recipeItems.reduce((sum, item) => sum + item.cost, 0);
  const markup = showPricingSection ? (parseFloat(markupPercent) || 0) : 0;
  const sellingPrice = markup > 0 ? totalCost * (1 + markup / 100) : totalCost;
  const profitMargin = sellingPrice > 0 ? ((sellingPrice - totalCost) / sellingPrice) * 100 : 0;
  const profit = sellingPrice - totalCost;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>🍽️ Receitas</Text>
        <Text style={styles.subtitle}>Crie e gerencie suas fichas técnicas</Text>
      </View>

      {!isAuthenticated && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>⚠️ Não conectado - Vá para a tela de login primeiro</Text>
        </View>
      )}

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Nome da receita */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {editingRecipeId ? '✏️ Editando Receita' : '📝 Nova Receita'}
          </Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Nome da receita"
              placeholderTextColor="#999"
              value={recipeName}
              onChangeText={setRecipeName}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Categoria (ex: Entrada, Prato Principal, Sobremesa)"
              placeholderTextColor="#999"
              value={category}
              onChangeText={setCategory}
              editable={!loading}
            />
          </View>
        </View>

        {/* Buscar ingredientes e receitas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 Pesquisar Itens</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#007AFF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar ingredientes ou receitas..."
              placeholderTextColor="#999"
              value={searchText}
              onChangeText={(text) => {
                setSearchText(text);
                setShowSearchResults(text.length > 0);
              }}
            />
            {searchText !== '' && (
              <TouchableOpacity style={styles.clearButton} onPress={() => { setSearchText(''); setShowSearchResults(false); }}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Resultados da busca */}
          {showSearchResults && (
            <View style={styles.searchResultsContainer}>
              {searchResults.length === 0 ? (
                <View style={styles.noResultsContainer}>
                  <Ionicons name="search-outline" size={20} color="#999" />
                  <Text style={styles.noResultsText}>Nenhum resultado para "{searchText}"</Text>
                  <TouchableOpacity
                    style={styles.addNewItemButton}
                    onPress={() => {
                      setSavedSearchText(searchText);
                      setNewIngName(searchText);
                      setNewIngCost('');
                      setNewIngWeight('');
                      setNewIngUnit('kg');
                      setShowNewIngredientModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#007AFF" />
                    <Text style={styles.addNewItemText}>Cadastrar "{searchText}"</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={styles.searchResultsList} nestedScrollEnabled>
                  {searchResults.map((item, idx) => (
                    <TouchableOpacity
                      key={`${item.type}-${item.id}-${idx}`}
                      style={styles.searchResultItem}
                      onPress={() => item.type === 'ingredient'
                        ? addIngredientToRecipe(item as Ingredient)
                        : addRecipeToRecipe(item as Recipe)
                      }
                    >
                      <View style={[styles.typeBadge, item.type === 'ingredient' ? styles.badgeIngredient : styles.badgeRecipe]}>
                        <Text style={styles.typeBadgeText}>
                          {item.type === 'ingredient' ? 'ING' : 'REC'}
                        </Text>
                      </View>
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName}>{item.name}</Text>
                        <Text style={styles.searchResultDetail}>
                          {item.type === 'ingredient'
                            ? `${formatCurrency((item as Ingredient).cost)} / ${(item as Ingredient).package_weight} ${(item as Ingredient).package_unit}`
                            : (() => {
                                const r = item as Recipe;
                                const rCost = (r.ingredients || []).reduce((s: number, ri: RecipeItem) => s + (ri.cost || 0), 0);
                                if (r.portion_weight && r.portion_weight > 0) {
                                  const costPP = getRecipePortionCost(r);
                                  return `${formatCurrency(costPP)} / porção (${r.portion_weight}${r.portion_weight_unit || 'g'})`;
                                }
                                if (r.total_weight && r.total_weight > 0) {
                                  return `${formatCurrency(rCost)} — Rende ${r.total_weight} ${r.total_weight_unit || 'g'}`;
                                }
                                return `${formatCurrency(rCost)} — Receita salva`;
                              })()
                          }
                        </Text>
                      </View>
                      <Ionicons name="add-circle" size={24} color="#007AFF" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {/* Itens da receita */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Itens da Receita ({recipeItems.length})</Text>
          {recipeItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>Nenhum item adicionado</Text>
              <Text style={styles.emptyStateSubtext}>Busque ingredientes ou receitas acima</Text>
            </View>
          ) : (
            recipeItems.map((item, index) => (
              <View key={`item-${index}`} style={styles.recipeItemCard}>
                <View style={styles.recipeItemHeader}>
                  <View style={[styles.typeBadgeSmall, item.type === 'ingredient' ? styles.badgeIngredient : styles.badgeRecipe]}>
                    <Text style={styles.typeBadgeSmallText}>
                      {item.type === 'ingredient' ? 'ING' : 'REC'}
                    </Text>
                  </View>
                  <Text style={styles.recipeItemName}>{item.name}</Text>
                  <TouchableOpacity onPress={() => removeItem(index)}>
                    <Ionicons name="trash" size={18} color="#f44336" />
                  </TouchableOpacity>
                </View>
                <View style={styles.recipeItemBody}>
                  <TouchableOpacity style={styles.amountButton} onPress={() => openEditAmount(index)}>
                    <Text style={styles.amountText}>
                      {item.amount > 0 ? `${item.amount} ${item.unit}` : 'Definir qtd'}
                    </Text>
                    <Ionicons name="pencil" size={14} color="#007AFF" />
                  </TouchableOpacity>
                  <Text style={styles.itemCostText}>{formatCurrency(item.cost)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Modo de Preparo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👨‍🍳 Modo de Preparo</Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.textArea}
              placeholder="Descreva o modo de preparo aqui..."
              placeholderTextColor="#999"
              value={instructions}
              onChangeText={setInstructions}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Cálculos */}
        {recipeItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 Cálculos</Text>
            <View style={styles.calcCard}>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Custo Total:</Text>
                <Text style={styles.calcValue}>{formatCurrency(totalCost)}</Text>
              </View>

              <View style={styles.divider} />

              {/* Precificação - colapsável */}
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => {
                  if (showPricingSection) {
                    setShowPricingSection(false);
                    setMarkupPercent('300');
                  } else {
                    setShowPricingSection(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                  <Ionicons name="pricetag-outline" size={18} color="#4CAF50" />
                  <View>
                    <Text style={styles.collapsibleTitle}>Precificação</Text>
                    <Text style={styles.collapsibleHint}>Markup, preço de venda e lucro</Text>
                  </View>
                </View>
                <Ionicons name={showPricingSection ? 'chevron-up' : 'chevron-down'} size={20} color="#4CAF50" />
              </TouchableOpacity>

              {showPricingSection && (
                <View style={styles.collapsibleContent}>
                  <Text style={styles.calcSectionLabel}>Porcentagem de Lucro</Text>
                  <View style={styles.markupRow}>
                    <TouchableOpacity
                      style={styles.markupButton}
                      onPress={() => setMarkupPercent(Math.max(0, (parseFloat(markupPercent) || 0) - 10).toString())}
                    >
                      <Ionicons name="remove" size={20} color="white" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.markupInput}
                      value={markupPercent}
                      onChangeText={setMarkupPercent}
                      keyboardType="decimal-pad"
                      placeholder="100"
                      placeholderTextColor="#999"
                    />
                    <Text style={styles.percentSign}>%</Text>
                    <TouchableOpacity
                      style={styles.markupButton}
                      onPress={() => setMarkupPercent(((parseFloat(markupPercent) || 0) + 10).toString())}
                    >
                      <Ionicons name="add" size={20} color="white" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Preço de Venda:</Text>
                    <Text style={styles.calcValueBig}>{formatCurrency(sellingPrice)}</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Lucro:</Text>
                    <Text style={[styles.calcValue, { color: profit >= 0 ? '#4CAF50' : '#f44336' }]}>
                      {formatCurrency(profit)}
                    </Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Margem de Lucro:</Text>
                    <Text style={[styles.calcValue, { color: profitMargin >= 0 ? '#4CAF50' : '#f44336' }]}>
                      {profitMargin.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Rendimento Final */}
        {recipeItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚖️ Rendimento Final</Text>
            <View style={styles.calcCard}>
              {/* Peso Bruto auto */}
              <View style={styles.calcRow}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                  <Ionicons name="layers-outline" size={16} color="#4CAF50" />
                  <Text style={styles.calcLabel}>Peso Bruto (ingredientes):</Text>
                </View>
                <Text style={styles.calcValue}>
                  {rawWeightInBase > 0 ? formatWeight(rawWeightInBase, recipeItems[0]?.unit || 'g') : '--'}
                </Text>
              </View>

              {/* Avisos de validação */}
              {recipeItems.some(item => item.amount === 0) && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning-outline" size={16} color="#FF9800" />
                  <Text style={styles.warningBoxText}>
                    Há itens sem quantidade definida. Toque em "Definir qtd" para corrigir.
                  </Text>
                </View>
              )}
              {recipeItems.some(item => item.cost === 0 && item.amount > 0) && (
                <View style={styles.warningBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#f44336" />
                  <Text style={styles.warningBoxText}>
                    Algum item tem custo R$ 0,00. Verifique se o preço do ingrediente está cadastrado.
                  </Text>
                </View>
              )}

              <View style={styles.divider} />

              {/* Peso Pronto - colapsável */}
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => {
                  if (showYieldSection) {
                    setShowYieldSection(false);
                    setTotalWeight('');
                  } else {
                    setShowYieldSection(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                  <Ionicons name="scale-outline" size={18} color="#007AFF" />
                  <View>
                    <Text style={styles.collapsibleTitle}>Peso pronto</Text>
                    <Text style={styles.collapsibleHint}>Cozimento, evaporação, etc.</Text>
                  </View>
                </View>
                <Ionicons name={showYieldSection ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
              </TouchableOpacity>

              {showYieldSection && (
                <View style={styles.collapsibleContent}>
                  <View style={styles.yieldRow}>
                    <View style={styles.yieldInputWrap}>
                      <Ionicons name="scale-outline" size={16} color="#007AFF" />
                      <TextInput
                        style={styles.yieldInput}
                        placeholder="Peso final pronto"
                        placeholderTextColor="#999"
                        value={totalWeight}
                        onChangeText={setTotalWeight}
                        keyboardType="decimal-pad"
                        editable={!loading}
                      />
                    </View>
                    <View style={styles.yieldUnitRow}>
                      {['g', 'kg', 'ml', 'L'].map(u => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.yieldUnitChip, totalWeightUnit === u && styles.yieldUnitChipActive]}
                          onPress={() => setTotalWeightUnit(u)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.yieldUnitChipText, totalWeightUnit === u && styles.yieldUnitChipTextActive]}>
                            {u}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Aviso: peso pronto maior que bruto */}
                  {(() => {
                    const rw = parseFloat(totalWeight);
                    if (!rw || rw <= 0 || rawWeightInBase <= 0) return null;
                    const readyInBase = convertToBase(rw, totalWeightUnit);
                    if (readyInBase > rawWeightInBase * 1.5) {
                      return (
                        <View style={styles.warningBox}>
                          <Ionicons name="warning-outline" size={16} color="#FF9800" />
                          <Text style={styles.warningBoxText}>
                            Peso pronto muito maior que o bruto. Certifique-se de que a unidade está correta.
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  })()}

                  {/* Indicadores de perda */}
                  {(() => {
                    const readyWeight = parseFloat(totalWeight);
                    if (!readyWeight || readyWeight <= 0 || rawWeightInBase <= 0) return null;
                    const readyInBase = convertToBase(readyWeight, totalWeightUnit);
                    const lossPercent = ((rawWeightInBase - readyInBase) / rawWeightInBase) * 100;
                    const hasLoss = Math.abs(lossPercent) > 0.1;
                    const isLoss = lossPercent > 0;
                    return hasLoss ? (
                      <View style={[styles.lossBadgeRow, { backgroundColor: isLoss ? '#FFF5F5' : '#F0FFF4' }]}>
                        <Ionicons
                          name={isLoss ? 'trending-down' : 'trending-up'}
                          size={18}
                          color={isLoss ? '#E53935' : '#4CAF50'}
                        />
                        <Text style={[styles.lossBadgeText, { color: isLoss ? '#C62828' : '#2E7D32' }]}>
                          {isLoss ? 'Perda' : 'Ganho'} de {Math.abs(lossPercent).toFixed(1)}% no peso
                        </Text>
                      </View>
                    ) : null;
                  })()}
                </View>
              )}

              <View style={styles.divider} />

              {/* Porções - colapsável */}
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => {
                  if (showPortionSection) {
                    setShowPortionSection(false);
                    setPortionWeight('');
                  } else {
                    setShowPortionSection(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                  <Ionicons name="restaurant-outline" size={18} color="#FF9800" />
                  <View>
                    <Text style={styles.collapsibleTitle}>Porções</Text>
                    <Text style={styles.collapsibleHint}>Defina quanto pesa cada porção</Text>
                  </View>
                </View>
                <Ionicons name={showPortionSection ? 'chevron-up' : 'chevron-down'} size={20} color="#FF9800" />
              </TouchableOpacity>

              {showPortionSection && (
                <View style={styles.collapsibleContent}>
                  <View style={styles.yieldRow}>
                    <View style={styles.yieldInputWrap}>
                      <Ionicons name="restaurant-outline" size={16} color="#FF9800" />
                      <TextInput
                        style={styles.yieldInput}
                        placeholder="Ex: 180"
                        placeholderTextColor="#999"
                        value={portionWeight}
                        onChangeText={setPortionWeight}
                        keyboardType="decimal-pad"
                        editable={!loading}
                      />
                    </View>
                    <View style={styles.yieldUnitRow}>
                      {['g', 'kg', 'ml', 'L'].map(u => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.yieldUnitChip, portionWeightUnit === u && styles.yieldUnitChipActive]}
                          onPress={() => setPortionWeightUnit(u)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.yieldUnitChipText, portionWeightUnit === u && styles.yieldUnitChipTextActive]}>
                            {u}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Aviso: porção maior que o peso efetivo */}
                  {(() => {
                    const pw = parseFloat(portionWeight);
                    if (!pw || pw <= 0) return null;
                    const readyWeight = parseFloat(totalWeight);
                    const effectiveInBase = (readyWeight && readyWeight > 0)
                      ? convertToBase(readyWeight, totalWeightUnit)
                      : rawWeightInBase;
                    const portionInBase = convertToBase(pw, portionWeightUnit);
                    if (effectiveInBase > 0 && portionInBase > effectiveInBase) {
                      return (
                        <View style={styles.warningBox}>
                          <Ionicons name="warning-outline" size={16} color="#f44336" />
                          <Text style={styles.warningBoxText}>
                            O peso da porção é maior que o rendimento total da receita!
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  })()}

                  {/* Resumo de porções */}
                  {(() => {
                    const pw = parseFloat(portionWeight);
                    if (!pw || pw <= 0) return null;
                    const readyWeight = parseFloat(totalWeight);
                    const effectiveInBase = (readyWeight && readyWeight > 0)
                      ? convertToBase(readyWeight, totalWeightUnit)
                      : rawWeightInBase;
                    const portionInBase = convertToBase(pw, portionWeightUnit);
                    if (effectiveInBase <= 0 || portionInBase <= 0) return null;
                    const numPortions = effectiveInBase / portionInBase;
                    const costPerPortion = totalCost / numPortions;
                    return (
                      <View style={styles.portionSummary}>
                        <View style={styles.calcRow}>
                          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                            <Ionicons name="copy-outline" size={16} color="#FF9800" />
                            <Text style={styles.calcLabel}>Rende:</Text>
                          </View>
                          <Text style={[styles.calcValue, {color: '#FF9800', fontWeight: '700'}]}>
                            {numPortions % 1 === 0 ? numPortions.toFixed(0) : numPortions.toFixed(1)} porções
                          </Text>
                        </View>
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Cada porção:</Text>
                          <Text style={styles.calcValue}>{pw} {portionWeightUnit}</Text>
                        </View>
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Custo por porção:</Text>
                          <Text style={[styles.calcValue, {color: '#4CAF50', fontWeight: '700'}]}>
                            {formatCurrency(costPerPortion)}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                </View>
              )}

              <View style={styles.divider} />

              {/* ── Peso Final do Prato ── */}
              {/* Só mostra quando NÃO tem porção (pois porção já aparece no Resumo de Porções) */}
              {(() => {
                const pw = parseFloat(portionWeight);
                const rw = parseFloat(totalWeight);
                const hasPortion = showPortionSection && pw > 0;
                const hasReady = showYieldSection && rw > 0;

                // Se tem porção, já foi exibido no resumo de porções acima
                if (hasPortion) return null;

                let dishWeight: number;
                let dishLabel: string;
                let dishIcon: string;
                let dishColor: string;
                let dishUnit: string;

                if (hasReady) {
                  dishWeight = convertToBase(rw, totalWeightUnit);
                  dishLabel = 'Peso do Prato (após preparo)';
                  dishIcon = 'scale-outline';
                  dishColor = '#007AFF';
                  dishUnit = totalWeightUnit;
                } else {
                  dishWeight = rawWeightInBase;
                  dishLabel = 'Peso do Prato (soma dos itens)';
                  dishIcon = 'layers-outline';
                  dishColor = '#4CAF50';
                  dishUnit = recipeItems[0]?.unit || 'g';
                }

                if (dishWeight <= 0) return null;

                return (
                  <View style={styles.dishWeightBox}>
                    <View style={styles.calcRow}>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                        <Ionicons name={dishIcon as any} size={18} color={dishColor} />
                        <Text style={[styles.calcLabel, {fontWeight: '700'}]}>{dishLabel}:</Text>
                      </View>
                      <Text style={[styles.calcValue, {color: dishColor, fontWeight: '700', fontSize: 16}]}>
                        {formatWeight(dishWeight, dishUnit)}
                      </Text>
                    </View>
                  </View>
                );
              })()}
            </View>
          </View>
        )}

        {/* Botão Salvar */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.buttonPrimary, (!isAuthenticated || loading) && styles.buttonDisabled]}
            onPress={saveRecipe}
            disabled={!isAuthenticated || loading}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text style={styles.buttonText}>
                {loading ? 'Salvando...' : editingRecipeId ? 'Atualizar Receita' : 'Salvar Receita'}
              </Text>
            </View>
          </TouchableOpacity>
          {editingRecipeId && (
            <TouchableOpacity style={styles.buttonSecondary} onPress={clearForm}>
              <View style={styles.buttonContent}>
                <Ionicons name="close-circle" size={20} color="#666" />
                <Text style={styles.buttonSecondaryText}>Cancelar Edição</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Receitas Salvas */}
        {!editingRecipeId && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📚 Receitas Salvas ({recipes.length})</Text>
          {recipes.length > 0 && (
            <View style={styles.savedSearchRow}>
              <Ionicons name="search-outline" size={18} color="#999" />
              <TextInput
                style={styles.savedSearchInput}
                placeholder="Buscar receita salva..."
                placeholderTextColor="#bbb"
                value={savedSearchText}
                onChangeText={setSavedSearchText}
              />
              {savedSearchText !== '' && (
                <TouchableOpacity onPress={() => setSavedSearchText('')}>
                  <Ionicons name="close-circle" size={18} color="#ccc" />
                </TouchableOpacity>
              )}
            </View>
          )}
          {recipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>Nenhuma receita salva</Text>
            </View>
          ) : (
            recipes
              .filter(r => savedSearchText.length === 0 || r.name.toLowerCase().includes(savedSearchText.toLowerCase()))
              .map((recipe) => {
              const recipeTotalCost = (recipe.ingredients || []).reduce((sum: number, item: RecipeItem) => sum + (item.cost || 0), 0);
              const rHasPricing = recipe.markup_percent != null && recipe.markup_percent > 0;
              const rSelling = rHasPricing ? recipeTotalCost * (1 + recipe.markup_percent! / 100) : recipeTotalCost;
              return (
                <View key={recipe.id} style={styles.savedRecipeCard}>
                  <View style={styles.savedRecipeHeader}>
                    <Text style={styles.savedRecipeName}>{recipe.name}</Text>
                    <View style={styles.savedRecipeActions}>
                      <TouchableOpacity style={styles.actionButton} onPress={() => loadRecipeForEdit(recipe)}>
                        <Ionicons name="pencil" size={16} color="#2196F3" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionButtonDanger} onPress={() => deleteRecipe(recipe.id)}>
                        <Ionicons name="trash" size={16} color="#f44336" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.savedRecipeItems}>
                    {(recipe.ingredients || []).map((item: RecipeItem, idx: number) => (
                      <Text key={idx} style={styles.savedItemText}>
                        {item.type === 'recipe' ? '🍽️' : '🥬'} {item.name}: {item.amount} {item.unit} — {formatCurrency(item.cost)}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.savedRecipeFooter}>
                    <Text style={styles.savedCostText}>Custo: {formatCurrency(recipeTotalCost)}</Text>
                    {rHasPricing ? (
                      <Text style={styles.savedPriceText}>Venda: {formatCurrency(rSelling)}</Text>
                    ) : recipe.portion_weight && recipe.portion_weight > 0 ? (
                      <Text style={styles.savedPriceText}>Porção: {formatCurrency(getRecipePortionCost(recipe))}</Text>
                    ) : null}
                  </View>
                  {/* Peso do Prato */}
                  {(() => {
                    if (recipe.portion_weight && recipe.portion_weight > 0) {
                      return (
                        <View style={styles.savedRecipeBadge}>
                          <Ionicons name="restaurant-outline" size={13} color="#FF9800" />
                          <Text style={[styles.savedRecipeBadgeText, {color: '#FF9800'}]}>
                            Prato: {recipe.portion_weight} {recipe.portion_weight_unit || 'g'} (porção)
                          </Text>
                        </View>
                      );
                    }
                    if (recipe.total_weight && recipe.total_weight > 0) {
                      return (
                        <View style={styles.savedRecipeBadge}>
                          <Ionicons name="scale-outline" size={13} color="#007AFF" />
                          <Text style={[styles.savedRecipeBadgeText, {color: '#007AFF'}]}>
                            Prato: {recipe.total_weight} {recipe.total_weight_unit || 'g'} (peso pronto)
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>
              );
            })
          )}
        </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal Editar Quantidade */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowEditModal(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Definir Quantidade</Text>
            {editingItemIndex !== null && (() => {
              const item = recipeItems[editingItemIndex];
              if (!item) return null;
              const isIngredient = item.type === 'ingredient';
              const ingredient = isIngredient ? ingredients.find(i => i.id === item.id) : null;
              const recipeRef = !isIngredient ? recipes.find(r => r.id === item.id) : null;
              const recipeEffective = recipeRef ? getRecipeEffectiveWeight(recipeRef) : 0;
              const recipeHasWeight = recipeEffective > 0;
              const isWeightMode = !isIngredient && editUnit !== 'porção';
              const compatibleUnits = ingredient
                ? getCompatibleUnits(ingredient.package_unit)
                : recipeHasWeight
                  ? getCompatibleUnits(recipeRef!.total_weight_unit || recipeRef!.portion_weight_unit || 'g')
                  : [];
              const catInfo = getCategoryInfo(
                getUnitCategory(ingredient?.package_unit || (recipeHasWeight ? recipeRef!.total_weight_unit || 'g' : 'g'))
              );
              return (
                <>
                  <Text style={styles.modalSubtitle}>{item.name}</Text>

                  {/* Info do ingrediente original */}
                  {ingredient && (
                    <View style={styles.ingredientInfoBox}>
                      <Ionicons name="information-circle-outline" size={16} color="#007AFF" />
                      <Text style={styles.ingredientInfoText}>
                        Pacote: {formatCurrency(ingredient.cost)} / {ingredient.package_weight} {ingredient.package_unit}
                      </Text>
                    </View>
                  )}

                  {/* Info de rendimento da receita */}
                  {!isIngredient && recipeRef && (
                    <View style={styles.ingredientInfoBox}>
                      <Ionicons name="restaurant-outline" size={16} color="#007AFF" />
                      <Text style={styles.ingredientInfoText}>
                        Custo total: {formatCurrency(
                          (recipeRef.ingredients || []).reduce((sum: number, ri: RecipeItem) => sum + (ri.cost || 0), 0)
                        )}
                        {recipeRef.portion_weight && recipeRef.portion_weight > 0
                          ? (() => {
                              const pInBase = convertToBase(recipeRef.portion_weight!, recipeRef.portion_weight_unit || 'g');
                              const numP = recipeEffective > 0 && pInBase > 0 ? recipeEffective / pInBase : 1;
                              return ` — ${numP % 1 === 0 ? numP.toFixed(0) : numP.toFixed(1)} porções de ${recipeRef.portion_weight}${recipeRef.portion_weight_unit || 'g'}`;
                            })()
                          : recipeHasWeight ? ` — Rende ${formatWeight(recipeEffective, 'g')}` : ''
                        }
                      </Text>
                    </View>
                  )}

                  {/* Seletor Peso / Porção para receitas */}
                  {!isIngredient && (
                    <View style={styles.modeSelector}>
                      <TouchableOpacity
                        style={[styles.modeChip, !isWeightMode && styles.modeChipActive]}
                        onPress={() => setEditUnit('porção')}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="copy-outline" size={16} color={!isWeightMode ? 'white' : '#666'} />
                        <Text style={[styles.modeChipText, !isWeightMode && styles.modeChipTextActive]}>
                          Por Porção
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modeChip, isWeightMode && styles.modeChipActive, !recipeHasWeight && styles.modeChipDisabled]}
                        onPress={() => {
                          if (recipeHasWeight) {
                            setEditUnit(normalizeUnit(recipeRef!.total_weight_unit || 'g'));
                          }
                        }}
                        activeOpacity={recipeHasWeight ? 0.7 : 1}
                      >
                        <Ionicons name="scale-outline" size={16} color={isWeightMode ? 'white' : recipeHasWeight ? '#666' : '#ccc'} />
                        <Text style={[styles.modeChipText, isWeightMode && styles.modeChipTextActive, !recipeHasWeight && { color: '#ccc' }]}>
                          Por Peso
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!recipeHasWeight && !isIngredient && (
                    <Text style={styles.modeHint}>
                      Para usar por peso, defina o rendimento na receita "{recipeRef?.name}"
                    </Text>
                  )}

                  {/* Seletor de unidade de peso (ingrediente OU receita em modo peso) */}
                  {(isIngredient || isWeightMode) && compatibleUnits.length > 0 && (
                    <View style={styles.unitSelectorSection}>
                      <View style={styles.unitCategoryHeader}>
                        <Ionicons name={catInfo.icon as any} size={16} color={catInfo.color} />
                        <Text style={styles.unitCategoryLabel}>{catInfo.label}</Text>
                      </View>
                      <View style={styles.unitSelectorRow}>
                        {compatibleUnits.map(u => (
                          <TouchableOpacity
                            key={u}
                            style={[styles.unitSelectChip, editUnit === u && styles.unitSelectChipActive]}
                            onPress={() => setEditUnit(u)}
                          >
                            <Text style={[styles.unitSelectChipText, editUnit === u && styles.unitSelectChipTextActive]}>
                              {UNITS[u]?.label || u}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Quantidade */}
                  <View style={styles.amountInputRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder={isWeightMode ? 'Quantidade em peso' : !isIngredient ? 'Nº de porções' : 'Quantidade'}
                      placeholderTextColor="#999"
                      value={editAmount}
                      onChangeText={setEditAmount}
                      keyboardType="decimal-pad"
                      autoFocus
                    />
                    <View style={styles.amountUnitBadge}>
                      <Text style={styles.amountUnitBadgeText}>{UNITS[editUnit]?.label || editUnit}</Text>
                    </View>
                  </View>

                  {/* Preview de custo - ingrediente */}
                  {ingredient && editAmount && (
                    <View style={styles.costPreview}>
                      <Text style={styles.costPreviewLabel}>Custo estimado:</Text>
                      <Text style={styles.costPreviewValue}>
                        {(() => {
                          const amt = parseFloat(editAmount);
                          if (isNaN(amt) || amt <= 0) return 'R$ 0,00';
                          const packageInBase = convertToBase(ingredient.package_weight, ingredient.package_unit);
                          const costPerBase = packageInBase > 0 ? ingredient.cost / packageInBase : 0;
                          const amountInBase = convertToBase(amt, editUnit);
                          return formatCurrency(costPerBase * amountInBase);
                        })()}
                      </Text>
                    </View>
                  )}

                  {/* Preview de custo - receita por peso */}
                  {!isIngredient && recipeRef && isWeightMode && recipeHasWeight && editAmount && (
                    <View style={styles.costPreview}>
                      <Text style={styles.costPreviewLabel}>Custo estimado:</Text>
                      <Text style={styles.costPreviewValue}>
                        {(() => {
                          const amt = parseFloat(editAmount);
                          if (isNaN(amt) || amt <= 0) return 'R$ 0,00';
                          const recipeCost = (recipeRef.ingredients || []).reduce((sum: number, ri: RecipeItem) => sum + (ri.cost || 0), 0);
                          const costPerBase = recipeEffective > 0 ? recipeCost / recipeEffective : 0;
                          const amountInBase = convertToBase(amt, editUnit);
                          return formatCurrency(costPerBase * amountInBase);
                        })()}
                      </Text>
                    </View>
                  )}

                  {/* Preview de custo - receita por porção */}
                  {!isIngredient && recipeRef && !isWeightMode && editAmount && (
                    <View style={styles.costPreview}>
                      <Text style={styles.costPreviewLabel}>Custo estimado:</Text>
                      <Text style={styles.costPreviewValue}>
                        {(() => {
                          const amt = parseFloat(editAmount);
                          if (isNaN(amt) || amt <= 0) return 'R$ 0,00';
                          const costPerPortion = getRecipePortionCost(recipeRef);
                          return formatCurrency(costPerPortion * amt);
                        })()}
                      </Text>
                    </View>
                  )}
                </>
              );
            })()}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.buttonPrimary} onPress={confirmEditAmount}>
                <View style={styles.buttonContent}>
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.buttonText}>Confirmar</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.buttonSecondary} onPress={() => setShowEditModal(false)}>
                <View style={styles.buttonContent}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                  <Text style={styles.buttonSecondaryText}>Cancelar</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Cadastro Rápido de Ingrediente */}
      <Modal visible={showNewIngredientModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowNewIngredientModal(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Cadastrar Ingrediente</Text>

            <TextInput
              style={styles.quickIngInput}
              placeholder="Nome do ingrediente"
              placeholderTextColor="#999"
              value={newIngName}
              onChangeText={setNewIngName}
              editable={!loading}
              autoFocus
            />
            <View style={{flexDirection: 'row', gap: 8}}>
              <TextInput
                style={[styles.quickIngInput, {flex: 1}]}
                placeholder="Custo (R$)"
                placeholderTextColor="#999"
                value={newIngCost}
                onChangeText={setNewIngCost}
                keyboardType="decimal-pad"
                editable={!loading}
              />
              <TextInput
                style={[styles.quickIngInput, {flex: 1}]}
                placeholder="Quantidade"
                placeholderTextColor="#999"
                value={newIngWeight}
                onChangeText={setNewIngWeight}
                keyboardType="decimal-pad"
                editable={!loading}
              />
            </View>

            <Text style={styles.quickIngUnitLabel}>Unidade de medida</Text>
            {UNIT_GROUPS.map(group => (
              <View key={group.category} style={{marginBottom: 8}}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4}}>
                  <Ionicons name={group.icon as any} size={13} color="#999" />
                  <Text style={{fontSize: 12, color: '#999'}}>{group.label}</Text>
                </View>
                <View style={{flexDirection: 'row', gap: 6}}>
                  {group.units.map(u => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.quickIngUnitChip, newIngUnit === u && styles.quickIngUnitChipActive]}
                      onPress={() => setNewIngUnit(u)}
                    >
                      <Text style={[styles.quickIngUnitChipText, newIngUnit === u && styles.quickIngUnitChipTextActive]}>
                        {UNITS[u].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            <View style={{flexDirection: 'row', gap: 8, marginTop: 12}}>
              <TouchableOpacity
                style={[styles.quickIngSaveBtn, loading && {opacity: 0.5}]}
                onPress={quickAddIngredient}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.quickIngSaveBtnText}>{loading ? 'Salvando...' : 'Adicionar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickIngCancelBtn}
                onPress={() => setShowNewIngredientModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickIngCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  backButton: {
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    padding: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  warningBanner: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFB300',
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FFB300',
  },
  warningText: {
    color: '#7B6B00',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E5',
    padding: 13,
    marginVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: '#E0E0E5',
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    minHeight: 120,
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
    borderColor: '#007AFF',
    padding: 13,
    paddingLeft: 40,
    paddingRight: 40,
    borderRadius: 12,
    backgroundColor: 'white',
    fontSize: 15,
    color: '#333',
    flex: 1,
    shadowColor: '#007AFF',
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
  searchResultsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginTop: 8,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  searchResultsList: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 10,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  searchResultDetail: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  noResultsContainer: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  noResultsText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 13,
  },
  addNewItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  addNewItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  quickIngInput: {
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
  },
  quickIngUnitLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
    marginTop: 4,
  },
  quickIngUnitChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F0F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quickIngUnitChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  quickIngUnitChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  quickIngUnitChipTextActive: {
    color: '#fff',
  },
  quickIngSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
  },
  quickIngSaveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  quickIngCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickIngCancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  typeBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.3,
  },
  typeBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  badgeIngredient: {
    backgroundColor: '#4CAF50',
  },
  badgeRecipe: {
    backgroundColor: '#FF9800',
  },
  recipeItemCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  recipeItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipeItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  recipeItemBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  amountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  amountText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  itemCostText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  emptyState: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#F9F9FB',
    borderRadius: 16,
    marginVertical: 10,
    borderWidth: 1.5,
    borderColor: '#E8E8ED',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '600',
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 4,
    textAlign: 'center',
  },
  calcCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  calcLabel: {
    fontSize: 14,
    color: '#666',
  },
  calcValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  calcValueBig: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  calcSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E8ED',
    marginVertical: 10,
  },
  markupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  markupButton: {
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markupInput: {
    borderWidth: 1.5,
    borderColor: '#007AFF',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    width: 80,
  },
  percentSign: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    marginBottom: 10,
  },
  buttonSecondary: {
    backgroundColor: '#F5F5F8',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E5',
  },
  buttonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  savedSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  savedSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 4,
  },
  savedRecipeCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  savedRecipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  savedRecipeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  savedRecipeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  actionButtonDanger: {
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f44336',
  },
  savedRecipeItems: {
    gap: 4,
    marginBottom: 8,
  },
  savedItemText: {
    fontSize: 12,
    color: '#666',
  },
  savedRecipeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  savedCostText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  savedPriceText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  savedRecipeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  savedRecipeBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalClose: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    color: '#1A1A1A',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalButtons: {
    gap: 10,
    marginTop: 15,
  },
  // ── Unit selector ──
  ingredientInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EBF5FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  ingredientInfoText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  unitSelectorSection: {
    marginBottom: 12,
  },
  unitCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  unitCategoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  unitSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  unitSelectChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E8E8ED',
    backgroundColor: '#F8F8FA',
    alignItems: 'center',
  },
  unitSelectChipActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  unitSelectChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  unitSelectChipTextActive: {
    color: 'white',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountUnitBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
  },
  amountUnitBadgeText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  costPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FFF4',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  costPreviewLabel: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  costPreviewValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8E8ED',
    backgroundColor: '#F8F8FA',
  },
  modeChipActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  modeChipDisabled: {
    opacity: 0.4,
  },
  modeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modeChipTextActive: {
    color: 'white',
  },
  modeHint: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  yieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  yieldInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E5',
    paddingHorizontal: 12,
    gap: 8,
  },
  yieldInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  yieldUnitRow: {
    flexDirection: 'row',
    gap: 4,
  },
  yieldUnitChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E8E8ED',
    backgroundColor: '#F8F8FA',
  },
  yieldUnitChipActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  yieldUnitChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  yieldUnitChipTextActive: {
    color: 'white',
  },

  lossBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  lossBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  portionSummary: {
    marginTop: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  collapsibleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  collapsibleHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
  },
  collapsibleContent: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  warningBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#795548',
    lineHeight: 18,
  },
  dishWeightBox: {
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#B3D4FC',
  },

});