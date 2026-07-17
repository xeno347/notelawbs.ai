import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme, TYPE } from '../theme';
import { BrandMark } from './ui';

export default function SplashScreen() {
  const p = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, rise]);

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }], alignItems: 'center' }}>
        <BrandMark size={88} />
        <Text style={[styles.brand, { color: p.text }]}>NoteLawbs.Ai</Text>
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
  brand: { ...TYPE.title2, marginTop: 16 },
  tag: { ...TYPE.callout, marginTop: 6 },
  footer: { position: 'absolute', bottom: 44 },
  footerText: { ...TYPE.caption1 },
});
