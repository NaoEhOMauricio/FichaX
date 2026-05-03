import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

export default function BrandLogo({ size = 36, style = {} }: { size?: number; style?: object }) {
  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.ficha, { fontSize: size }]}>Ficha</Text>
      <Text style={[styles.x, { fontSize: size * 1.12 }]}>X</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ficha: {
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: -1.5,
  },
  x: {
    fontWeight: '900',
    color: '#FF9500',
    letterSpacing: -2.5,
  },
});
