import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, PenTool, Sparkles, Link2 } from 'lucide-react-native';
import { useTheme, SERIF, RADIUS, ELEVATION } from '../theme';
import { AppButton, Aurora, BrandMark } from './ui';

const STEPS = [
  {
    icon: BookOpen,
    title: 'Read & highlight',
    body: 'Open a judgment PDF and draw category-coded highlights over the passages that matter.',
  },
  {
    icon: PenTool,
    title: 'Build on the canvas',
    body: 'Every highlight becomes a card on an infinite canvas you can arrange, annotate and sketch on.',
  },
  {
    icon: Link2,
    title: 'Connect the argument',
    body: 'Thread facts, ratios and authorities together, then link handwritten notes back to the page.',
  },
  {
    icon: Sparkles,
    title: 'Research & export',
    body: 'Draft memos with AI, build a court-ready index, and export the whole bundle — all on-device.',
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: p.bg, zIndex: 300 }]}>
      <Aurora />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={{ width: '100%', maxWidth: isTablet ? 640 : 460, alignSelf: 'center' }}>
          <View style={styles.header}>
            <BrandMark size={52} />
            <Text style={[styles.title, { color: p.text }]}>Welcome to LitNotes Canvas</Text>
            <Text style={[styles.sub, { color: p.textMid }]}>
              Your research desk for court judgments — highlight, connect and reason in one place.
            </Text>
          </View>

          <View style={[styles.grid, isTablet && styles.gridTablet]}>
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <View
                  key={step.title}
                  style={[
                    styles.stepCard,
                    isTablet && styles.stepCardTablet,
                    { backgroundColor: p.surface, borderColor: p.border },
                    ELEVATION.card,
                  ]}>
                  <View style={[styles.stepIcon, { backgroundColor: p.accentSoft }]}>
                    <Icon size={20} color={p.accent} strokeWidth={2.1} />
                  </View>
                  <Text style={[styles.stepTitle, { color: p.text }]}>{step.title}</Text>
                  <Text style={[styles.stepBody, { color: p.textMuted }]}>{step.body}</Text>
                </View>
              );
            })}
          </View>

          <View style={{ height: 24 }} />
          <AppButton label="Get started" onPress={onDone} full />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: 0.1, marginTop: 16, textAlign: 'center' },
  sub: { fontSize: 15, marginTop: 10, textAlign: 'center', lineHeight: 22, fontFamily: SERIF },
  grid: { gap: 12 },
  gridTablet: { flexDirection: 'row', flexWrap: 'wrap' },
  stepCard: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 18 },
  stepCardTablet: { width: '48%' },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepTitle: { fontSize: 16, fontWeight: '700' },
  stepBody: { fontSize: 13.5, marginTop: 6, lineHeight: 20 },
});
