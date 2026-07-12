import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Circle, Defs, Line, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';
import { FileText, ArrowRight, Settings2, Sparkles } from 'lucide-react-native';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import { useDocumentLibrary } from '../documents/useDocumentLibrary';
import { useActiveDocument } from '../workspace/useActiveDocument';
import { RootStackParamList } from '../../app/navigation';
import { importDocument } from '../documents/importService';
import { seedIfEmpty } from '../documents/demoSeed';
import { Document, IndexStatus, OcrStatus } from '../../models/types';
import { useAuth } from '../auth/useAuth';

const stageLabels = ['Imported', 'OCR', 'Indexed'];

const getStageProgress = (doc: Document | null) => {
  if (!doc) return 0.18;
  if (doc.indexStatus === IndexStatus.complete) return 1;
  if (doc.ocrStatus === OcrStatus.complete) return 0.66;
  if (doc.ocrStatus === OcrStatus.processing) return 0.34;
  return 0.18;
};

const ProcessingGraphic = ({ accent }: { accent: string }) => (
  <View style={styles.graphicWrap}>
    <Svg width="100%" height="100%" viewBox="0 0 320 320">
      <Defs>
        <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#f7f4ef" />
          <Stop offset="100%" stopColor="#dfddd5" />
        </LinearGradient>
        <LinearGradient id="tubeGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#ff9a45" />
          <Stop offset="100%" stopColor="#d85b1d" />
        </LinearGradient>
      </Defs>
      <Circle cx="160" cy="160" r="120" stroke="url(#ringGrad)" strokeWidth="2" strokeDasharray="2 10" fill="none" />
      <Circle cx="160" cy="160" r="95" stroke={accent} strokeOpacity={0.16} strokeWidth="18" fill="none" />
      <Rect x="130" y="70" width="60" height="78" rx="12" fill="url(#tubeGrad)" />
      <Rect x="126" y="132" width="68" height="110" rx="10" fill="#ffffff" stroke="#ece7df" strokeWidth="2" />
      <Rect x="124" y="116" width="72" height="24" rx="12" fill="#ff7e31" />
      <Line x1="138" y1="168" x2="182" y2="168" stroke="#e86a24" strokeWidth="2" />
      <Rect x="154" y="152" width="18" height="84" rx="4" fill="#f3e9dc" />
    </Svg>
  </View>
);

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings } = useSettings();
  const { user } = useAuth();
  const { documents, fetchDocuments } = useDocumentLibrary();
  const { setActiveDocument } = useActiveDocument();
  const { width } = useWindowDimensions();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const latestDocument = useMemo(() => {
    return [...documents].sort((a, b) => +new Date(b.lastOpened) - +new Date(a.lastOpened))[0] ?? null;
  }, [documents]);

  useEffect(() => {
    const boot = async () => {
      await seedIfEmpty();
      await fetchDocuments();
    };
    boot();
  }, [fetchDocuments]);

  const openDocument = (doc: Document) => {
    setActiveDocument(doc);
    navigation.navigate('DocumentWorkspace', { id: doc.id });
  };

  const handleImport = async () => {
    const doc = await importDocument();
    if (doc) {
      await fetchDocuments();
      setActiveDocument(doc);
      navigation.navigate('DocumentWorkspace', { id: doc.id });
    }
  };

  const primaryDoc = latestDocument;
  const stageProgress = getStageProgress(primaryDoc);
  const isWide = width >= 900;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.topRow}>
        <View style={styles.greetingBlock}>
          <Text style={[styles.greeting, { color: theme.textPrimary }]}>Welcome back,</Text>
          <View style={[styles.nameBar, { backgroundColor: theme.border }]}>
            <Text style={[styles.nameText, { color: theme.textPrimary }]} numberOfLines={1}>
              {user?.name || user?.email || 'Counsel'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          accessibilityLabel="Open settings"
          onPress={() => navigation.navigate('Settings')}
          style={[styles.profileDot, { backgroundColor: '#ff7a2f' }]}
        >
          <Settings2 size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Text style={[styles.kicker, { color: theme.textSecondary }]}>Supersonic legal workspace</Text>
        <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>We’re analyzing your filing</Text>
      </View>

      <View style={[styles.heroGrid, isWide && styles.heroGridWide]}>
        <View style={[styles.heroVisualCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ProcessingGraphic accent={theme.accent} />
          <View style={styles.heroVisualMeta}>
            <Text style={[styles.visualTitle, { color: theme.textPrimary }]}>
              {primaryDoc ? primaryDoc.title : 'Import a document to get started'}
            </Text>
            <Text style={[styles.visualSubtitle, { color: theme.textSecondary }]}>
              OCR, indexing, and canvas cards all run locally in the app.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => primaryDoc && openDocument(primaryDoc)}
          style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.statusTop}>
            <Text style={[styles.statusTitle, { color: theme.textPrimary }]}>We received your sample</Text>
            <ArrowRight size={24} color={theme.textSecondary} />
          </View>
          <Text style={[styles.statusBody, { color: theme.textSecondary }]}>
            Your results and evidence protocol will be ready once the local OCR and index pass finishes.
          </Text>

          <View style={styles.stageRow}>
            {stageLabels.map((label) => (
              <Text key={label} style={[styles.stageLabel, { color: label === 'Imported' ? theme.accent : theme.textSecondary }]}>
                {label}
              </Text>
            ))}
          </View>

          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <View style={[styles.progressFill, { width: `${Math.round(stageProgress * 100)}%`, backgroundColor: '#ff7a2f' }]} />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Recent files</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Library')}>
          <Text style={[styles.sectionAction, { color: theme.accent }]}>See all</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.recentGrid, isWide && styles.recentGridWide]}>
        {documents.slice(0, isWide ? 4 : 2).map((doc) => (
          <TouchableOpacity
            key={doc.id}
            onPress={() => openDocument(doc)}
            style={[styles.recentCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.recentIcon, { backgroundColor: theme.background }]}>
              <FileText size={22} color={theme.accent} />
            </View>
            <Text style={[styles.recentTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              {doc.title}
            </Text>
            <Text style={[styles.recentMeta, { color: theme.textSecondary }]}>
              {doc.pageCount} pages • {doc.ocrStatus}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={handleImport}
        style={[styles.primaryButton, { backgroundColor: '#ff7a2f' }]}
      >
        <Sparkles size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Import brief</Text>
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  greetingBlock: {
    flex: 1,
    paddingRight: 16,
  },
  greeting: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '500',
    letterSpacing: -1.2,
  },
  nameBar: {
    marginTop: 14,
    width: 220,
    height: 34,
    borderRadius: 8,
    opacity: 0.85,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 14,
    fontWeight: '700',
  },
  profileDot: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff7a2f',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  kicker: {
    fontSize: 22,
    marginBottom: 8,
    fontWeight: '500',
  },
  heroTitle: {
    fontSize: 44,
    lineHeight: 50,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: -1.6,
  },
  heroGrid: {
    gap: 20,
  },
  heroGridWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  heroVisualCard: {
    flex: 1,
    minHeight: 360,
    borderWidth: 1,
    borderRadius: 32,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  graphicWrap: {
    flex: 1,
    minHeight: 280,
    marginTop: -6,
    marginBottom: 10,
  },
  heroVisualMeta: {
    gap: 8,
  },
  visualTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  visualSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  statusCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 32,
    padding: 24,
    justifyContent: 'center',
  },
  statusTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusTitle: {
    flex: 1,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  statusBody: {
    marginTop: 20,
    fontSize: 17,
    lineHeight: 26,
  },
  stageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 12,
  },
  stageLabel: {
    fontSize: 18,
    fontWeight: '500',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  sectionHeader: {
    marginTop: 28,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  sectionAction: {
    fontSize: 15,
    fontWeight: '600',
  },
  recentGrid: {
    gap: 14,
  },
  recentGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  recentCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    minHeight: 118,
    justifyContent: 'space-between',
  },
  recentIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '600',
  },
  recentMeta: {
    marginTop: 4,
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 22,
    borderRadius: 24,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
