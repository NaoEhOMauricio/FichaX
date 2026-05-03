import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import Sidebar from '../components/Sidebar';

export default function RootLayout() {
  return (
    <View style={styles.shell}>
      <Sidebar />
      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
            contentStyle: { backgroundColor: '#0f172a' },
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
  },
});
