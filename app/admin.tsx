import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

const ADMIN_EMAIL = 'leonardo.clemente.braga@gmail.com';

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  phone: string;
  cpf: string;
  address: any;
  created_at: string;
  recipe_count: number;
  ingredient_count: number;
  plan: string;
  mesa: boolean;
  delivery: boolean;
  expires_at: string | null;
  trial_ends_at: string | null;
}

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const PlanBadge = ({ plan }: { plan: string }) => {
  const isPro = plan === 'pro';
  return (
    <View style={[styles.planBadge, isPro ? styles.planBadgePro : styles.planBadgeFree]}>
      <Text style={[styles.planBadgeText, isPro ? styles.planBadgeTextPro : styles.planBadgeTextFree]}>
        {isPro ? 'PRO' : 'FREE'}
      </Text>
    </View>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon as any} size={20} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export default function Admin() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterPlan, setFilterPlan] = useState<'all' | 'pro' | 'free'>('all');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email ?? '';
      if (email !== ADMIN_EMAIL) {
        setAuthChecked(true);
        setIsAdmin(false);
      } else {
        setIsAdmin(true);
        setAuthChecked(true);
        fetchData();
      }
    });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesRes, recipesRes, ingredientsRes, subRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('recipes').select('user_id'),
        supabase.from('ingredients').select('user_id'),
        supabase.from('user_profiles').select('*'),
      ]);

      if (profilesRes.error?.code === '42P01' || profilesRes.error?.code === 'PGRST116') {
        setSetupNeeded(true);
        setLoading(false);
        return;
      }

      const profiles = profilesRes.data ?? [];
      const recipes = recipesRes.data ?? [];
      const ingredients = ingredientsRes.data ?? [];
      const subs = subRes.data ?? [];

      const recipeCount: Record<string, number> = {};
      recipes.forEach((r: any) => { recipeCount[r.user_id] = (recipeCount[r.user_id] || 0) + 1; });

      const ingCount: Record<string, number> = {};
      ingredients.forEach((i: any) => { ingCount[i.user_id] = (ingCount[i.user_id] || 0) + 1; });

      const subMap: Record<string, any> = {};
      subs.forEach((s: any) => { subMap[s.user_id] = s; });

      const merged: UserProfile[] = profiles.map((p: any) => {
        const sub = subMap[p.id] ?? {};
        return {
          id: p.id,
          email: p.email ?? '',
          display_name: p.display_name ?? '',
          phone: p.phone ?? '',
          cpf: p.cpf ?? '',
          address: p.address ?? null,
          created_at: p.created_at ?? '',
          recipe_count: recipeCount[p.id] ?? 0,
          ingredient_count: ingCount[p.id] ?? 0,
          plan: sub.plan ?? 'free',
          mesa: sub.mesa ?? false,
          delivery: sub.delivery ?? false,
          expires_at: sub.expires_at ?? null,
          trial_ends_at: sub.trial_ends_at ?? null,
        };
      });

      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setUsers(merged);
    } catch (e) {
      setSetupNeeded(true);
    }
    setLoading(false);
  };

  if (!authChecked) return <View style={styles.centered}><ActivityIndicator color="#6366f1" size="large" /></View>;

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed" size={48} color="#ef4444" />
        <Text style={styles.deniedTitle}>Acesso restrito</Text>
        <Text style={styles.deniedSub}>Esta área é exclusiva do administrador.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
          <Text style={styles.backBtnText}>Voltar ao início</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (setupNeeded) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 32 }}>
        <Text style={styles.pageTitle}>Configuração necessária</Text>
        <Text style={styles.setupDesc}>
          Para o dashboard funcionar, rode o SQL abaixo no Supabase (SQL Editor):
        </Text>
        <View style={styles.sqlBox}>
          <Text style={styles.sqlText}>{SETUP_SQL}</Text>
        </View>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Ionicons name="refresh" size={16} color="white" />
          <Text style={styles.retryBtnText}>Verificar novamente</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const filtered = users.filter(u => {
    const matchSearch = !search || [u.email, u.display_name, u.cpf, u.phone]
      .some(f => f.toLowerCase().includes(search.toLowerCase()));
    const matchPlan = filterPlan === 'all' || u.plan === filterPlan;
    return matchSearch && matchPlan;
  });

  const totalPro = users.filter(u => u.plan === 'pro').length;
  const totalRecipes = users.reduce((s, u) => s + u.recipe_count, 0);
  const totalIngredients = users.reduce((s, u) => s + u.ingredient_count, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Dashboard Admin</Text>
          <Text style={styles.pageSubtitle}>Visão geral dos usuários cadastrados</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchData} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={18} color="#6366f1" />
          <Text style={styles.refreshBtnText}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard icon="people" label="Usuários" value={users.length} color="#6366f1" />
          <StatCard icon="star" label="Usuários Pro" value={totalPro} color="#f59e0b" />
          <StatCard icon="restaurant" label="Receitas" value={totalRecipes} color="#22c55e" />
          <StatCard icon="leaf" label="Ingredientes" value={totalIngredients} color="#06b6d4" />
        </View>

        {/* Filtros */}
        <View style={styles.filterRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome, email, CPF..."
              placeholderTextColor="#475569"
              value={search}
              onChangeText={setSearch}
            />
            {search !== '' && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color="#475569" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.planFilter}>
            {(['all', 'pro', 'free'] as const).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.planFilterBtn, filterPlan === p && styles.planFilterBtnActive]}
                onPress={() => setFilterPlan(p)}
              >
                <Text style={[styles.planFilterText, filterPlan === p && styles.planFilterTextActive]}>
                  {p === 'all' ? 'Todos' : p === 'pro' ? 'Pro' : 'Free'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tabela header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Usuário</Text>
          <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>Plano</Text>
          <Text style={[styles.th, { width: 70, textAlign: 'center' }]}>Receitas</Text>
          <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>Ingredientes</Text>
          <Text style={[styles.th, { width: 100, textAlign: 'right' }]}>Cadastro</Text>
          <Text style={[styles.th, { width: 40 }]}> </Text>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color="#6366f1" size="large" /></View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={40} color="#334155" />
            <Text style={styles.emptyText}>Nenhum usuário encontrado</Text>
          </View>
        ) : (
          filtered.map(user => {
            const expanded = expandedId === user.id;
            const initials = (user.display_name || user.email || '?').slice(0, 2).toUpperCase();
            return (
              <View key={user.id}>
                <TouchableOpacity
                  style={[styles.tableRow, expanded && styles.tableRowExpanded]}
                  onPress={() => setExpandedId(expanded ? null : user.id)}
                  activeOpacity={0.8}
                >
                  {/* Usuário */}
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {user.display_name || 'Sem nome'}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                    </View>
                  </View>
                  {/* Plano */}
                  <View style={{ width: 80, alignItems: 'center' }}>
                    <PlanBadge plan={user.plan} />
                  </View>
                  {/* Receitas */}
                  <Text style={[styles.td, { width: 70, textAlign: 'center' }]}>{user.recipe_count}</Text>
                  {/* Ingredientes */}
                  <Text style={[styles.td, { width: 80, textAlign: 'center' }]}>{user.ingredient_count}</Text>
                  {/* Cadastro */}
                  <Text style={[styles.td, { width: 100, textAlign: 'right', fontSize: 11 }]}>
                    {formatDate(user.created_at)}
                  </Text>
                  {/* Chevron */}
                  <View style={{ width: 40, alignItems: 'center' }}>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#475569" />
                  </View>
                </TouchableOpacity>

                {/* Detalhes expandidos */}
                {expanded && (
                  <View style={styles.expandedCard}>
                    <View style={styles.expandedGrid}>
                      <View style={styles.expandedSection}>
                        <Text style={styles.expandedSectionTitle}>Dados pessoais</Text>
                        <DetailRow icon="mail-outline" label="Email" value={user.email || '—'} />
                        <DetailRow icon="call-outline" label="Telefone" value={user.phone || '—'} />
                        <DetailRow icon="card-outline" label="CPF" value={user.cpf || '—'} />
                        {user.address?.rua ? (
                          <DetailRow
                            icon="location-outline"
                            label="Endereço"
                            value={`${user.address.rua}, ${user.address.numero}${user.address.complemento ? ` - ${user.address.complemento}` : ''} · ${user.address.bairro} · ${user.address.cidade}/${user.address.estado} · CEP ${user.address.cep}`}
                          />
                        ) : (
                          <DetailRow icon="location-outline" label="Endereço" value="Não informado" />
                        )}
                      </View>

                      <View style={styles.expandedSection}>
                        <Text style={styles.expandedSectionTitle}>Assinatura</Text>
                        <DetailRow icon="star-outline" label="Plano" value={user.plan.toUpperCase()} highlight={user.plan === 'pro'} />
                        <DetailRow icon="storefront-outline" label="Add-on Mesa" value={user.mesa ? 'Ativo' : 'Inativo'} highlight={user.mesa} />
                        <DetailRow icon="bicycle-outline" label="Add-on Delivery" value={user.delivery ? 'Ativo' : 'Inativo'} highlight={user.delivery} />
                        {user.expires_at && (
                          <DetailRow icon="calendar-outline" label="Expira em" value={formatDateTime(user.expires_at)} />
                        )}
                        {user.trial_ends_at && (
                          <DetailRow icon="hourglass-outline" label="Trial até" value={formatDateTime(user.trial_ends_at)} />
                        )}
                      </View>

                      <View style={styles.expandedSection}>
                        <Text style={styles.expandedSectionTitle}>Uso do app</Text>
                        <DetailRow icon="restaurant-outline" label="Receitas criadas" value={String(user.recipe_count)} />
                        <DetailRow icon="leaf-outline" label="Ingredientes" value={String(user.ingredient_count)} />
                        <DetailRow icon="calendar-outline" label="Membro desde" value={formatDateTime(user.created_at)} />
                        <DetailRow icon="finger-print-outline" label="ID" value={user.id.slice(0, 16) + '...'} mono />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value, highlight = false, mono = false }: {
  icon: string; label: string; value: string; highlight?: boolean; mono?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={14} color="#475569" style={{ marginTop: 1 }} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailValueHighlight, mono && { fontSize: 11 }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const SETUP_SQL = `-- 1. Criar tabela de perfis
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  phone text,
  cpf text,
  address jsonb,
  created_at timestamptz default now()
);

-- 2. Habilitar RLS
alter table public.profiles enable row level security;

-- 3. Políticas
create policy "Usuário vê próprio perfil"
  on public.profiles for select using (auth.uid() = id);

create policy "Admin vê todos os perfis"
  on public.profiles for select
  using (auth.jwt()->>'email' = 'leonardo.clemente.braga@gmail.com');

create policy "Usuário insere próprio perfil"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Usuário atualiza próprio perfil"
  on public.profiles for update using (auth.uid() = id);

-- 4. Admin lê todas as receitas
create policy "Admin vê todas as receitas"
  on public.recipes for select
  using (auth.jwt()->>'email' = 'leonardo.clemente.braga@gmail.com');

-- 5. Admin lê todos os ingredientes
create policy "Admin vê todos os ingredientes"
  on public.ingredients for select
  using (auth.jwt()->>'email' = 'leonardo.clemente.braga@gmail.com');

-- 6. Admin lê todos os user_profiles
create policy "Admin vê todos os user_profiles"
  on public.user_profiles for select
  using (auth.jwt()->>'email' = 'leonardo.clemente.braga@gmail.com');

-- 7. Trigger: preenche perfil automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, phone, cpf, address, created_at)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'cpf',
    (new.raw_user_meta_data->>'address')::jsonb,
    new.created_at
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. Importar usuários existentes (rodar uma vez)
insert into public.profiles (id, email, display_name, phone, cpf, address, created_at)
select
  id,
  email,
  raw_user_meta_data->>'display_name',
  raw_user_meta_data->>'phone',
  raw_user_meta_data->>'cpf',
  (raw_user_meta_data->>'address')::jsonb,
  created_at
from auth.users
on conflict (id) do nothing;`;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', gap: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 28, paddingHorizontal: 28, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#f1f5f9' },
  pageSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  refreshBtnText: { fontSize: 13, fontWeight: '600', color: '#6366f1' },

  statsRow: { flexDirection: 'row', gap: 14, padding: 24, paddingBottom: 0 },
  statCard: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 12,
    padding: 16, borderTopWidth: 3, borderWidth: 1, borderColor: '#334155', gap: 6,
  },
  statIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '800', color: '#f1f5f9' },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 16 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 8, borderWidth: 1,
    borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#f1f5f9', outlineStyle: 'none' } as any,
  planFilter: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 8, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  planFilterBtn: { paddingHorizontal: 14, paddingVertical: 9 },
  planFilterBtnActive: { backgroundColor: '#6366f1' },
  planFilterText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  planFilterTextActive: { color: 'white' },

  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 8,
    backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  th: { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },

  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 14,
    backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#0f172a',
  },
  tableRowExpanded: { backgroundColor: '#1e3a5f' },
  td: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(99,102,241,0.15)', borderWidth: 1.5,
    borderColor: 'rgba(99,102,241,0.3)', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800', color: '#c7d2fe' },
  userName: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  userEmail: { fontSize: 11, color: '#64748b', marginTop: 1 },

  planBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  planBadgePro: { backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)' },
  planBadgeFree: { backgroundColor: 'rgba(100,116,139,0.15)', borderWidth: 1, borderColor: '#334155' },
  planBadgeText: { fontSize: 10, fontWeight: '800' },
  planBadgeTextPro: { color: '#f59e0b' },
  planBadgeTextFree: { color: '#64748b' },

  expandedCard: { backgroundColor: '#0f172a', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  expandedGrid: { flexDirection: 'row', gap: 24 },
  expandedSection: { flex: 1, gap: 8 },
  expandedSectionTitle: { fontSize: 11, fontWeight: '700', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },

  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailLabel: { fontSize: 12, color: '#64748b', width: 80, flexShrink: 0 },
  detailValue: { fontSize: 12, color: '#e2e8f0', flex: 1, fontWeight: '500' },
  detailValueHighlight: { color: '#f59e0b', fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 15, color: '#475569', fontWeight: '600' },

  deniedTitle: { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  deniedSub: { fontSize: 14, color: '#64748b' },
  backBtn: { backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  backBtnText: { color: 'white', fontWeight: '700' },

  setupDesc: { fontSize: 14, color: '#94a3b8', marginBottom: 16, lineHeight: 20 },
  sqlBox: { backgroundColor: '#1e293b', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 20 },
  sqlText: { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', lineHeight: 18 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, alignSelf: 'flex-start' },
  retryBtnText: { color: 'white', fontWeight: '700' },
});
