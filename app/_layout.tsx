import { Stack } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';

const BREAKPOINT = 768;

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINT;

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' }}>
        <Sidebar />
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: '#0f172a' } }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'column', backgroundColor: '#0f172a' }}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: '#0f172a' } }} />
      </View>
      <BottomNav />
    </View>
  );
}
