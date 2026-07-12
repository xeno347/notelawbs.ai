import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FileText, Filter, Plus, Search } from 'lucide-react-native';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import { useDocumentLibrary } from './useDocumentLibrary';
import { useActiveDocument } from '../workspace/useActiveDocument';
import { RootStackParamList } from '../../app/navigation';
import { importDocument } from './importService';
import { seedIfEmpty } from './demoSeed';

export default function DataScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings } = useSettings();
  const { documents, isLoading, fetchDocuments } = useDocumentLibrary();
  const { setActiveDocument } = useActiveDocument();
  const { width } = useWindowDimensions();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const boot = async () => {
      await seedIfEmpty();
      await fetchDocuments();
    };
    boot();
  }, [fetchDocuments]);

  const orderedDocuments = useMemo(
    () => [...documents].sort((a, b) => +new Date(b.lastOpened) - +new Date(a.lastOpened)),
    [documents],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDocuments();
    setRefreshing(false);
  };

  const handleImport = async () => {
    const doc = await importDocument();
    if (doc) {
      await fetchDocuments();
      setActiveDocument(doc);
      navigation.navigate('DocumentWorkspace', { id: doc.id });
    }
  };

  const openDocument = (doc: any) => {
    setActiveDocument(doc);
    navigation.navigate('DocumentWorkspace', { id: doc.id });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Data</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>All imported files, OCR status, and local indexing.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface }]}>
            <Search size={18} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleImport} style={[styles.importButton, { backgroundColor: '#ff7a2f' }]}>
            <Plus size={18} color="#fff" />
            <Text style={styles.importLabel}>Import</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chipsRow}>
        <View style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Filter size={14} color={theme.textSecondary} />
          <Text style={[styles.chipText, { color: theme.textSecondary }]}>All files</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.chipText, { color: theme.textSecondary }]}>Recent</Text>
        </View>
      </View>

      <FlatList
        data={orderedDocuments}
        keyExtractor={(item) => item.id}
        numColumns={width >= 900 ? 2 : 1}
        columnWrapperStyle={width >= 900 ? styles.columnWrap : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openDocument(item)}
            style={[styles.docCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.docIcon, { backgroundColor: theme.background }]}>
              <FileText size={24} color={theme.accent} />
            </View>
            <View style={styles.docBody}>
              <Text style={[styles.docTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.docMeta, { color: theme.textSecondary }]}>
                {item.pageCount} pages • {new Date(item.lastOpened).toLocaleDateString()}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: item.ocrStatus === 'complete' ? theme.accent + '22' : '#ff7a2f22' }]}>
              <Text style={[styles.statusLabel, { color: item.ocrStatus === 'complete' ? theme.accent : '#ff7a2f' }]}>
                {item.indexStatus === 'complete' ? 'Ready' : item.ocrStatus}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <FileText size={52} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No files yet</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Import a PDF or load the bundled demo documents.</Text>
            <TouchableOpacity onPress={handleImport} style={[styles.emptyButton, { backgroundColor: '#ff7a2f' }]}>
              <Text style={styles.emptyButtonText}>Import document</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {(isLoading || refreshing) && <View style={styles.loadingOverlay} pointerEvents="none" />}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerTextBlock: {
    flex: 1,
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
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButton: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  importLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  columnWrap: {
    gap: 12,
  },
  docCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  docIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docBody: {
    flex: 1,
  },
  docTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  docMeta: {
    fontSize: 13,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 340,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 380,
  },
  emptyButton: {
    marginTop: 8,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});
