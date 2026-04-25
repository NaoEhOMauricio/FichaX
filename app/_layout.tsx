import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, ToastAndroid, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useUpdateCheck } from '../lib/updateCheck';

function BackHandlerGuard() {
  const pathname = usePathname();
  const lastBackPress = useRef(0);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pathname === '/' || pathname === '/index') {
        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          BackHandler.exitApp();
        } else {
          lastBackPress.current = now;
          if (Platform.OS === 'android') {
            ToastAndroid.show('Aperte voltar novamente para sair', ToastAndroid.SHORT);
          }
        }
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [pathname]);

  return null;
}

function UpdateChecker() {
  useUpdateCheck();
  return null;
}

export default function RootLayout() {
  return (
    <>
      <BackHandlerGuard />
      <UpdateChecker />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      />
    </>
  );
}