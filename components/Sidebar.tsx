import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import BrandLogo from './BrandLogo';

const NAV_ITEMS = [
  { href: '/',             icon: 'book-outline',       label: 'Cardápio',     color: '#6366f1' },
  { href: '/ingredients',  icon: 'leaf-outline',        label: 'Ingredientes', color: '#22c55e' },
  { href: '/recipes',      icon: 'restaurant-outline',  label: 'Receitas',     color: '#f59e0b' },
  { href: '/subscription', icon: 'card-outline',        label: 'Assinatura',   color: '#a78bfa' },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setDisplayName(session?.user?.user_metadata?.display_name || '');
      setEmail(session?.user?.email || '');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setDisplayName(session?.user?.user_metadata?.display_name || '');
      setEmail(session?.user?.email || '');
    });
    return () => subscription.unsubscribe();
  }, []);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' || pathname === '/index' : pathname.startsWith(href);

  return (
    <View style={styles.sidebar}>
      <View style={styles.logoArea}>
        <BrandLogo size={26} />
        <Text style={styles.logoSub}>Gestão Gastronômica</Text>
      </View>

      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <TouchableOpacity
              key={item.href}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => router.push(item.href as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.navIconWrap, active && { backgroundColor: item.color + '22' }]}>
                <Ionicons
                  name={item.icon as any}
                  size={19}
                  color={active ? item.color : '#64748b'}
                />
              </View>
              <Text style={[styles.navLabel, active && { color: item.color, fontWeight: '700' }]}>
                {item.label}
              </Text>
              {active && <View style={[styles.activeDot, { backgroundColor: item.color }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.userArea, isActive('/auth') && styles.userAreaActive]}
        onPress={() => router.push('/auth')}
        activeOpacity={0.8}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(displayName || email || '?').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {displayName || (email ? 'Minha conta' : 'Entrar')}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {email || 'Faça login'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color="#475569" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    backgroundColor: '#080f1e',
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 12,
    flexDirection: 'column',
  },
  logoArea: {
    paddingHorizontal: 8,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 14,
  },
  logoSub: {
    fontSize: 10,
    color: '#334155',
    marginTop: 5,
    letterSpacing: 0.4,
    fontWeight: '500',
  },
  nav: {
    flex: 1,
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 10,
  },
  navItemActive: {
    backgroundColor: '#1e293b',
  },
  navIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  userArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  userAreaActive: {
    backgroundColor: '#1e293b',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(99,102,241,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#c7d2fe',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  userEmail: {
    fontSize: 10,
    color: '#475569',
    marginTop: 1,
  },
});
