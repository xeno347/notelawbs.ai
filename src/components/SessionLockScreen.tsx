import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { useTheme, SERIF, RADIUS, ELEVATION } from '../theme';
import { useAuth } from '../auth/authStore';
import { useSessionLock } from '../auth/sessionLockStore';
import { AppButton, BrandMark, Aurora } from './ui';

/** Full-screen privacy cover shown when the app returns from the background. */
export default function SessionLockScreen() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const unlock = useSessionLock((s) => s.unlock);
  const name = user?.displayName?.split(' ')[0];

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        { backgroundColor: p.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, zIndex: 999 },
      ]}
      accessibilityViewIsModal
      accessibilityLabel="Session locked">
      <Aurora />
      <View style={styles.inner}>
        <BrandMark size={48} />
        <Text style={[styles.brand, { color: p.text }]}>NoteLawbs.Ai</Text>

        <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }, ELEVATION.panel]}>
          <View style={[styles.iconWrap, { backgroundColor: p.accentSoft }]}>
            <Lock size={22} color={p.accent} />
          </View>
          <Text style={[styles.title, { color: p.text }]}>Session locked</Text>
          <Text style={[styles.sub, { color: p.textMid }]}>
            {name
              ? `Welcome back, ${name}. Unlock to continue your research.`
              : 'Unlock to continue your research workspace.'}
          </Text>
          <View style={{ height: 20 }} />
          <AppButton label="Unlock workspace" onPress={unlock} full />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 420, paddingHorizontal: 24, alignItems: 'center' },
  brand: { fontSize: 22, fontWeight: '800', marginTop: 14, marginBottom: 28 },
  card: { width: '100%', borderRadius: RADIUS.xl, borderWidth: 1, padding: 28, alignItems: 'center' },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: 0.1 },
  sub: { fontSize: 14, marginTop: 8, lineHeight: 20, textAlign: 'center', fontFamily: SERIF },
});
