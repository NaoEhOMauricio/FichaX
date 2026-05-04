import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, TouchableOpacity,
  ScrollView, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [success, setSuccess] = useState(false);

  const [onboardName, setOnboardName] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('');
  const [onboardCpf, setOnboardCpf] = useState('');
  const [onboardAddress, setOnboardAddress] = useState({
    cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  });
  const [cepLoading, setCepLoading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const fieldPositions = useRef<Record<string, number>>({});
  const scrollToField = (field: string) => {
    const y = fieldPositions.current[field];
    if (y !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 120), animated: true });
    }
  };
  const trackField = (field: string) => (e: any) => {
    fieldPositions.current[field] = e.nativeEvent.layout.y;
  };

  useEffect(() => {
    checkSession();
    // Escuta SIGNED_IN do magic link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Chegou via magic link — exibe o formulário independente de onboarding_complete
        setChecking(false);
      } else if (!session && event !== 'INITIAL_SESSION') {
        // Sem sessão → vai pro login
        router.replace('/auth');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Sessão ativa — exibe o formulário
      setChecking(false);
    }
    // Se não há sessão, aguarda o onAuthStateChange processar o token do magic link
  };

  // ── Máscaras ──
  const formatPhoneBR = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatCPF = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const validateCPF = (value: string): boolean => {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
    let remainder = sum % 11;
    const d1 = remainder < 2 ? 0 : 11 - remainder;
    if (d1 !== parseInt(digits[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
    remainder = sum % 11;
    const d2 = remainder < 2 ? 0 : 11 - remainder;
    return d2 === parseInt(digits[10]);
  };

  const formatCEP = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const fetchAddressByCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        setOnboardAddress(prev => ({
          ...prev,
          rua: data.logradouro || prev.rua,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
          complemento: data.complemento || prev.complemento,
        }));
      }
    } catch { }
    setCepLoading(false);
  };

  const handleCompleteOnboarding = async () => {
    if (!onboardName.trim()) {
      Alert.alert('Erro', 'Digite seu nome completo.');
      return;
    }
    if (onboardPhone.replace(/\D/g, '').length < 10) {
      Alert.alert('Erro', 'Digite um telefone válido.');
      return;
    }
    if (!validateCPF(onboardCpf)) {
      Alert.alert('Erro', 'CPF inválido. Verifique o número digitado.');
      return;
    }
    if (!onboardAddress.cep || !onboardAddress.rua || !onboardAddress.numero || !onboardAddress.bairro || !onboardAddress.cidade || !onboardAddress.estado) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios do endereço.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        display_name: onboardName.trim(),
        phone: onboardPhone,
        cpf: onboardCpf,
        address: onboardAddress,
        onboarding_complete: true,
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.replace('/'), 2500);
    }
  };

  if (checking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={{ color: '#94a3b8', marginTop: 16 }}>Verificando acesso...</Text>
      </View>
    );
  }

  if (success) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={styles.successBox}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
          </View>
          <Text style={styles.successTitle}>Cadastro concluído! 🎉</Text>
          <Text style={styles.successSubtitle}>Seus dados foram salvos com sucesso.{`\n`}Redirecionando para o início...</Text>
          <ActivityIndicator color="#22c55e" style={{ marginTop: 20 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.authScroll, !isMobile && styles.authScrollDesktop]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authHeader}>
          <View style={[styles.authIconCircle, { backgroundColor: '#22c55e' }]}>
            <Ionicons name="person-add" size={36} color="white" />
          </View>
          <Text style={styles.authTitle}>Complete seu cadastro</Text>
          <Text style={styles.authSubtitle}>Precisamos de mais algumas informações</Text>
        </View>

        <View style={[styles.formCard, !isMobile && styles.formCardDesktop]}>
          {/* Nome completo */}
          <View onLayout={trackField('nome')}>
            <Text style={styles.inputLabel}>Nome completo *</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="Seu nome completo"
                placeholderTextColor="#94a3b8"
                value={onboardName}
                onChangeText={setOnboardName}
                autoCapitalize="words"
                returnKeyType="next"
                onFocus={() => scrollToField('nome')}
              />
            </View>
          </View>

          {/* Telefone */}
          <View onLayout={trackField('telefone')}>
            <Text style={styles.inputLabel}>Telefone *</Text>
            <View style={styles.inputRow}>
              <Ionicons name="call-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="(00) 00000-0000"
                placeholderTextColor="#94a3b8"
                value={onboardPhone}
                onChangeText={(t) => setOnboardPhone(formatPhoneBR(t))}
                keyboardType="phone-pad"
                maxLength={15}
                onFocus={() => scrollToField('telefone')}
              />
            </View>
          </View>

          {/* CPF */}
          <View onLayout={trackField('cpf')}>
            <Text style={styles.inputLabel}>CPF *</Text>
            <View style={styles.inputRow}>
              <Ionicons name="card-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="000.000.000-00"
                placeholderTextColor="#94a3b8"
                value={onboardCpf}
                onChangeText={(t) => setOnboardCpf(formatCPF(t))}
                keyboardType="number-pad"
                maxLength={14}
                onFocus={() => scrollToField('cpf')}
              />
            </View>
            {onboardCpf.replace(/\D/g, '').length === 11 && !validateCPF(onboardCpf) && (
              <Text style={styles.errorHint}>CPF inválido</Text>
            )}
          </View>

          {/* Endereço */}
          <View style={styles.onboardSectionHeader}>
            <Ionicons name="location-outline" size={20} color="#6366f1" />
            <Text style={styles.onboardSectionTitle}>Endereço</Text>
          </View>

          {/* CEP */}
          <View onLayout={trackField('cep')}>
            <Text style={styles.inputLabel}>CEP *</Text>
            <View style={styles.inputRow}>
              <Ionicons name="map-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="00000-000"
                placeholderTextColor="#94a3b8"
                value={onboardAddress.cep}
                onChangeText={(t) => {
                  const formatted = formatCEP(t);
                  setOnboardAddress(prev => ({ ...prev, cep: formatted }));
                  if (t.replace(/\D/g, '').length === 8) fetchAddressByCep(t);
                }}
                keyboardType="number-pad"
                maxLength={9}
                onFocus={() => scrollToField('cep')}
              />
              {cepLoading && <ActivityIndicator size="small" color="#6366f1" />}
            </View>
          </View>

          {/* Rua */}
          <View onLayout={trackField('rua')}>
            <Text style={styles.inputLabel}>Rua / Logradouro *</Text>
            <View style={styles.inputRow}>
              <Ionicons name="navigate-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="Ex: Rua das Flores"
                placeholderTextColor="#94a3b8"
                value={onboardAddress.rua}
                onChangeText={(t) => setOnboardAddress(prev => ({ ...prev, rua: t }))}
                returnKeyType="next"
                onFocus={() => scrollToField('rua')}
              />
            </View>
          </View>

          {/* Número + Complemento */}
          <View style={styles.rowFields} onLayout={trackField('numero')}>
            <View style={styles.halfField}>
              <Text style={styles.inputLabel}>Número *</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputField}
                  placeholder="123"
                  placeholderTextColor="#94a3b8"
                  value={onboardAddress.numero}
                  onChangeText={(t) => setOnboardAddress(prev => ({ ...prev, numero: t }))}
                  returnKeyType="next"
                  onFocus={() => scrollToField('numero')}
                />
              </View>
            </View>
            <View style={styles.halfField}>
              <Text style={styles.inputLabel}>Complemento</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Apto, Sala..."
                  placeholderTextColor="#94a3b8"
                  value={onboardAddress.complemento}
                  onChangeText={(t) => setOnboardAddress(prev => ({ ...prev, complemento: t }))}
                  returnKeyType="next"
                />
              </View>
            </View>
          </View>

          {/* Bairro */}
          <View onLayout={trackField('bairro')}>
            <Text style={styles.inputLabel}>Bairro *</Text>
            <View style={styles.inputRow}>
              <Ionicons name="business-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="Ex: Centro"
                placeholderTextColor="#94a3b8"
                value={onboardAddress.bairro}
                onChangeText={(t) => setOnboardAddress(prev => ({ ...prev, bairro: t }))}
                returnKeyType="next"
                onFocus={() => scrollToField('bairro')}
              />
            </View>
          </View>

          {/* Cidade + UF */}
          <View style={styles.rowFields} onLayout={trackField('cidade')}>
            <View style={{ flex: 2 }}>
              <Text style={styles.inputLabel}>Cidade *</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Ex: São Paulo"
                  placeholderTextColor="#94a3b8"
                  value={onboardAddress.cidade}
                  onChangeText={(t) => setOnboardAddress(prev => ({ ...prev, cidade: t }))}
                  returnKeyType="next"
                  onFocus={() => scrollToField('cidade')}
                />
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.inputLabel}>UF *</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputField}
                  placeholder="SP"
                  placeholderTextColor="#94a3b8"
                  value={onboardAddress.estado}
                  onChangeText={(t) => setOnboardAddress(prev => ({ ...prev, estado: t.toUpperCase().slice(0, 2) }))}
                  maxLength={2}
                  autoCapitalize="characters"
                  returnKeyType="done"
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled, { backgroundColor: '#22c55e' }]}
            onPress={handleCompleteOnboarding}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="white" />
              : <Text style={styles.primaryBtnText}>Concluir cadastro</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  authScrollDesktop: {
    alignItems: 'center',
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  authIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 6,
  },
  authSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    gap: 14,
  },
  formCardDesktop: {
    width: '100%',
    maxWidth: 520,
  },
  inputLabel: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 6,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 15,
    height: '100%',
  },
  errorHint: {
    fontSize: 12,
    color: '#f87171',
    marginTop: 4,
  },
  onboardSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  onboardSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#a5b4fc',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  successBox: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#22c55e33',
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 10,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
  },
});
