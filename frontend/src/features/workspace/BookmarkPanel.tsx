import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import { useBookmarks } from './useBookmarks';
import { useActiveDocument } from './useActiveDocument';
import { RootStackParamList } from '../../app/navigation';
import { ChevronDown, ChevronRight, PlusCircle, Pencil, Trash2, ArrowRight, Bookmark as BookmarkIcon } from 'lucide-react-native';
import { createId } from '../../utils/id';

type BookmarkItemModel = {
  id: string;
  label: string;
  subtitle?: string | null;
  startPage: number;
  isAutoIndexed?: boolean;
};

type SectionHeaderProps = {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  theme: any;
};

type BookmarkItemProps = {
  item: BookmarkItemModel;
  theme: any;
  onPress: (item: BookmarkItemModel) => void;
  onLongPress: (item: BookmarkItemModel) => void;
};

type Props = {
  currentPage?: number;
};

function SectionHeader({ title, count, expanded, onToggle, theme }: SectionHeaderProps) {
  return (
    <TouchableOpacity
      style={[styles.sectionHeader, { backgroundColor: theme.background + '60' }]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.headerLeft}>
        {expanded ? <ChevronDown size={16} color={theme.textSecondary} /> : <ChevronRight size={16} color={theme.textSecondary} />}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      </View>
      <View style={[styles.countBadge, { backgroundColor: theme.border }]}>
        <Text style={[styles.countText, { color: theme.textSecondary }]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

function BookmarkItemRow({ item, theme, onPress, onLongPress }: BookmarkItemProps) {
  return (
    <TouchableOpacity
      style={[styles.item, { borderBottomColor: theme.border + '40' }]}
      activeOpacity={0.8}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
    >
      <View style={styles.itemMain}>
        <Text style={[styles.itemLabel, { color: theme.textPrimary }]} numberOfLines={2}>
          {item.label}
        </Text>
        {item.subtitle ? <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text> : null}
      </View>
      <View style={styles.itemMeta}>
        <Text style={[styles.pageText, { color: theme.accent }]}>p. {item.startPage}</Text>
        <ArrowRight size={14} color={theme.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

export default function BookmarkPanel({ currentPage = 1 }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings } = useSettings();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const { activeDocument } = useActiveDocument();
  const { bookmarks, fetchBookmarks, addBookmark, updateBookmark, removeBookmark } = useBookmarks();

  const [isAutoExpanded, setIsAutoExpanded] = useState(true);
  const [isManualExpanded, setIsManualExpanded] = useState(true);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [page, setPage] = useState(String(currentPage));

  useEffect(() => {
    if (activeDocument) {
      fetchBookmarks(activeDocument.id);
    }
  }, [activeDocument, fetchBookmarks]);

  useEffect(() => {
    setPage(String(currentPage));
  }, [currentPage]);

  const autoIndexed = useMemo(() => bookmarks.filter((bookmark) => bookmark.isAutoIndexed), [bookmarks]);
  const manualIndexed = useMemo(() => bookmarks.filter((bookmark) => !bookmark.isAutoIndexed), [bookmarks]);
  const panelHintStyle = useMemo(() => [styles.panelHint, { color: theme.textSecondary }], [theme.textSecondary]);
  const cancelLabelStyle = useMemo(() => [styles.modalActionText, { color: theme.textPrimary }], [theme.textPrimary]);
  const deleteLabelStyle = useMemo(() => [styles.modalActionText, { color: '#FF3B30' }], []);
  const saveLabelStyle = useMemo(() => [styles.modalActionText, { color: '#fff' }], []);
  const cancelButtonStyle = useMemo(() => [styles.modalBtn, styles.cancelBtn, { backgroundColor: theme.background }], [theme.background]);
  const saveButtonStyle = useMemo(() => [styles.modalBtn, { backgroundColor: theme.accent }], [theme.accent]);

  const openBookmark = (item: BookmarkItemModel) => {
    if (!activeDocument) {
      return;
    }
    navigation.navigate('DocumentWorkspace', { id: activeDocument.id, page: item.startPage });
  };

  const startCreate = () => {
    setEditingId(null);
    setLabel(activeDocument ? `Page ${currentPage}` : '');
    setPage(String(currentPage));
    setEditorVisible(true);
  };

  const startEdit = (item: BookmarkItemModel) => {
    setEditingId(item.id);
    setLabel(item.label);
    setPage(String(item.startPage));
    setEditorVisible(true);
  };

  const saveBookmark = async () => {
    if (!activeDocument) {
      return;
    }
    const nextPage = Math.max(1, Number(page) || 1);
    if (editingId) {
      await updateBookmark(editingId, {
        label,
        startPage: nextPage,
      } as any);
    } else {
      await addBookmark({
        id: createId('bookmark'),
        documentId: activeDocument.id,
        label,
        subtitle: 'Manual bookmark',
        type: 'section' as any,
        startPage: nextPage,
        sortOrder: bookmarks.length,
        isAutoIndexed: false,
      });
    }
    setEditorVisible(false);
  };

  const deleteBookmark = async () => {
    if (!editingId) {
      return;
    }
    await removeBookmark(editingId);
    setEditorVisible(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderRightColor: theme.border }]}>
      <View style={styles.topHeader}>
        <View>
          <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>Index</Text>
          <Text style={panelHintStyle}>
            Tap to jump, long-press to edit
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={startCreate}>
          <PlusCircle size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        <SectionHeader
          title="Auto-Indexed"
          count={autoIndexed.length}
          expanded={isAutoExpanded}
          theme={theme}
          onToggle={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsAutoExpanded(!isAutoExpanded);
          }}
        />
        {isAutoExpanded && autoIndexed.map((item) => <BookmarkItemRow key={item.id} item={item} theme={theme} onPress={openBookmark} onLongPress={startEdit} />)}

        <SectionHeader
          title="Manual Bookmarks"
          count={manualIndexed.length}
          expanded={isManualExpanded}
          theme={theme}
          onToggle={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsManualExpanded(!isManualExpanded);
          }}
        />
        {isManualExpanded && manualIndexed.map((item) => <BookmarkItemRow key={item.id} item={item} theme={theme} onPress={openBookmark} onLongPress={startEdit} />)}

        {bookmarks.length === 0 && (
          <View style={styles.empty}>
            <BookmarkIcon size={40} color={theme.border} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No sections detected yet</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={editorVisible} transparent animationType="fade" onRequestClose={() => setEditorVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              {editingId ? 'Edit bookmark' : 'New bookmark'}
            </Text>
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Label</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="Bookmark label"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.background }]}
            />
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Page</Text>
            <TextInput
              value={page}
              onChangeText={setPage}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.background }]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={cancelButtonStyle} onPress={() => setEditorVisible(false)}>
                <Text style={cancelLabelStyle}>Cancel</Text>
              </TouchableOpacity>
              {editingId && (
                <TouchableOpacity style={[styles.modalBtn, styles.deleteBtn]} onPress={deleteBookmark}>
                  <Trash2 size={16} color="#FF3B30" />
                  <Text style={deleteLabelStyle}>Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={saveButtonStyle} onPress={saveBookmark}>
                <Pencil size={16} color="#fff" />
                <Text style={saveLabelStyle}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: '100%',
    borderRightWidth: 1,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  panelHint: {
    marginTop: 4,
    fontSize: 12,
  },
  scroll: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  itemMain: {
    flex: 1,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  pageText: {
    fontSize: 12,
    fontWeight: '800',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
  },
  addBtn: {
    padding: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 8,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  modalBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalActionText: {
    fontWeight: '700',
  },
  cancelBtn: {},
  deleteBtn: {
    backgroundColor: '#FF3B3015',
  },
  deleteText: {
    color: '#FF3B30',
  },
  saveText: {
    color: '#fff',
  },
});
