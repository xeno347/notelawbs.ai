import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { useDocumentLibrary } from './useDocumentLibrary';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import { Plus, FileText, Clock, Tag, Pencil, Trash2, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/navigation';
import { useActiveDocument } from '../workspace/useActiveDocument';
import { importDocument } from './importService';
import { seedIfEmpty } from './demoSeed';

export default function LibraryScreen() {
  const { documents, isLoading, fetchDocuments, updateDocument, removeDocument } = useDocumentLibrary();
  const { setActiveDocument } = useActiveDocument();
  const { settings } = useSettings();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingDocument, setEditingDocument] = useState<any | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPageCount, setDraftPageCount] = useState('0');
  const [draftTags, setDraftTags] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDocuments();
    setRefreshing(false);
  };

  const handleImport = async () => {
    const doc = await importDocument();
    if (doc) {
      await fetchDocuments();
    }
  };

  const handleSeed = async () => {
    await seedIfEmpty();
    await fetchDocuments();
  };

  const openEditor = (doc: any) => {
    setEditingDocument(doc);
    setDraftTitle(doc.title || '');
    setDraftPageCount(String(doc.pageCount ?? 0));
    setDraftTags(Array.isArray(doc.tags) ? doc.tags.join(', ') : '');
    setEditorVisible(true);
  };

  const saveDocument = async () => {
    if (!editingDocument) return;
    await updateDocument(editingDocument.id, {
      title: draftTitle.trim() || editingDocument.title,
      pageCount: Math.max(0, Number(draftPageCount) || 0),
      tags: draftTags.split(',').map((tag) => tag.trim()).filter(Boolean),
    } as any);
    setEditorVisible(false);
    await fetchDocuments();
  };

  const confirmDelete = (doc: any) => {
    Alert.alert('Delete document', `Delete "${doc.title}"? This removes its related backend data too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeDocument(doc.id);
          await fetchDocuments();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.docRow, { backgroundColor: theme.surface }]}>
      <TouchableOpacity
        style={styles.docMain}
        onPress={() => {
          setActiveDocument(item);
          navigation.navigate('DocumentWorkspace', { id: item.id });
        }}
      >
        <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
          <FileText size={24} color={theme.accentSecondary} />
        </View>
        <View style={styles.docInfo}>
          <Text style={[styles.docTitle, { color: theme.textPrimary }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.metaRow}>
            <Clock size={12} color={theme.textSecondary} />
            <Text style={[styles.docMeta, { color: theme.textSecondary }]}>
               {new Date(item.lastOpened).toLocaleDateString()} • {item.pageCount} pages
            </Text>
          </View>
        </View>
        <View style={styles.statusBox}>
          <View style={[
            styles.badge,
            { backgroundColor: item.ocrStatus === 'complete' ? theme.accentSecondary + '20' : theme.accent + '10' }
          ]}>
            <Text style={[
              styles.badgeText,
              { color: item.ocrStatus === 'complete' ? theme.accentSecondary : theme.textSecondary }
            ]}>
              {item.ocrStatus.toUpperCase()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.rowActions}>
        <TouchableOpacity style={[styles.rowActionBtn, { backgroundColor: theme.background }]} onPress={() => openEditor(item)}>
          <Pencil size={16} color={theme.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rowActionBtn, { backgroundColor: '#B4231815' }]} onPress={() => confirmDelete(item)}>
          <Trash2 size={16} color="#B42318" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Documents
          </Text>
          <Text style={{ color: theme.textSecondary }}>Your legal research workspace</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.accent }]}
          onPress={handleImport}
        >
          <Plus size={24} color={theme.surface} />
          <Text style={[styles.addButtonText, { color: theme.surface }]}>Import</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <TouchableOpacity style={[styles.filterChip, { backgroundColor: theme.accent }]}>
          <Text style={{ color: theme.surface, fontWeight: '600' }}>All Documents</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterChip, { backgroundColor: theme.surface }]}>
          <Tag size={14} color={theme.textSecondary} />
          <Text style={{ color: theme.textSecondary, marginLeft: 4 }}>Recent</Text>
        </TouchableOpacity>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accentSecondary} />
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentSecondary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FileText size={64} color={theme.textSecondary + '40'} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No documents found.
              </Text>
              <View style={{ gap: 12, marginTop: 16 }}>
                <TouchableOpacity onPress={handleImport} style={[styles.emptyBtn, { backgroundColor: theme.accent }]}>
                  <Text style={{ color: theme.surface, fontWeight: 'bold' }}>Import PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSeed} style={[styles.emptyBtn, { borderColor: theme.accent, borderWidth: 1 }]}>
                  <Text style={{ color: theme.accent, fontWeight: 'bold' }}>Load Demo Data</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      )}

      <Modal visible={editorVisible} transparent animationType="fade" onRequestClose={() => setEditorVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Edit document</Text>
              <TouchableOpacity onPress={() => setEditorVisible(false)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Title</Text>
            <TextInput value={draftTitle} onChangeText={setDraftTitle} style={[styles.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.background }]} />
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Page count</Text>
            <TextInput value={draftPageCount} onChangeText={setDraftPageCount} keyboardType="number-pad" style={[styles.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.background }]} />
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Tags, comma separated</Text>
            <TextInput value={draftTags} onChangeText={setDraftTags} style={[styles.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.background }]} />
            <TouchableOpacity onPress={saveDocument} style={[styles.saveBtn, { backgroundColor: theme.accent }]}>
              <Text style={styles.saveText}>Save changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 40,
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  filters: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  list: {
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 40,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  docMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  rowActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docInfo: {
    flex: 1,
    marginLeft: 16,
  },
  docTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  docMeta: {
    fontSize: 13,
  },
  statusBox: {
    marginLeft: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    marginTop: 100,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  saveBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  }
});
