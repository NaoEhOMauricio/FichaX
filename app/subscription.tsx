import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const FLUXOX_URL = 'https://fluxox.carrd.co/';

const FEATURES = [
  { icon: 'restaurant-outline',   color: '#6366f1', text: 'Fichas técnicas ilimitadas' },
  { icon: 'calculator-outline',   color: '#6366f1', text: 'Cálculo automático de custos e markup' },
  { icon: 'leaf-outline',         color: '#22c55e', text: 'Gestão completa de ingredientes' },
  { icon: 'document-text-outline',color: '#f59e0b', text: 'Exportação de PDF profissional' },
  { icon: 'storefront-outline',   color: '#22c55e', text: 'Add-on Mesas — comandas por mesa' },
  { icon: 'bicycle-outline',      color: '#06b6d4', text: 'Add-on Delivery — pipeline de pedidos' },
  { icon: 'bar-chart-outline',    color: '#a78bfa', text: 'Relatórios e backup de dados' },
  { icon: 'headset-outline',      color: '#f59e0b', text: 'Suporte prioritário' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function daysLeft(dateStr: string | null): number {
  if (!dateStr) return 0;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function Subscription() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [plan, setPlan] = useState<string>('free');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data } = await supabase
        .from('user_profiles')
        .select('plan, expires_at')
        .eq('id', session.user.id)
        .maybeSingle();
      if (data) {
        setPlan(data.plan ?? 'free');
        setExpiresAt(data.expires_at ?? null);
      }
      setLoading(false);
    };
    load();
  }, []);

  const isPro = plan === 'pro';
  const days  = daysLeft(expiresAt);

  const openFluxoX = () => window.open(FLUXOX_URL, '_blank');

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View>
          <Text style={styles.pageTitle}>Planos</Text>
          <Text style={styles.pageSubtitle}>Gerencie sua assinatura pelo FluxoX</Text>
        </View>
        <View style={[styles.planBadge, isPro ? styles.planBadgePro : styles.planBadgeFree]}>
          <Ionicons name={isPro ? 'star' : 'star-outline'} size={12} color={isPro ? '#f59e0b' : '#64748b'} />
          <Text style={[styles.planBadgeText, isPro ? styles.planBadgeTextPro : styles.planBadgeTextFree]}>
            {isPro ? 'PRO' : 'FREE'}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}>

        {/* Status atual */}
        <View style={[styles.statusCard, isPro ? styles.statusPro : styles.statusFree]}>
          <Ionicons
            name={isPro ? 'checkmark-circle' : 'information-circle-outline'}
            size={22}
            color={isPro ? '#22c55e' : '#f59e0b'}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              {isPro ? 'Plano Pro ativo' : 'Plano gratuito'}
            </Text>
            <Text style={styles.statusSub}>
              {isPro
                ? `Válido até ${formatDate(expiresAt)}${days <= 7 ? ` · renova em ${days} dias` : ''}`
                : 'Assine o Pro para acesso completo ao FichaX e FluxoX'}
            </Text>
          </View>
        </View>

        {/* Card FluxoX */}
        <View style={styles.fluxoxCard}>
          {/* Topo colorido */}
          <View style={styles.fluxoxCardTop}>
            <View style={styles.fluxoxLogoWrap}>
              <Text style={styles.fluxoxLogo}>Fluxo<Text style={{ color: '#FF9500' }}>X</Text></Text>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            </View>
            <Text style={styles.fluxoxTagline}>Sistema completo de gestão gastronômica</Text>
          </View>

          {/* Features */}
          <View style={styles.featureList}>
            {FEATURES.map((f, i) => (
              <View key={i} style={[styles.featureRow, i > 0 && styles.featureRowBorder]}>
                <View style={[styles.featureIconWrap, { backgroundColor: f.color + '18' }]}>
                  <Ionicons name={f.icon as any} size={16} color={f.color} />
                </View>
                <Text style={styles.featureText}>{f.text}</Text>
                <Ionicons name="checkmark" size={16} color="#22c55e" />
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity style={styles.ctaBtn} onPress={openFluxoX} activeOpacity={0.85}>
            <Ionicons name="flash" size={18} color="white" />
            <Text style={styles.ctaBtnText}>
              {isPro ? 'Gerenciar assinatura no FluxoX' : 'Assinar agora no FluxoX'}
            </Text>
            <Ionicons name="open-outline" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <Text style={styles.ctaNote}>
            Você será redirecionado para o site do FluxoX para concluir o pagamento.
          </Text>
        </View>

        {/* Nota de suporte */}
        <View style={styles.supportNote}>
          <Ionicons name="help-circle-outline" size={16} color="#475569" />
          <Text style={styles.supportNoteText}>
            Dúvidas? Acesse{' '}
            <Text style={styles.supportNoteLink} onPress={openFluxoX}>fluxox.carrd.co</Text>
            {' '}ou entre em contato com o suporte.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 28, paddingHorizontal: 28, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  headerMobile: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14 },
  pageTitle:    { fontSize: 22, fontWeight: '700', color: '#f1f5f9' },
  pageSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },

  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
  },
  planBadgePro:      { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.35)' },
  planBadgeFree:     { backgroundColor: 'rgba(100,116,139,0.1)', borderColor: '#334155' },
  planBadgeText:     { fontSize: 11, fontWeight: '800' },
  planBadgeTextPro:  { color: '#f59e0b' },
  planBadgeTextFree: { color: '#64748b' },

  content:       { paddingHorizontal: 28, paddingTop: 24 },
  contentMobile: { paddingHorizontal: 16, paddingTop: 16 },

  statusCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 14, padding: 16, marginBottom: 24, borderWidth: 1,
  },
  statusPro:   { backgroundColor: 'rgba(34,197,94,0.07)',  borderColor: 'rgba(34,197,94,0.2)' },
  statusFree:  { backgroundColor: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.2)' },
  statusTitle: { fontSize: 14, fontWeight: '700', color: '#f1f5f9', marginBottom: 2 },
  statusSub:   { fontSize: 12, color: '#94a3b8', lineHeight: 17 },

  fluxoxCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    marginBottom: 20,
    maxWidth: 600,
    alignSelf: 'flex-start' as const,
    width: '100%' as any,
  },
  fluxoxCardTop: {
    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    backgroundColor: '#4f46e5',
    padding: 24,
    paddingBottom: 20,
  } as any,
  fluxoxLogoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  fluxoxLogo: { fontSize: 28, fontWeight: '900', color: 'white', letterSpacing: -1 },
  proBadge: {
    backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  proBadgeText: { fontSize: 10, fontWeight: '900', color: 'white', letterSpacing: 1 },
  fluxoxTagline: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },

  featureList: { paddingHorizontal: 20, paddingVertical: 8 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11,
  },
  featureRowBorder: { borderTopWidth: 1, borderTopColor: '#0f172a' },
  featureIconWrap: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  featureText: { flex: 1, fontSize: 13, color: '#e2e8f0', fontWeight: '500' },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6366f1',
    marginHorizontal: 20, marginTop: 8, marginBottom: 4,
    paddingVertical: 15, borderRadius: 14,
  },
  ctaBtnText: { fontSize: 15, fontWeight: '700', color: 'white', flex: 1, textAlign: 'center' },
  ctaNote: { fontSize: 11, color: '#475569', textAlign: 'center', padding: 12, paddingBottom: 20 },

  supportNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#334155',
    maxWidth: 600, width: '100%' as any,
  },
  supportNoteText: { flex: 1, fontSize: 13, color: '#64748b', lineHeight: 19 },
  supportNoteLink: { color: '#6366f1', fontWeight: '600' },
});
