import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Modal, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface Ingredient {
  id: number;
  name: string;
  cost: number;
  package_weight: number;
  package_unit: string;
}

// ── Sistema de unidades ──
type UnitCategory = 'peso' | 'volume' | 'unidade';

interface UnitDef {
  label: string;
  category: UnitCategory;
  toBase: number; // multiplicador para converter para unidade base (g, ml, un)
}

const UNITS: Record<string, UnitDef> = {
  g:      { label: 'g',      category: 'peso',     toBase: 1 },
  kg:     { label: 'kg',     category: 'peso',     toBase: 1000 },
  ml:     { label: 'ml',     category: 'volume',   toBase: 1 },
  L:      { label: 'L',      category: 'volume',   toBase: 1000 },
  un:     { label: 'un',     category: 'unidade',  toBase: 1 },
};

const UNIT_GROUPS: { category: UnitCategory; label: string; icon: string; units: string[] }[] = [
  { category: 'peso',    label: 'Peso',    icon: 'scale-outline',  units: ['g', 'kg'] },
  { category: 'volume',  label: 'Volume',  icon: 'water-outline',  units: ['ml', 'L'] },
  { category: 'unidade', label: 'Unidade', icon: 'cube-outline',   units: ['un'] },
];


const formatCurrency = (value: number): string => {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
};

