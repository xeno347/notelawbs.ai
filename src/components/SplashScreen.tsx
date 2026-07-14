import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme, SERIF } from '../theme';
import { Aurora, BrandMark } from './ui';

export default function SplashScreen() {
  const p = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, rise]);

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      <Aurora />
      <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }], alignItems: 'center' }}>
        <BrandMark size={64} />
        <Text style={[styles.brand, { color: p.text }]}>
          LitNotes<Text style={{ color: p.textMuted }}> Canvas</Text>
        </Text>
        <Text style={[styles.tag, { color: p.textMid }]}>Highlight. Connect. Reason.</Text>
      </Animated.View>
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: p.textMuted }]}>Preparing your workspace…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 30, fontWeight: '800', letterSpacing: 0.2, marginTop: 18 },
  tag: { fontSize: 15, marginTop: 8, fontFamily: SERIF, fontStyle: 'italic' },
  footer: { position: 'absolute', bottom: 44 },
  footerText: { fontSize: 12.5, letterSpacing: 0.3 },
});
