import { Stack } from 'expo-router';
import { View, useWindowDimensions, Platform } from 'react-native';
import { useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';

const BREAKPOINT = 768;

// Esconde scrollbar do browser (barra branca na direita)
function HideScrollbar() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.innerHTML = `
      ::-webkit-scrollbar { display: none !important; width: 0 !important; }
      * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);
  return null;
}

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINT;

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0f172a', overflow: 'hidden' }}>
        <HideScrollbar />
        <Sidebar />
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: '#0f172a' } }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'column', backgroundColor: '#0f172a', overflow: 'hidden' }}>
      <HideScrollbar />
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: '#0f172a' } }} />
      </View>
      <BottomNav />
    </View>
  );
}
