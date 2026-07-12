import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ShoppingBag, Sparkles, FileText, Layers3, ArrowRight } from 'lucide-react-native';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import { useDocumentLibrary } from '../documents/useDocumentLibrary';
import { useActiveDocument } from '../workspace/useActiveDocument';
import { RootStackParamList } from '../../app/navigation';
import { seedIfEmpty } from '../documents/demoSeed';

const tiles = [
  { title: 'Load demo case', subtitle: 'Adds sample petitions, bookmarks, and OCR pages.', icon: Sparkles },
  { title: 'Open latest file', subtitle: 'Jump straight into the most recently touched brief.', icon: FileText },
  { title: 'Review index', subtitle: 'Inspect the local auto-index and bookmark list.', icon: Layers3 },
];

export default function MarketplaceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings } = useSettings();
  const { documents, fetchDocuments } = useDocumentLibrary();
  const { setActiveDocument } = useActiveDocument();
  const { width } = useWindowDimensions();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  const openLatest = async () => {
    let docs = documents;
    if (!docs.length) {
      await seedIfEmpty();
      await fetchDocuments();
      docs = useDocumentLibrary.getState().documents;
    }
    const latest = [...docs].sort((a, b) => +new Date(b.lastOpened) - +new Date(a.lastOpened))[0];
    if (latest) {
      setActiveDocument(latest);
      navigation.navigate('DocumentWorkspace', { id: latest.id });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Marketplace</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>A curated surface for demo flows and quick-start actions.</Text>

      <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.heroTop}>
          <View style={[styles.heroIcon, { backgroundColor: theme.background }]}>
            <ShoppingBag size={22} color={theme.accent} />
          </View>
          <ArrowRight size={22} color={theme.textSecondary} />
        </View>
        <Text style={[styles.heroLabel, { color: theme.textPrimary }]}>Quick start pack</Text>
        <Text style={[styles.heroText, { color: theme.textSecondary }]}>Use these actions to bring the app to life without any backend dependency.</Text>
      </View>

      <View style={[styles.grid, width >= 900 && styles.gridWide]}>
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <TouchableOpacity key={tile.title} onPress={openLatest} style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.tileIcon, { backgroundColor: theme.background }]}>
                <Icon size={18} color={theme.accent} />
              </View>
              <Text style={[styles.tileTitle, { color: theme.textPrimary }]}>{tile.title}</Text>
              <Text style={[styles.tileSubtitle, { color: theme.textSecondary }]}>{tile.subtitle}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity onPress={openLatest} style={[styles.cta, { backgroundColor: '#ff7a2f' }]}>
        <Text style={styles.ctaText}>Open latest brief</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 120,
  },
  title: {
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    marginBottom: 18,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '600',
  },
  heroText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
  },
  grid: {
    gap: 12,
  },
  gridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    flex: 1,
    minWidth: 240,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 10,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  tileSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  cta: {
    marginTop: 18,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
