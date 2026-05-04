import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const ADMIN_EMAIL = 'leonardo.clemente.braga@gmail.com';

const NAV_ITEMS = [
  { href: '/',             icon: 'book-outline',      iconActive: 'book',            label: 'Cardápio',     color: '#6366f1' },
  { href: '/ingredients',  icon: 'leaf-outline',       iconActive: 'leaf',            label: 'Ingredientes', color: '#22c55e' },
  { href: '/recipes',      icon: 'restaurant-outline', iconActive: 'restaurant',      label: 'Receitas',     color: '#f59e0b' },
  { href: '/subscription', icon: 'card-outline',       iconActive: 'card',            label: 'Assinatura',   color: '#a78bfa' },
  { href: '/auth',         icon: 'person-outline',     iconActive: 'person',          label: 'Conta',        color: '#6366f1' },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session);
      setUserEmail(session?.user?.email || '');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setLoggedIn(!!session);
      setUserEmail(session?.user?.email || '');
    });
    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = userEmail === ADMIN_EMAIL;

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' || pathname === '/index' : pathname.startsWith(href);

  return (
    <View style={styles.bar}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <TouchableOpacity
            key={item.href}
            style={styles.item}
            onPress={() => router.push(item.href as any)}
            activeOpacity={0.7}
          >
            {active && <View style={[styles.activePill, { backgroundColor: item.color }]} />}
            <Ionicons
              name={(active ? item.iconActive : item.icon) as any}
              size={22}
              color={active ? item.color : '#475569'}
            />
            <Text style={[styles.label, active && { color: item.color, fontWeight: '700' }]}>
              {item.href === '/auth' ? (loggedIn ? 'Conta' : 'Entrar') : item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
      {isAdmin && (
        <TouchableOpacity
          style={styles.item}
          onPress={() => router.push('/admin')}
          activeOpacity={0.7}
        >
          {isActive('/admin') && <View style={[styles.activePill, { backgroundColor: '#6366f1' }]} />}
          <Ionicons
            name={isActive('/admin') ? 'shield-checkmark' : 'shield-checkmark-outline'}
            size={22}
            color={isActive('/admin') ? '#6366f1' : '#475569'}
          />
          <Text style={[styles.label, isActive('/admin') && { color: '#6366f1', fontWeight: '700' }]}>
            Admin
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#080f1e',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingBottom: 16,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: -8,
    width: 32,
    height: 3,
    borderRadius: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: '#475569',
    textAlign: 'center',
  },
});
