import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import { useDocumentLibrary } from '../documents/useDocumentLibrary';
import { useActiveDocument } from '../workspace/useActiveDocument';
import { compressPdf, shareFile, cleanupImportedFiles } from '../workspace/pdfUtils';
import { DocumentType } from '../../models/types';
import { Share2, Scissors, Trash2, RefreshCcw } from 'lucide-react-native';
import { seedIfEmpty } from '../documents/demoSeed';

export default function UtilitiesScreen() {
  const { settings } = useSettings();
  const { documents, fetchDocuments } = useDocumentLibrary();
  const { activeDocument } = useActiveDocument();
  const [busy, setBusy] = useState<string | null>(null);
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const currentDoc = useMemo(() => activeDocument ?? documents[0] ?? null, [activeDocument, documents]);

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    try {
      await fn();
      await fetchDocuments();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Utilities</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Backend-backed file actions and maintenance tools for your workspace.
      </Text>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
            <Share2 size={18} color={theme.accent} />
          </View>
          <View style={styles.textBlock}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Share current file</Text>
            <Text style={[styles.cardText, { color: theme.textSecondary }]}>
              Send the selected document using the native share sheet.
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.accent }]}
          onPress={() => currentDoc && run('share', () => shareFile(currentDoc.filePath, currentDoc.title))}
          disabled={!currentDoc || busy === 'share'}
        >
          <Text style={styles.actionText}>Share now</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
            <Scissors size={18} color={theme.accent} />
          </View>
          <View style={styles.textBlock}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Compress a PDF copy</Text>
            <Text style={[styles.cardText, { color: theme.textSecondary }]}>
              Creates a local compressed duplicate in your app folder.
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.accent }]}
          onPress={() => currentDoc && currentDoc.type === DocumentType.pdf && run('compress', () => compressPdf(currentDoc.filePath, 'high'))}
          disabled={!currentDoc || currentDoc.type !== DocumentType.pdf || busy === 'compress'}
        >
          <Text style={styles.actionText}>Compress PDF</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
            <Trash2 size={18} color={theme.accent} />
          </View>
          <View style={styles.textBlock}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Clean imported files</Text>
            <Text style={[styles.cardText, { color: theme.textSecondary }]}>
              Deletes files in the local import/compressed folders that are no longer referenced by the database.
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.accent }]}
          onPress={() => run('cleanup', cleanupImportedFiles)}
          disabled={busy === 'cleanup'}
        >
          <Text style={styles.actionText}>Run cleanup</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
            <RefreshCcw size={18} color={theme.accent} />
          </View>
          <View style={styles.textBlock}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Reseed demo data</Text>
            <Text style={[styles.cardText, { color: theme.textSecondary }]}>
              Recreate the bundled demo documents if you want to reset the local workspace.
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.accent }]}
          onPress={() => run('seed', seedIfEmpty)}
          disabled={busy === 'seed'}
        >
          <Text style={styles.actionText}>Seed demos</Text>
        </TouchableOpacity>
      </View>

      {busy && (
        <View style={styles.busyRow}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.busyText, { color: theme.textSecondary }]}>Working locally...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 18,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  busyText: {
    marginLeft: 10,
  },
});
