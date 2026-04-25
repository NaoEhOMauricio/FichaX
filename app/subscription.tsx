import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

type Product = 'pro' | 'mesa' | 'delivery';

interface UserProfile {
  plan: string;
  mesa: boolean;
  delivery: boolean;
  expires_at: string | null;
  trial_ends_at: string | null;
  mesa_expires_at: string | null;
  delivery_expires_at: string | null;
}

function daysLeft(dateStr: string | null): number {
  if (!dateStr) return 0;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function Subscription() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<Product | null>(null);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/auth'); return; }
    const { data } = await supabase
      .from('user_profiles')
      .select('plan, mesa, delivery, expires_at, trial_ends_at, mesa_expires_at, delivery_expires_at')
      .eq('id', session.user.id)
      .maybeSingle();
    setProfile(data ?? null);
    setLoading(false);
  };

  const handleSubscribe = async (product: Product) => {
    setPaying(product);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        method: 'POST',
        body: { product },
      });
      if (error || !data?.init_point) {
        Alert.alert('Erro', data?.error || 'Não foi possível iniciar o pagamento.');
        return;
      }
      await WebBrowser.openBrowserAsync(data.init_point, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        showTitle: false,
      });
      // Recarrega perfil após retornar do checkout
      await loadProfile();
    } catch {
      Alert.alert('Erro', 'Verifique sua conexão e tente novamente.');
    } finally {
      setPaying(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const isPro          = profile?.plan === 'pro';
  const trial          = daysLeft(profile?.trial_ends_at ?? null);
  const proExpiring    = isPro ? daysLeft(profile?.expires_at ?? null) : 0;
  const isMesaActive   = profile?.mesa === true && daysLeft(profile?.mesa_expires_at ?? null) > 0;
  const isDelivActive  = profile?.delivery === true && daysLeft(profile?.delivery_expires_at ?? null) > 0;

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#94a3b8" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Assinatura</Text>
          <Text style={styles.headerSub}>FluxoX Pro</Text>
        </View>
        <View style={[styles.headerBadge, isPro ? styles.headerBadgePro : styles.headerBadgeFree]}>
          <Text style={styles.headerBadgeText}>{isPro ? 'PRO' : 'FREE'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Status do plano Pro */}
        <View style={[styles.statusCard, isPro ? styles.statusCardPro : styles.statusCardFree]}>
          <View style={styles.statusIconWrap}>
            <Ionicons
              name={isPro ? 'checkmark-circle' : trial > 0 ? 'hourglass-outline' : 'lock-closed-outline'}
              size={28}
              color={isPro ? '#22c55e' : trial > 0 ? '#f59e0b' : '#ef4444'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusPlan}>
              {isPro ? 'Plano Pro ativo' : trial > 0 ? `Trial — ${trial} dias restantes` : 'Trial expirado'}
            </Text>
            {isPro && profile?.expires_at && (
              <Text style={styles.statusSub}>
                Válido até {formatDate(profile.expires_at)}
                {proExpiring > 0 && proExpiring <= 7 &&
                  <Text style={{ color: '#f59e0b' }}> · renova em {proExpiring}d</Text>}
              </Text>
            )}
            {!isPro && trial > 0 && (
              <Text style={styles.statusSub}>Expira em {formatDate(profile?.trial_ends_at ?? null)}</Text>
            )}
            {!isPro && trial === 0 && (
              <Text style={[styles.statusSub, { color: '#ef4444' }]}>Assine para continuar usando</Text>
            )}
          </View>
        </View>

        {/* ── Plano Pro ── */}
        <Text style={styles.sectionTitle}>Plano base</Text>
        <View style={styles.productCard}>
          <View style={styles.productHeader}>
            <View style={[styles.productIconWrap, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
              <Ionicons name="flash-outline" size={20} color="#6366f1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>FluxoX Pro</Text>
              <Text style={styles.productDesc}>Acesso completo ao sistema</Text>
            </View>
            <View style={styles.priceWrap}>
              <Text style={styles.priceVal}>R$ 29<Text style={styles.priceCents}>,90</Text></Text>
              <Text style={styles.pricePer}>/mês</Text>
            </View>
          </View>

          {isPro ? (
            proExpiring > 0 && proExpiring <= 7 ? (
              <BuyButton label="Renovar Pro" loading={paying === 'pro'} onPress={() => handleSubscribe('pro')} />
            ) : (
              <View style={styles.activeRow}>
                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                <Text style={styles.activeText}>Ativo até {formatDate(profile?.expires_at ?? null)}</Text>
              </View>
            )
          ) : (
            <BuyButton label="Assinar Pro" loading={paying === 'pro'} onPress={() => handleSubscribe('pro')} />
          )}
        </View>

        {/* ── Add-ons (só visíveis com Pro ativo) ── */}
        <Text style={styles.sectionTitle}>Add-ons</Text>

        {!isPro && (
          <View style={styles.addonLocked}>
            <Ionicons name="lock-closed-outline" size={16} color="#64748b" />
            <Text style={styles.addonLockedText}>Disponíveis após assinar o plano Pro</Text>
          </View>
        )}

        {/* Mesa */}
        <View style={[styles.productCard, !isPro && styles.productCardDim]}>
          <View style={styles.productHeader}>
            <View style={[styles.productIconWrap, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
              <Ionicons name="restaurant-outline" size={20} color="#22c55e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>Add-on Mesas</Text>
              <Text style={styles.productDesc}>Comandas e consumação por mesa</Text>
            </View>
            <View style={styles.priceWrap}>
              <Text style={[styles.priceVal, { color: '#22c55e' }]}>R$ 6<Text style={styles.priceCents}>,99</Text></Text>
              <Text style={styles.pricePer}>/mês</Text>
            </View>
          </View>

          {isPro && (
            isMesaActive ? (
              <View style={styles.activeRow}>
                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                <Text style={styles.activeText}>Ativo até {formatDate(profile?.mesa_expires_at ?? null)}</Text>
              </View>
            ) : (
              <BuyButton label="Ativar Mesas" color="#22c55e" loading={paying === 'mesa'} onPress={() => handleSubscribe('mesa')} />
            )
          )}
        </View>

        {/* Delivery */}
        <View style={[styles.productCard, !isPro && styles.productCardDim]}>
          <View style={styles.productHeader}>
            <View style={[styles.productIconWrap, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
              <Ionicons name="bicycle-outline" size={20} color="#22c55e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>Add-on Delivery</Text>
              <Text style={styles.productDesc}>Pipeline de pedidos e entregas</Text>
            </View>
            <View style={styles.priceWrap}>
              <Text style={[styles.priceVal, { color: '#22c55e' }]}>R$ 6<Text style={styles.priceCents}>,99</Text></Text>
              <Text style={styles.pricePer}>/mês</Text>
            </View>
          </View>

          {isPro && (
            isDelivActive ? (
              <View style={styles.activeRow}>
                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                <Text style={styles.activeText}>Ativo até {formatDate(profile?.delivery_expires_at ?? null)}</Text>
              </View>
            ) : (
              <BuyButton label="Ativar Delivery" color="#22c55e" loading={paying === 'delivery'} onPress={() => handleSubscribe('delivery')} />
            )
          )}
        </View>

        <Text style={styles.payNote}>
          <Ionicons name="shield-checkmark-outline" size={12} color="#64748b" />
          {'  '}Pix · Cartão · via Mercado Pago
        </Text>

        {/* O que está incluído no Pro */}
        <Text style={styles.sectionTitle}>Incluído no Pro</Text>
        <View style={styles.card}>
          {[
            { icon: 'infinite-outline',  text: 'Acesso ilimitado ao FluxoX',         color: '#6366f1' },
            { icon: 'bar-chart-outline', text: 'Relatórios e backup de dados',        color: '#6366f1' },
            { icon: 'headset-outline',   text: 'Suporte prioritário',                 color: '#f59e0b' },
          ].map((f, i) => (
            <View key={i} style={[styles.featureRow, i > 0 && styles.featureRowBorder]}>
              <View style={[styles.featureIcon, { backgroundColor: `${f.color}18` }]}>
                <Ionicons name={f.icon as any} size={17} color={f.color} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Componente botão de compra ──────────────────────────────────────────────
function BuyButton({
  label, loading, onPress, color = '#6366f1',
}: {
  label: string; loading: boolean; onPress: () => void; color?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: color }, loading && styles.btnDisabled]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <>
          <Ionicons name="flash-outline" size={16} color="white" />
          <Text style={styles.btnText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },

  header: {
    backgroundColor: '#0f172a',
    paddingTop: 54,
    paddingBottom: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn:         { padding: 4 },
  headerTitle:     { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  headerSub:       { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  headerBadge:     { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  headerBadgePro:  { backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  headerBadgeFree: { backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  headerBadgeText: { fontSize: 11, fontWeight: '800', color: '#f1f5f9' },

  content: { paddingHorizontal: 16, paddingTop: 8 },

  statusCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1 },
  statusCardPro:  { backgroundColor: 'rgba(34,197,94,0.08)',  borderColor: 'rgba(34,197,94,0.25)' },
  statusCardFree: { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)' },
  statusIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  statusPlan:     { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  statusSub:      { fontSize: 12, color: '#94a3b8', marginTop: 3 },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 10, marginTop: 4, letterSpacing: 0.8, textTransform: 'uppercase' },

  productCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  productCardDim:   { opacity: 0.45 },
  productHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  productIconWrap:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  productName:      { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  productDesc:      { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  priceWrap:        { alignItems: 'flex-end' },
  priceVal:         { fontSize: 20, fontWeight: '800', color: '#6366f1' },
  priceCents:       { fontSize: 14, fontWeight: '700' },
  pricePer:         { fontSize: 11, color: '#64748b' },

  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  activeText: { fontSize: 13, color: '#22c55e', fontWeight: '600' },

  addonLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  addonLockedText: { fontSize: 13, color: '#64748b' },

  btn: {
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: 'white', fontSize: 15, fontWeight: '700' },

  payNote: { fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 20, textAlign: 'center' },

  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featureRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  featureRowBorder: { borderTopWidth: 1, borderTopColor: '#334155' },
  featureIcon:      { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  featureText:      { fontSize: 14, color: '#f1f5f9', flex: 1 },
});