export default function Ingredients() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<Ingredient[]>([]);
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [packageWeight, setPackageWeight] = useState('');
  const [packageUnit, setPackageUnit] = useState('kg');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchIngredients();
  }, []);

  useEffect(() => {
    const filtered = ingredients
      .filter(ing => ing.name.toLowerCase().includes(searchText.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    setFilteredIngredients(filtered);
  }, [searchText, ingredients]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    if (!session) {
      Alert.alert('Atenção', 'Você precisa estar conectado para gerenciar ingredientes. Vá para a tela de login.');
    }
  };

  const fetchIngredients = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    const { data, error } = await supabase.from('ingredients').select('*').eq('user_id', session.user.id);
    if (error) {
      Alert.alert('Erro ao buscar ingredientes', error.message);
    } else {
      setIngredients(data || []);
    }
    setLoading(false);
  };

  const addIngredient = async () => {
    if (!isAuthenticated) {
      Alert.alert('Erro', 'Você precisa estar conectado para adicionar ingredientes.');
      return;
    }

    const newCost = parseFloat(cost);
    const newWeight = parseFloat(packageWeight);
    if (!name || isNaN(newCost) || isNaN(newWeight) || newWeight <= 0) {
      Alert.alert('Erro', 'Digite nome, custo e peso válidos.');
      return;
    }

    const duplicate = ingredients.some(
      ing => ing.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      Alert.alert('Nome duplicado', 'Já existe um ingrediente com esse nome.');
      return;
    }

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('ingredients').insert([{
      name, 
      cost: newCost, 
      package_weight: newWeight, 
      package_unit: packageUnit,
      user_id: session?.user?.id
    }]);
    setLoading(false);

    if (error) {
      if (error.message.includes('row-level security')) {
        Alert.alert('Erro de Permissão', 'Você não tem permissão para adicionar ingredientes. Por favor, conecte-se e tente novamente.');
      } else {
        Alert.alert('Erro ao adicionar', error.message);
      }
    } else {
      fetchIngredients();
      setName('');
      setCost('');
      setPackageWeight('');
      setPackageUnit('kg');
      setShowAddModal(false);
      Alert.alert('Sucesso', 'Ingrediente adicionado!');
    }
  };

  const openEditModal = (ingredient: Ingredient) => {
    setEditingId(ingredient.id);
    setName(ingredient.name);
    setCost(ingredient.cost.toString());
    setPackageWeight(ingredient.package_weight.toString());
    setPackageUnit(ingredient.package_unit);
    setShowEditModal(true);
  };

  const updateIngredient = async () => {
    if (!editingId) return;

    const newCost = parseFloat(cost);
    const newWeight = parseFloat(packageWeight);
    if (!name || isNaN(newCost) || isNaN(newWeight) || newWeight <= 0) {
      Alert.alert('Erro', 'Digite nome, custo e peso válidos.');
      return;
    }

    const duplicate = ingredients.some(
      ing => ing.id !== editingId && ing.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      Alert.alert('Nome duplicado', 'Já existe um ingrediente com esse nome.');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('ingredients')
      .update({ name, cost: newCost, package_weight: newWeight, package_unit: packageUnit })
      .eq('id', editingId);
    setLoading(false);

    if (error) {
      Alert.alert('Erro ao atualizar', error.message);
    } else {
      Alert.alert('Sucesso', 'Ingrediente atualizado!');
      setShowEditModal(false);
      fetchIngredients();
      setName('');
      setCost('');
      setPackageWeight('');
      setEditingId(null);
    }
  };

  const deleteIngredient = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja remover este ingrediente?')) return;
    setLoading(true);
    const { error } = await supabase.from('ingredients').delete().eq('id', id);
    setLoading(false);
    if (error) {
      Alert.alert('Erro ao remover', error.message);
    } else {
      fetchIngredients();
    }
  };


  return (
    <View style={styles.container}>
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Ingredientes</Text>
            <Text style={styles.subtitle}>Gerencie seus ingredientes base</Text>
          </View>
          {!isMobile && (
            <TouchableOpacity
              style={styles.addHeaderBtn}
              onPress={() => { setName(''); setCost(''); setPackageWeight(''); setPackageUnit('kg'); setShowAddModal(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color="white" />
              <Text style={styles.addHeaderBtnText}>Novo ingrediente</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {!isAuthenticated && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>⚠️ Não conectado - Vá para a tela de login primeiro</Text>
        </View>
      )}
      
      {/* Seção Busca - Sempre visível */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔍 Procurar Ingredientes</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6366f1" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Digite o nome para procurar..."
            placeholderTextColor="#94a3b8"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText !== '' && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setSearchText('')}
            >
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <ScrollView style={[styles.scrollContent, { backgroundColor: '#0f172a' }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Seção Lista */}
        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>📋 Lista ({filteredIngredients.length})</Text>
            {filteredIngredients.length === 0 && searchText !== '' && (
              <Text style={styles.noResults}>Nenhum resultado encontrado</Text>
            )}
          </View>
          
          {filteredIngredients.length === 0 && searchText === '' ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>Nenhum ingrediente cadastrado</Text>
              <Text style={styles.emptyStateSubtext}>Toque em "Adicionar Ingrediente" para começar</Text>
            </View>
          ) : (
            <View>
              {filteredIngredients.map((item) => {
                return (
                  <TouchableOpacity
                    key={item.id.toString()}
                    style={[styles.item, isMobile && styles.itemMobile]}
                    onPress={() => openEditModal(item)}
                  >
                    <View style={styles.itemContent}>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <View style={styles.itemDetails}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Pacote:</Text>
                          <Text style={styles.detailValue}>{formatCurrency(item.cost)} por {item.package_weight} {item.package_unit}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.itemActions}>
                      <TouchableOpacity 
                        style={styles.buttonEdit}
                        onPress={() => openEditModal(item)}
                      >
                        <Ionicons name="pencil" size={16} color="#6366f1" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.buttonDelete}
                        onPress={() => deleteIngredient(item.id)}
                      >
                        <Ionicons name="trash" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB mobile */}
      {isMobile && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => { setName(''); setCost(''); setPackageWeight(''); setPackageUnit('kg'); setShowAddModal(true); }}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color="white" />
        </TouchableOpacity>
      )}

      {/* Modal Editar */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalClose}
              onPress={() => setShowEditModal(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Editar Ingrediente</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nome do ingrediente"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              editable={!loading}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Custo (R$)"
                placeholderTextColor="#94a3b8"
                value={cost}
                onChangeText={setCost}
                keyboardType="decimal-pad"
                editable={!loading}
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 8 }]}
                placeholder="Quantidade"
                placeholderTextColor="#94a3b8"
                value={packageWeight}
                onChangeText={setPackageWeight}
                keyboardType="decimal-pad"
                editable={!loading}
              />
            </View>
            <Text style={styles.unitPickerLabel}>Unidade de medida</Text>
            <View style={styles.unitPickerContainer}>
              {UNIT_GROUPS.map(group => (
                <View key={group.category} style={styles.unitGroup}>
                  <View style={styles.unitGroupHeader}>
                    <Ionicons name={group.icon as any} size={14} color="#94a3b8" />
                    <Text style={styles.unitGroupLabel}>{group.label}</Text>
                  </View>
                  <View style={styles.unitChipRow}>
                    {group.units.map(u => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitChip, packageUnit === u && styles.unitChipActive]}
                        onPress={() => setPackageUnit(u)}
                      >
                        <Text style={[styles.unitChipText, packageUnit === u && styles.unitChipTextActive]}>{UNITS[u].label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                onPress={updateIngredient}
                disabled={loading}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.buttonText}>{loading ? "Salvando..." : "Salvar"}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.buttonSecondary}
                onPress={() => setShowEditModal(false)}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                  <Text style={styles.buttonSecondaryText}>Cancelar</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Adicionar */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalClose}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Adicionar Ingrediente</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nome do ingrediente"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              editable={!loading}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Custo (R$)"
                placeholderTextColor="#94a3b8"
                value={cost}
                onChangeText={setCost}
                keyboardType="decimal-pad"
                editable={!loading}
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 8 }]}
                placeholder="Quantidade"
                placeholderTextColor="#94a3b8"
                value={packageWeight}
                onChangeText={setPackageWeight}
                keyboardType="decimal-pad"
                editable={!loading}
              />
            </View>
            <Text style={styles.unitPickerLabel}>Unidade de medida</Text>
            <View style={styles.unitPickerContainer}>
              {UNIT_GROUPS.map(group => (
                <View key={group.category} style={styles.unitGroup}>
                  <View style={styles.unitGroupHeader}>
                    <Ionicons name={group.icon as any} size={14} color="#94a3b8" />
                    <Text style={styles.unitGroupLabel}>{group.label}</Text>
                  </View>
                  <View style={styles.unitChipRow}>
                    {group.units.map(u => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitChip, packageUnit === u && styles.unitChipActive]}
                        onPress={() => setPackageUnit(u)}
                      >
                        <Text style={[styles.unitChipText, packageUnit === u && styles.unitChipTextActive]}>{UNITS[u].label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                onPress={addIngredient}
                disabled={loading}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.buttonText}>{loading ? "Adicionando..." : "Adicionar"}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.buttonSecondary}
                onPress={() => setShowAddModal(false)}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                  <Text style={styles.buttonSecondaryText}>Cancelar</Text>
                </View>
              </TouchableOpacity>
            </View>
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
  headerMobile: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fab: {
    position: 'absolute',
    bottom: 88,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    zIndex: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addHeaderBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
  section: {
    padding: 20,
    paddingTop: 15,
    paddingBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 12,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  noResults: {
    fontSize: 12,
    color: '#94a3b8',
  },
  warningBanner: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.3)',
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningText: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 13,
    marginVertical: 6,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    fontSize: 15,
    fontWeight: '500',
    color: '#f1f5f9',
  },
  searchContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
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
    marginVertical: 0,
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
  buttonPrimary: {
    backgroundColor: '#6366f1',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  buttonSecondary: {
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  buttonText: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  list: {
    marginTop: 10,
    flex: 1,
  },
  item: {
    padding: 16,
    marginBottom: 8,
    marginHorizontal: 20,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemMobile: {
    marginHorizontal: 8,
    padding: 12,
  },
  itemContent: {
    flex: 1,
    marginRight: 10,
  },
  itemTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 8,
    color: '#f1f5f9',
  },
  itemDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    width: 80,
  },
  detailValue: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
  },
  detailValueHighlight: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonEdit: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  buttonDelete: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  emptyState: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '85%',
  },
  modalClose: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
    color: '#f1f5f9',
  },
  modalButtons: {
    gap: 10,
    marginTop: 15,
  },
  toggleButton: {
    backgroundColor: '#6366f1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleButtonText: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 80,
  },
  unitPickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginTop: 10,
    marginBottom: 6,
  },
  unitPickerContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  unitGroup: {
    flex: 1,
  },
  unitGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  unitGroupLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  unitChipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  unitChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  unitChipActive: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f1',
  },
  unitChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  unitChipTextActive: {
    color: '#f1f5f9',
  },
});