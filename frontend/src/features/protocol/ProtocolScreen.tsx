import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckCircle2, FileScan, FolderOpen, Layers3, RefreshCcw, Upload } from 'lucide-react-native';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import { useDocumentLibrary } from '../documents/useDocumentLibrary';
import { useActiveDocument } from '../workspace/useActiveDocument';
import { RootStackParamList } from '../../app/navigation';
import { importDocument } from '../documents/importService';
import { seedIfEmpty } from '../documents/demoSeed';
import { processOcr } from './ocrService';
import { runAutoIndex } from './autoIndexService';

const steps = [
  { key: 'import', label: 'Import', icon: Upload },
  { key: 'ocr', label: 'OCR', icon: FileScan },
  { key: 'index', label: 'Index', icon: Layers3 },
  { key: 'workspace', label: 'Canvas', icon: FolderOpen },
];

export default function ProtocolScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings } = useSettings();
  const { documents, fetchDocuments } = useDocumentLibrary();
  const { activeDocument, setActiveDocument } = useActiveDocument();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  const currentDoc = useMemo(() => activeDocument ?? documents[0] ?? null, [activeDocument, documents]);
  const currentStep = currentDoc?.indexStatus === 'complete' ? 4 : currentDoc?.ocrStatus === 'complete' ? 3 : currentDoc?.ocrStatus === 'processing' ? 2 : 1;

  const handleImport = async () => {
    const doc = await importDocument();
    if (doc) {
      await fetchDocuments();
      setActiveDocument(doc);
      navigation.navigate('DocumentWorkspace', { id: doc.id });
    }
  };

  const rerunPipeline = async () => {
    if (!currentDoc) return;
    await processOcr(currentDoc.id);
    await runAutoIndex(currentDoc.id);
    await fetchDocuments();
  };

  const loadDemoData = async () => {
    await seedIfEmpty();
    await fetchDocuments();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Protocol</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Your backend-driven document pipeline for import, OCR, indexing, and review.</Text>

      <View style={[styles.timelineCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const active = idx + 1 <= currentStep;
          return (
            <View key={step.key} style={styles.stepRow}>
              <View style={[styles.stepIcon, { backgroundColor: active ? '#ff7a2f22' : theme.background }]}>
                <Icon size={18} color={active ? '#ff7a2f' : theme.textSecondary} />
              </View>
              <View style={styles.stepText}>
                <Text style={[styles.stepLabel, { color: theme.textPrimary }]}>{step.label}</Text>
                <Text style={[styles.stepMeta, { color: theme.textSecondary }]}>
                  {idx === 0 && 'Import a PDF or load demo files'}
                  {idx === 1 && 'OCR jobs are processed by the backend'}
                  {idx === 2 && 'Auto-index tags section headings'}
                  {idx === 3 && 'Drag excerpts into the canvas workspace'}
                </Text>
              </View>
              {active ? <CheckCircle2 size={18} color="#ff7a2f" /> : <View style={styles.stepDot} />}
            </View>
          );
        })}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity onPress={handleImport} style={[styles.actionButton, { backgroundColor: '#ff7a2f' }]}>
          <Text style={styles.actionText}>Import file</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={rerunPipeline} style={[styles.secondaryButton, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <RefreshCcw size={16} color={theme.textPrimary} />
          <Text style={[styles.secondaryText, { color: theme.textPrimary }]}>Re-run backend pipeline</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={loadDemoData} style={[styles.seedCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.seedTitle, { color: theme.textPrimary }]}>Load demo data</Text>
        <Text style={[styles.seedText, { color: theme.textSecondary }]}>Refresh the library from the backend demo seed if you want sample legal documents and bookmarks.</Text>
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
  timelineCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    gap: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepText: {
    flex: 1,
    gap: 4,
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  stepMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#d4cec3',
    marginTop: 13,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  seedCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 8,
  },
  seedTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  seedText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
