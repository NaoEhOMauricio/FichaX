import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, TouchableOpacity,
  ScrollView, Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

type ProfileTab = 'perfil' | 'seguranca' | 'sessoes';

export default function Auth() {
  const router = useRouter();
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Profile state
  const [activeTab, setActiveTab] = useState<ProfileTab>('perfil');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');

  // Security modals
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Change password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Change email fields
  const [newEmail, setNewEmail] = useState('');
  const [emailConfirmPassword, setEmailConfirmPassword] = useState('');

  // Delete account
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Reset password
  const [resetEmail, setResetEmail] = useState('');

  // Edit profile modal
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Address fields
  const [address, setAddress] = useState({
    cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  });
  const [editAddress, setEditAddress] = useState({
    cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  });

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardName, setOnboardName] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('');
  const [onboardAddress, setOnboardAddress] = useState({
    cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  });
  const [cepLoading, setCepLoading] = useState(false);

  // Refs para auto-scroll nos formulários
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

  // Activity history
  interface ActivityItem {
    id: string;
    icon: string;
    color: string;
    title: string;
    detail: string;
    date: Date;
  }
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);

  // Sessions
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setDisplayName(session.user.user_metadata?.display_name || '');
        setPhone(session.user.user_metadata?.phone || '');
        setAddress(session.user.user_metadata?.address || { cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' });
        if (!session.user.user_metadata?.onboarding_complete) {
          setShowOnboarding(true);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      setDisplayName(session.user.user_metadata?.display_name || '');
      setPhone(session.user.user_metadata?.phone || '');
      setAddress(session.user.user_metadata?.address || { cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' });
      // Verificar se precisa de onboarding
      if (!session.user.user_metadata?.onboarding_complete) {
        setShowOnboarding(true);
      }
    }
  };

  // ── Máscara telefone BR ──
  const formatPhoneBR = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (text: string, setter: (v: string) => void) => {
    setter(formatPhoneBR(text));
  };

  // ── Máscara CEP ──
  const formatCEP = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  // ── Buscar endereço por CEP (ViaCEP) ──
  const fetchAddressByCep = async (cep: string, setter: (v: any) => void) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        setter((prev: any) => ({
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

  const ESTADOS_BR = [
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
  ];

  // ── Completar onboarding ──
  const handleCompleteOnboarding = async () => {
    if (!onboardName.trim()) {
      Alert.alert('Erro', 'Digite seu nome completo.');
      return;
    }
    if (onboardPhone.replace(/\D/g, '').length < 10) {
      Alert.alert('Erro', 'Digite um telefone válido.');
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
        address: onboardAddress,
        onboarding_complete: true,
      },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      setDisplayName(onboardName.trim());
      setPhone(onboardPhone);
      setAddress(onboardAddress);
      setShowOnboarding(false);
      addActivity('person-add-outline', '#4CAF50', 'Cadastro completo', 'Dados pessoais e endereço preenchidos');
      Alert.alert('Bem-vindo! 🎉', 'Seu cadastro foi concluído com sucesso.');
    }
  };

  // ── Adicionar atividade ──
  const addActivity = (icon: string, color: string, title: string, detail: string) => {
    setActivityLog(prev => [{
      id: Date.now().toString(),
      icon, color, title, detail,
      date: new Date(),
    }, ...prev].slice(0, 20));
  };

  // ── Validação ──
  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const validatePassword = (p: string) => {
    const checks = {
      length: p.length >= 8,
      upper: /[A-Z]/.test(p),
      lower: /[a-z]/.test(p),
      number: /[0-9]/.test(p),
    };
    return checks;
  };

  const isPasswordStrong = (p: string) => {
    const c = validatePassword(p);
    return c.length && c.upper && c.lower && c.number;
  };

  const getPasswordStrength = (p: string): { label: string; color: string; percent: number } => {
    if (!p) return { label: '', color: '#ccc', percent: 0 };
    const c = validatePassword(p);
    const score = [c.length, c.upper, c.lower, c.number].filter(Boolean).length;
    if (score <= 1) return { label: 'Fraca', color: '#f44336', percent: 25 };
    if (score === 2) return { label: 'Razoável', color: '#FF9800', percent: 50 };
    if (score === 3) return { label: 'Boa', color: '#FFC107', percent: 75 };
    return { label: 'Forte', color: '#4CAF50', percent: 100 };
  };

  // ── Autenticação ──
  const handleAuth = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Erro', 'Digite um e-mail válido.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (isSignUp) {
      if (!isPasswordStrong(password)) {
        Alert.alert('Erro', 'A senha deve ter pelo menos 8 caracteres, com maiúscula, minúscula e número.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Erro', 'As senhas não coincidem.');
        return;
      }
    }

    setLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
          data: { display_name: '', phone: '' },
        },
      });
      if (error) Alert.alert('Erro no cadastro', error.message);
      else Alert.alert(
        'Verifique seu e-mail 📧',
        'Enviamos um link de confirmação para ' + email + '. Clique no link para ativar sua conta.',
        [{ text: 'OK', onPress: () => router.replace('/') }],
      );
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert('Erro ao entrar', error.message);
      else {
        checkUser();
        addActivity('log-in-outline', '#007AFF', 'Login realizado', 'Acesso via e-mail e senha');
      }
    }
    setLoading(false);
  };

  // ── Alterar senha ──
  const handleChangePassword = async () => {
    if (!newPassword || !confirmNewPassword) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }
    if (!isPasswordStrong(newPassword)) {
      Alert.alert('Erro', 'A nova senha deve ter pelo menos 8 caracteres, com maiúscula, minúscula e número.');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('Erro', 'A nova senha deve ser diferente da atual.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    setLoading(true);
    // Reautenticar com senha atual
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      setLoading(false);
      Alert.alert('Erro', 'Senha atual incorreta.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      Alert.alert('Sucesso ✅', 'Senha alterada com sucesso.');
      addActivity('key-outline', '#007AFF', 'Senha alterada', 'Senha da conta foi atualizada');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };

  // ── Alterar e-mail ──
  const handleChangeEmail = async () => {
    if (!validateEmail(newEmail)) {
      Alert.alert('Erro', 'Digite um e-mail válido.');
      return;
    }
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      Alert.alert('Erro', 'O novo e-mail deve ser diferente do atual.');
      return;
    }

    setLoading(true);
    // Reautenticar
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: emailConfirmPassword,
    });
    if (signInError) {
      setLoading(false);
      Alert.alert('Erro', 'Senha incorreta.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setLoading(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      Alert.alert(
        'Confirmação necessária 📧',
        'Enviamos um link de confirmação para ' + newEmail + '. Verifique sua caixa de entrada (e spam) para confirmar a alteração.',
      );
      addActivity('mail-outline', '#FF9800', 'Alteração de e-mail', 'Confirmação enviada para ' + newEmail);
      setShowChangeEmail(false);
      setNewEmail('');
      setEmailConfirmPassword('');
    }
  };

  // ── Recuperar senha ──
  const handleResetPassword = async () => {
    if (!validateEmail(resetEmail)) {
      Alert.alert('Erro', 'Digite um e-mail válido.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail);
    setLoading(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      Alert.alert(
        'E-mail enviado 📧',
        'Se uma conta existir com este e-mail, você receberá um link para redefinir sua senha.',
      );
      setShowResetPassword(false);
      setResetEmail('');
    }
  };

  // ── Excluir conta ──
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'EXCLUIR') {
      Alert.alert('Erro', 'Digite EXCLUIR para confirmar.');
      return;
    }
    Alert.alert(
      'Última confirmação',
      'Esta ação é IRREVERSÍVEL. Todos os seus dados serão perdidos. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir permanentemente',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              if (currentUser) {
                // Deletar dados do usuário nas tabelas
                await supabase.from('recipes').delete().eq('user_id', currentUser.id);
                await supabase.from('ingredients').delete().eq('user_id', currentUser.id);
              }
              await supabase.auth.signOut();
              setUser(null);
              setShowDeleteAccount(false);
              setDeleteConfirmText('');
              Alert.alert(
                'Conta desativada',
                'Seus dados foram removidos. A exclusão completa da conta de autenticação será processada automaticamente.',
              );
            } catch (e: any) {
              Alert.alert('Erro', 'Não foi possível excluir os dados: ' + e.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // ── Logout ──
  const handleLogout = () => {
    Alert.alert('Sair da conta', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          setUser(null);
          setEmail('');
          setPassword('');
          setActiveTab('perfil');
        },
      },
    ]);
  };

  // ── Atualizar perfil ──
  const handleUpdateProfile = async () => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: { display_name: editName, phone: editPhone, address: editAddress },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      setDisplayName(editName);
      setPhone(editPhone);
      setAddress(editAddress);
      const changes: string[] = [];
      if (editName !== displayName) changes.push('nome');
      if (editPhone !== phone) changes.push('telefone');
      if (JSON.stringify(editAddress) !== JSON.stringify(address)) changes.push('endereço');
      addActivity('create-outline', '#4CAF50', 'Perfil atualizado', changes.length ? 'Alterado: ' + changes.join(', ') : 'Dados salvos');
      Alert.alert('Sucesso ✅', 'Perfil atualizado.');
      setShowEditProfile(false);
    }
  };

  const openEditProfile = () => {
    setEditName(displayName);
    setEditPhone(phone);
    setEditAddress({ ...address });
    setShowEditProfile(true);
  };

  const formatActivityTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin} min atrás`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h atrás`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // ── Componentes auxiliares ──
  const PasswordStrengthBar = ({ value }: { value: string }) => {
    const s = getPasswordStrength(value);
    if (!value) return null;
    return (
      <View style={styles.strengthContainer}>
        <View style={styles.strengthBarBg}>
          <View style={[styles.strengthBarFill, { width: `${s.percent}%`, backgroundColor: s.color }]} />
        </View>
        <Text style={[styles.strengthLabel, { color: s.color }]}>{s.label}</Text>
      </View>
    );
  };

  const PasswordRequirements = ({ value }: { value: string }) => {
    if (!value) return null;
    const c = validatePassword(value);
    const items = [
      { ok: c.length, label: 'Mínimo 8 caracteres' },
      { ok: c.upper, label: 'Letra maiúscula' },
      { ok: c.lower, label: 'Letra minúscula' },
      { ok: c.number, label: 'Número' },
    ];
    return (
      <View style={styles.reqContainer}>
        {items.map((item, i) => (
          <View key={i} style={styles.reqRow}>
            <Ionicons name={item.ok ? 'checkmark-circle' : 'close-circle'} size={16} color={item.ok ? '#4CAF50' : '#ccc'} />
            <Text style={[styles.reqText, item.ok && styles.reqTextOk]}>{item.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  // ══════════════════════════════════════
  // TELA DE LOGIN / CADASTRO
  // ══════════════════════════════════════
  if (!user) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.authHeader}>
            <View style={styles.authIconCircle}>
              <Ionicons name={isSignUp ? 'person-add' : 'lock-closed'} size={36} color="white" />
            </View>
            <Text style={styles.authTitle}>{isSignUp ? 'Criar conta' : 'Entrar'}</Text>
            <Text style={styles.authSubtitle}>
              {isSignUp ? 'Preencha os dados para se cadastrar' : 'Acesse sua conta FichaX'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>E-mail</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="seu@email.com"
                placeholderTextColor="#bbb"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            <Text style={styles.inputLabel}>Senha</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="Sua senha"
                placeholderTextColor="#bbb"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#999" />
              </TouchableOpacity>
            </View>
            {isSignUp && <PasswordStrengthBar value={password} />}
            {isSignUp && <PasswordRequirements value={password} />}

            {isSignUp && (
              <>
                <Text style={styles.inputLabel}>Confirmar senha</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Repita a senha"
                    placeholderTextColor="#bbb"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                  />
                </View>
                {confirmPassword !== '' && password !== confirmPassword && (
                  <Text style={styles.errorHint}>As senhas não coincidem</Text>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.primaryBtnText}>{isSignUp ? 'Cadastrar' : 'Entrar'}</Text>
              )}
            </TouchableOpacity>

            {!isSignUp && (
              <TouchableOpacity onPress={() => { setResetEmail(email); setShowResetPassword(true); }}>
                <Text style={styles.linkText}>Esqueceu sua senha?</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setConfirmPassword(''); }} style={styles.switchBtn}>
            <Text style={styles.switchText}>
              {isSignUp ? 'Já tem uma conta? ' : 'Não tem conta? '}
              <Text style={styles.switchTextBold}>{isSignUp ? 'Entrar' : 'Cadastrar'}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Modal: Recuperar senha */}
        <Modal visible={showResetPassword} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Ionicons name="key-outline" size={28} color="#007AFF" />
                <Text style={styles.modalTitle}>Recuperar senha</Text>
                <TouchableOpacity onPress={() => setShowResetPassword(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color="#999" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalDesc}>
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
              </Text>
              <Text style={styles.inputLabel}>E-mail</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="seu@email.com"
                  placeholderTextColor="#bbb"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="white" /> : (
                  <Text style={styles.primaryBtnText}>Enviar link de recuperação</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // ══════════════════════════════════════
  // TELA DE ONBOARDING (primeiro acesso)
  // ══════════════════════════════════════
  if (user && showOnboarding) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.authHeader}>
            <View style={[styles.authIconCircle, { backgroundColor: '#4CAF50' }]}>
              <Ionicons name="person-add" size={36} color="white" />
            </View>
            <Text style={styles.authTitle}>Complete seu cadastro</Text>
            <Text style={styles.authSubtitle}>Precisamos de mais algumas informações</Text>
          </View>

          <View style={styles.formCard}>
            {/* Nome completo */}
            <View onLayout={trackField('nome')}>
              <Text style={styles.inputLabel}>Nome completo *</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Seu nome completo"
                  placeholderTextColor="#bbb"
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
                <Ionicons name="call-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor="#bbb"
                  value={onboardPhone}
                  onChangeText={(t) => handlePhoneChange(t, setOnboardPhone)}
                  keyboardType="phone-pad"
                  maxLength={15}
                  onFocus={() => scrollToField('telefone')}
                />
              </View>
            </View>

            {/* Endereço */}
            <View style={styles.onboardSectionHeader}>
              <Ionicons name="location-outline" size={20} color="#007AFF" />
              <Text style={styles.onboardSectionTitle}>Endereço</Text>
            </View>

            {/* CEP */}
            <View onLayout={trackField('cep')}>
              <Text style={styles.inputLabel}>CEP *</Text>
              <View style={styles.inputRow}>
                <Ionicons name="map-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="00000-000"
                  placeholderTextColor="#bbb"
                  value={onboardAddress.cep}
                  onChangeText={(t) => {
                    const formatted = formatCEP(t);
                    setOnboardAddress(prev => ({ ...prev, cep: formatted }));
                    if (t.replace(/\D/g, '').length === 8) fetchAddressByCep(t, setOnboardAddress);
                  }}
                  keyboardType="number-pad"
                  maxLength={9}
                  onFocus={() => scrollToField('cep')}
                />
                {cepLoading && <ActivityIndicator size="small" color="#007AFF" />}
              </View>
            </View>

            {/* Rua */}
            <View onLayout={trackField('rua')}>
              <Text style={styles.inputLabel}>Rua / Logradouro *</Text>
              <View style={styles.inputRow}>
                <Ionicons name="navigate-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Ex: Rua das Flores"
                  placeholderTextColor="#bbb"
                  value={onboardAddress.rua}
                  onChangeText={(t) => setOnboardAddress(prev => ({ ...prev, rua: t }))}
                  returnKeyType="next"
                  onFocus={() => scrollToField('rua')}
                />
              </View>
            </View>

            {/* Número + Complemento (lado a lado) */}
            <View style={styles.rowFields} onLayout={trackField('numero')}>
              <View style={styles.halfField}>
                <Text style={styles.inputLabel}>Número *</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.inputField}
                    placeholder="123"
                    placeholderTextColor="#bbb"
                    value={onboardAddress.numero}
                    onChangeText={(t) => setOnboardAddress(prev => ({ ...prev, numero: t }))}
                    keyboardType="default"
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
                    placeholderTextColor="#bbb"
                    value={onboardAddress.complemento}
                    onChangeText={(t) => setOnboardAddress(prev => ({ ...prev, complemento: t }))}
                    returnKeyType="next"
                    onFocus={() => scrollToField('numero')}
                  />
                </View>
              </View>
            </View>

            {/* Bairro */}
            <View onLayout={trackField('bairro')}>
              <Text style={styles.inputLabel}>Bairro *</Text>
              <View style={styles.inputRow}>
                <Ionicons name="business-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Ex: Centro"
                  placeholderTextColor="#bbb"
                  value={onboardAddress.bairro}
                  onChangeText={(t) => setOnboardAddress(prev => ({ ...prev, bairro: t }))}
                  returnKeyType="next"
                  onFocus={() => scrollToField('bairro')}
                />
              </View>
            </View>

            {/* Cidade + Estado */}
            <View style={styles.rowFields} onLayout={trackField('cidade')}>
              <View style={{ flex: 2 }}>
                <Text style={styles.inputLabel}>Cidade *</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Ex: São Paulo"
                    placeholderTextColor="#bbb"
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
                    placeholderTextColor="#bbb"
                    value={onboardAddress.estado}
                    onChangeText={(t) => setOnboardAddress(prev => ({ ...prev, estado: t.toUpperCase().slice(0, 2) }))}
                    maxLength={2}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onFocus={() => scrollToField('cidade')}
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled, { backgroundColor: '#4CAF50' }]}
              onPress={handleCompleteOnboarding}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="white" /> : (
                <>
                  <Text style={styles.primaryBtnText}>Concluir cadastro</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ══════════════════════════════════════
  // TELA DE PERFIL (logado)
  // ══════════════════════════════════════
  const createdAt = user.created_at ? new Date(user.created_at) : null;
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
  const emailConfirmed = !!user.email_confirmed_at;
  const initials = (displayName || user.email || '??').slice(0, 2).toUpperCase();

  return (
    <View style={styles.container}>
      {/* Header perfil */}
      <View style={styles.profileHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.profileName}>{displayName || 'Usuário'}</Text>
        <View style={styles.emailBadgeRow}>
          <Text style={styles.profileEmail}>{user.email}</Text>
          {emailConfirmed ? (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
              <Text style={styles.verifiedText}>Verificado</Text>
            </View>
          ) : (
            <View style={styles.unverifiedBadge}>
              <Ionicons name="alert-circle" size={14} color="#FF9800" />
              <Text style={styles.unverifiedText}>Não verificado</Text>
            </View>
          )}
        </View>
        {createdAt && (
          <Text style={styles.profileMeta}>
            Membro desde {createdAt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </Text>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {([
          { key: 'perfil' as ProfileTab, icon: 'person-outline', label: 'Perfil' },
          { key: 'seguranca' as ProfileTab, icon: 'shield-checkmark-outline', label: 'Segurança' },
          { key: 'sessoes' as ProfileTab, icon: 'time-outline', label: 'Sessão' },
        ]).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons name={tab.icon as any} size={18} color={activeTab === tab.key ? '#007AFF' : '#999'} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* ── Tab: Perfil ── */}
        {activeTab === 'perfil' && (
          <View>
            <Text style={styles.sectionTitle}>Informações pessoais</Text>
            <View style={styles.card}>
              <View style={styles.profileInfoRow}>
                <Ionicons name="person-outline" size={20} color="#007AFF" />
                <View style={styles.profileInfoContent}>
                  <Text style={styles.profileInfoLabel}>Nome</Text>
                  <Text style={styles.profileInfoValue}>{displayName || 'Não informado'}</Text>
                </View>
              </View>
              <View style={styles.profileInfoDivider} />
              <View style={styles.profileInfoRow}>
                <Ionicons name="call-outline" size={20} color="#007AFF" />
                <View style={styles.profileInfoContent}>
                  <Text style={styles.profileInfoLabel}>Telefone</Text>
                  <Text style={styles.profileInfoValue}>{phone || 'Não informado'}</Text>
                </View>
              </View>
              <View style={styles.profileInfoDivider} />
              <View style={styles.profileInfoRow}>
                <Ionicons name="mail-outline" size={20} color="#007AFF" />
                <View style={styles.profileInfoContent}>
                  <Text style={styles.profileInfoLabel}>E-mail</Text>
                  <Text style={styles.profileInfoValue}>{user.email}</Text>
                </View>
              </View>
              {address.rua ? (
                <>
                  <View style={styles.profileInfoDivider} />
                  <View style={styles.profileInfoRow}>
                    <Ionicons name="location-outline" size={20} color="#007AFF" />
                    <View style={styles.profileInfoContent}>
                      <Text style={styles.profileInfoLabel}>Endereço</Text>
                      <Text style={styles.profileInfoValue}>
                        {address.rua}, {address.numero}{address.complemento ? ` - ${address.complemento}` : ''}
                      </Text>
                      <Text style={styles.profileInfoValueSub}>
                        {address.bairro} - {address.cidade}/{address.estado} - CEP {address.cep}
                      </Text>
                    </View>
                  </View>
                </>
              ) : null}
              <TouchableOpacity style={styles.editProfileBtn} onPress={openEditProfile}>
                <Ionicons name="create-outline" size={18} color="#007AFF" />
                <Text style={styles.editProfileBtnText}>Editar perfil</Text>
              </TouchableOpacity>
            </View>

            {/* Mini histórico de atividades */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Atividade recente</Text>
            {activityLog.length === 0 ? (
              <View style={styles.emptyActivity}>
                <Ionicons name="time-outline" size={36} color="#ddd" />
                <Text style={styles.emptyActivityText}>Nenhuma atividade ainda</Text>
                <Text style={styles.emptyActivitySub}>Suas ações na conta aparecerão aqui</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {activityLog.map((item, idx) => (
                  <View key={item.id}>
                    {idx > 0 && <View style={styles.profileInfoDivider} />}
                    <View style={styles.activityRow}>
                      <View style={[styles.activityIconCircle, { backgroundColor: item.color + '18' }]}>
                        <Ionicons name={item.icon as any} size={18} color={item.color} />
                      </View>
                      <View style={styles.activityContent}>
                        <Text style={styles.activityTitle}>{item.title}</Text>
                        <Text style={styles.activityDetail}>{item.detail}</Text>
                      </View>
                      <Text style={styles.activityTime}>{formatActivityTime(item.date)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Tab: Segurança ── */}
        {activeTab === 'seguranca' && (
          <View>
            <Text style={styles.sectionTitle}>Proteção da conta</Text>

            {/* Alterar senha */}
            <TouchableOpacity style={styles.securityItem} onPress={() => setShowChangePassword(true)}>
              <View style={[styles.secIconCircle, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="key-outline" size={22} color="#007AFF" />
              </View>
              <View style={styles.secItemContent}>
                <Text style={styles.secItemTitle}>Alterar senha</Text>
                <Text style={styles.secItemDesc}>Recomendamos alterar regularmente</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>

            {/* Alterar e-mail */}
            <TouchableOpacity style={styles.securityItem} onPress={() => setShowChangeEmail(true)}>
              <View style={[styles.secIconCircle, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="mail-outline" size={22} color="#FF9800" />
              </View>
              <View style={styles.secItemContent}>
                <Text style={styles.secItemTitle}>Alterar e-mail</Text>
                <Text style={styles.secItemDesc}>Confirmação enviada por e-mail</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>

            {/* Verificação de e-mail */}
            <View style={styles.securityItem}>
              <View style={[styles.secIconCircle, { backgroundColor: emailConfirmed ? '#E8F5E9' : '#FFF8E1' }]}>
                <Ionicons
                  name={emailConfirmed ? 'shield-checkmark' : 'shield-outline'}
                  size={22}
                  color={emailConfirmed ? '#4CAF50' : '#FF9800'}
                />
              </View>
              <View style={styles.secItemContent}>
                <Text style={styles.secItemTitle}>Verificação de e-mail</Text>
                <Text style={styles.secItemDesc}>
                  {emailConfirmed ? 'E-mail verificado e protegido' : 'Verifique seu e-mail para mais segurança'}
                </Text>
              </View>
              {emailConfirmed ? (
                <View style={styles.statusBadgeGreen}>
                  <Text style={styles.statusBadgeGreenText}>Ativo</Text>
                </View>
              ) : (
                <View style={styles.statusBadgeOrange}>
                  <Text style={styles.statusBadgeOrangeText}>Pendente</Text>
                </View>
              )}
            </View>

            {/* Zona de perigo */}
            <Text style={[styles.sectionTitle, { color: '#f44336', marginTop: 30 }]}>Zona de perigo</Text>
            <TouchableOpacity style={styles.dangerItem} onPress={() => setShowDeleteAccount(true)}>
              <Ionicons name="trash-outline" size={22} color="#f44336" />
              <View style={styles.secItemContent}>
                <Text style={[styles.secItemTitle, { color: '#f44336' }]}>Excluir conta</Text>
                <Text style={styles.secItemDesc}>Ação permanente e irreversível</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#f44336" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Tab: Sessão ── */}
        {activeTab === 'sessoes' && (
          <View>
            <Text style={styles.sectionTitle}>Informações da sessão</Text>
            <View style={styles.card}>
              <View style={styles.sessionRow}>
                <Ionicons name="log-in-outline" size={20} color="#007AFF" />
                <Text style={styles.sessionLabel}>Último acesso</Text>
                <Text style={styles.sessionValue}>
                  {lastSignIn ? lastSignIn.toLocaleString('pt-BR') : 'Indisponível'}
                </Text>
              </View>
              <View style={styles.sessionDivider} />
              <View style={styles.sessionRow}>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                <Text style={styles.sessionLabel}>Conta criada</Text>
                <Text style={styles.sessionValue}>
                  {createdAt ? createdAt.toLocaleString('pt-BR') : 'Indisponível'}
                </Text>
              </View>
              <View style={styles.sessionDivider} />
              <View style={styles.sessionRow}>
                <Ionicons name="finger-print-outline" size={20} color="#007AFF" />
                <Text style={styles.sessionLabel}>ID do usuário</Text>
                <Text style={[styles.sessionValue, { fontSize: 11 }]}>{user.id?.slice(0, 16)}...</Text>
              </View>
              <View style={styles.sessionDivider} />
              <View style={styles.sessionRow}>
                <Ionicons name="at-outline" size={20} color="#007AFF" />
                <Text style={styles.sessionLabel}>Provedor</Text>
                <Text style={styles.sessionValue}>
                  {user.app_metadata?.provider === 'email' ? 'E-mail / Senha' : user.app_metadata?.provider || 'Desconhecido'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="white" />
              <Text style={styles.logoutBtnText}>Sair da conta</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══ Modal: Alterar Senha ══ */}
      <Modal visible={showChangePassword} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="key-outline" size={28} color="#007AFF" />
              <Text style={styles.modalTitle}>Alterar senha</Text>
              <TouchableOpacity onPress={() => { setShowChangePassword(false); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); }} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>
              Para sua segurança, confirme sua senha atual antes de alterá-la.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Senha atual</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput style={styles.inputField} placeholder="Senha atual" placeholderTextColor="#bbb" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
              </View>
              <Text style={styles.inputLabel}>Nova senha</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-open-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput style={styles.inputField} placeholder="Nova senha" placeholderTextColor="#bbb" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
              </View>
              <PasswordStrengthBar value={newPassword} />
              <PasswordRequirements value={newPassword} />
              <Text style={styles.inputLabel}>Confirmar nova senha</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-open-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput style={styles.inputField} placeholder="Repita a nova senha" placeholderTextColor="#bbb" value={confirmNewPassword} onChangeText={setConfirmNewPassword} secureTextEntry />
              </View>
              {confirmNewPassword !== '' && newPassword !== confirmNewPassword && (
                <Text style={styles.errorHint}>As senhas não coincidem</Text>
              )}
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleChangePassword}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="white" /> : (
                  <Text style={styles.primaryBtnText}>Alterar senha</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══ Modal: Alterar E-mail ══ */}
      <Modal visible={showChangeEmail} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="mail-outline" size={28} color="#FF9800" />
              <Text style={styles.modalTitle}>Alterar e-mail</Text>
              <TouchableOpacity onPress={() => { setShowChangeEmail(false); setNewEmail(''); setEmailConfirmPassword(''); }} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>
              Um link de confirmação será enviado ao novo e-mail. A alteração só será efetivada após a confirmação.
            </Text>
            <View style={styles.currentEmailBox}>
              <Text style={styles.currentEmailLabel}>E-mail atual</Text>
              <Text style={styles.currentEmailValue}>{user.email}</Text>
            </View>
            <Text style={styles.inputLabel}>Novo e-mail</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput style={styles.inputField} placeholder="novo@email.com" placeholderTextColor="#bbb" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <Text style={styles.inputLabel}>Confirme sua senha</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput style={styles.inputField} placeholder="Sua senha atual" placeholderTextColor="#bbb" value={emailConfirmPassword} onChangeText={setEmailConfirmPassword} secureTextEntry />
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleChangeEmail}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="white" /> : (
                <Text style={styles.primaryBtnText}>Enviar confirmação</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ Modal: Editar Perfil ══ */}
      <Modal visible={showEditProfile} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="create-outline" size={28} color="#007AFF" />
              <Text style={styles.modalTitle}>Editar perfil</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalDesc}>
                Atualize suas informações pessoais abaixo.
              </Text>
              <Text style={styles.inputLabel}>Nome de exibição</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Seu nome completo"
                  placeholderTextColor="#bbb"
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>
              <Text style={styles.inputLabel}>Telefone (BR)</Text>
              <View style={styles.inputRow}>
                <Ionicons name="call-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor="#bbb"
                  value={editPhone}
                  onChangeText={(t) => handlePhoneChange(t, setEditPhone)}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>

              <View style={styles.onboardSectionHeader}>
                <Ionicons name="location-outline" size={20} color="#007AFF" />
                <Text style={styles.onboardSectionTitle}>Endereço</Text>
              </View>

              <Text style={styles.inputLabel}>CEP</Text>
              <View style={styles.inputRow}>
                <Ionicons name="map-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="00000-000"
                  placeholderTextColor="#bbb"
                  value={editAddress.cep}
                  onChangeText={(t) => {
                    const formatted = formatCEP(t);
                    setEditAddress(prev => ({ ...prev, cep: formatted }));
                    if (t.replace(/\D/g, '').length === 8) fetchAddressByCep(t, setEditAddress);
                  }}
                  keyboardType="number-pad"
                  maxLength={9}
                />
                {cepLoading && <ActivityIndicator size="small" color="#007AFF" />}
              </View>

              <Text style={styles.inputLabel}>Rua / Logradouro</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Ex: Rua das Flores"
                  placeholderTextColor="#bbb"
                  value={editAddress.rua}
                  onChangeText={(t) => setEditAddress(prev => ({ ...prev, rua: t }))}
                />
              </View>

              <View style={styles.rowFields}>
                <View style={styles.halfField}>
                  <Text style={styles.inputLabel}>Número</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.inputField}
                      placeholder="123"
                      placeholderTextColor="#bbb"
                      value={editAddress.numero}
                      onChangeText={(t) => setEditAddress(prev => ({ ...prev, numero: t }))}
                    />
                  </View>
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.inputLabel}>Complemento</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.inputField}
                      placeholder="Apto, Sala..."
                      placeholderTextColor="#bbb"
                      value={editAddress.complemento}
                      onChangeText={(t) => setEditAddress(prev => ({ ...prev, complemento: t }))}
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.inputLabel}>Bairro</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Ex: Centro"
                  placeholderTextColor="#bbb"
                  value={editAddress.bairro}
                  onChangeText={(t) => setEditAddress(prev => ({ ...prev, bairro: t }))}
                />
              </View>

              <View style={styles.rowFields}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.inputLabel}>Cidade</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.inputField}
                      placeholder="Ex: São Paulo"
                      placeholderTextColor="#bbb"
                      value={editAddress.cidade}
                      onChangeText={(t) => setEditAddress(prev => ({ ...prev, cidade: t }))}
                    />
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.inputLabel}>UF</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.inputField}
                      placeholder="SP"
                      placeholderTextColor="#bbb"
                      value={editAddress.estado}
                      onChangeText={(t) => setEditAddress(prev => ({ ...prev, estado: t.toUpperCase().slice(0, 2) }))}
                      maxLength={2}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleUpdateProfile}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="white" /> : (
                  <Text style={styles.primaryBtnText}>Salvar alterações</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══ Modal: Excluir Conta ══ */}
      <Modal visible={showDeleteAccount} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning-outline" size={28} color="#f44336" />
              <Text style={[styles.modalTitle, { color: '#f44336' }]}>Excluir conta</Text>
              <TouchableOpacity onPress={() => { setShowDeleteAccount(false); setDeleteConfirmText(''); }} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            <View style={styles.dangerBanner}>
              <Ionicons name="alert-circle" size={20} color="#f44336" />
              <Text style={styles.dangerBannerText}>
                Esta ação é permanente e irreversível. Todos os seus dados, receitas e ingredientes serão excluídos.
              </Text>
            </View>
            <Text style={styles.inputLabel}>
              Digite <Text style={{ fontWeight: '800', color: '#f44336' }}>EXCLUIR</Text> para confirmar
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.inputField, { color: '#f44336' }]}
                placeholder="EXCLUIR"
                placeholderTextColor="#f4434666"
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                autoCapitalize="characters"
              />
            </View>
            <TouchableOpacity
              style={[styles.dangerBtn, deleteConfirmText !== 'EXCLUIR' && styles.dangerBtnDisabled]}
              onPress={handleDeleteAccount}
              disabled={deleteConfirmText !== 'EXCLUIR' || loading}
            >
              {loading ? <ActivityIndicator color="white" /> : (
                <Text style={styles.dangerBtnText}>Excluir conta permanentemente</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════
// ESTILOS
// ══════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },

  // ── Auth (não logado) ──
  authScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  authIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  authSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  eyeBtn: {
    padding: 8,
  },
  primaryBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
  switchBtn: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: '#999',
  },
  switchTextBold: {
    color: '#007AFF',
    fontWeight: '700',
  },
  errorHint: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },

  // ── Strength bar ──
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  strengthBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: '#E8E8ED',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 50,
  },
  reqContainer: {
    marginTop: 8,
    gap: 4,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reqText: {
    fontSize: 12,
    color: '#999',
  },
  reqTextOk: {
    color: '#4CAF50',
  },

  // ── Perfil Header ──
  backButton: {
    position: 'absolute' as const,
    top: 54,
    left: 16,
    zIndex: 10,
    padding: 4,
  },
  profileHeader: {
    backgroundColor: '#007AFF',
    paddingTop: 54,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: 'white',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  emailBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  verifiedText: {
    fontSize: 11,
    color: '#A5D6A7',
    fontWeight: '600',
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,152,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unverifiedText: {
    fontSize: 11,
    color: '#FFE082',
    fontWeight: '600',
  },
  profileMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },

  // ── Tabs ──
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: -12,
    borderRadius: 14,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  tabActive: {
    backgroundColor: '#EBF5FF',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },

  // ── Profile info display ──
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  profileInfoContent: {
    flex: 1,
  },
  profileInfoLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileInfoValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    marginTop: 2,
  },
  profileInfoDivider: {
    height: 1,
    backgroundColor: '#F2F2F7',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    backgroundColor: '#EBF5FF',
  },
  editProfileBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },

  // ── Activity log ──
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: '#F9F9FB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E8E8ED',
    borderStyle: 'dashed',
  },
  emptyActivityText: {
    fontSize: 15,
    color: '#888',
    fontWeight: '600',
    marginTop: 8,
  },
  emptyActivitySub: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 4,
    textAlign: 'center',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  activityIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  activityDetail: {
    fontSize: 11,
    color: '#999',
    marginTop: 1,
  },
  activityTime: {
    fontSize: 11,
    color: '#bbb',
    fontWeight: '500',
  },

  // ── Security items ──
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  secIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secItemContent: {
    flex: 1,
  },
  secItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  secItemDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadgeGreen: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4CAF50',
  },
  statusBadgeOrange: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeOrangeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF9800',
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    gap: 12,
  },

  // ── Sessions ──
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  sessionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  sessionValue: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  sessionDivider: {
    height: 1,
    backgroundColor: '#F2F2F7',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f44336',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  logoutBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalDesc: {
    fontSize: 13,
    color: '#999',
    lineHeight: 19,
    marginBottom: 8,
  },
  currentEmailBox: {
    backgroundColor: '#F8F8FA',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  currentEmailLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    marginBottom: 2,
  },
  currentEmailValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  dangerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    padding: 14,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  dangerBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#C62828',
    lineHeight: 19,
  },
  dangerBtn: {
    backgroundColor: '#f44336',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  dangerBtnDisabled: {
    opacity: 0.4,
  },
  dangerBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Onboarding / Endereço ──
  onboardSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8ED',
  },
  onboardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  profileInfoValueSub: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});