import React from 'react';
import { Text, View, StyleSheet } from 'react-native';


export default function BrandLogo({ size = 36, style = {} }) {
  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.logo, styles.outline, { fontSize: size }]}>Ficha</Text>
      <Text
        style={[
          styles.logo,
          styles.outline,
          styles.x,
          { color: '#FF9500', fontSize: size * 1.12 }
        ]}
      >
        X
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // sem fundo
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: -1.5,
    fontFamily: 'System',
    // sem textTransform, para respeitar FichaX
    textAlignVertical: 'center',
  },
  x: {
    fontWeight: '900',
    textShadowColor: '#222',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
    letterSpacing: -2.5,
    textAlignVertical: 'center',
  },
  outline: {
    textShadowColor: '#222',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
