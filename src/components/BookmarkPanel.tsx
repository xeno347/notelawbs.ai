import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import DraggableFlatList, { type RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { useStore, type Bookmark, type BookmarkSectionKey } from '../store';
import { getPalette, useTheme, SERIF, RADIUS, ELEVATION } from '../theme';

const SECTIONS: Array<{ key: BookmarkSectionKey; label: string; hint: string; showDate?: boolean }> = [
  { key: 'index', label: 'Index', hint: 'Table of contents — nest sub-entries under a parent.', showDate: false },
  { key: 'dates', label: 'List of Dates', hint: 'Chronological events with their dates.', showDate: true },
  { key: 'synopsis', label: 'Synopsis', hint: 'Running narrative summary of the matter.' },
  { key: 'issues', label: 'Issue-wise', hint: 'Issues framed for adjudication, one per entry.' },
  { key: 'annexures', label: 'Annexures', hint: 'e.g. "Annexure P-1" — supporting documents.' },
];

export default function BookmarkPanel({ onClose }: { onClose: () => void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const docName = useStore((s) => s.docName);
  const currentPage = useStore((s) => s.currentPage);
  const bookmarks = useStore((s) => s.bookmarks);
  const addBookmark = useStore((s) => s.addBookmark);
  const updateBookmark = useStore((s) => s.updateBookmark);
  const removeBookmark = useStore((s) => s.removeBookmark);
  const reorderBookmarks = useStore((s) => s.reorderBookmarks);
  const jumpToPage = useStore((s) => s.jumpToPage);

  const [active, setActive] = useState<BookmarkSectionKey>('index');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [page, setPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [date, setDate] = useState('');

  const meta = SECTIONS.find((sec) => sec.key === active)!;
  const entries = useMemo(
    () => bookmarks.filter((b) => b.section === active).sort((a, b) => a.order - b.order),
    [bookmarks, active],
  );
  const roots = useMemo(() => flattenTree(entries), [entries]);

  const resetForm = () => {
    setEditingId(null);
    setParentId(null);
    setTitle('');
    setNote('');
    setPage('');
    setEndPage('');
    setDate('');
  };

  const startEdit = (b: Bookmark) => {
    setEditingId(b.id);
    setParentId(b.parentId || null);
    setTitle(b.title);
    setNote(b.note);
    setPage(b.page ? String(b.page) : '');
    setEndPage(b.endPage ? String(b.endPage) : '');
    setDate(b.date);
  };

  const submit = () => {
    if (!title.trim() && !note.trim()) return;
    const pageNum = page.trim() ? Math.max(1, parseInt(page, 10) || 0) || null : null;
    const endPageNum = endPage.trim() ? Math.max(1, parseInt(endPage, 10) || 0) || null : null;
    const payload = {
      title: title.trim(),
      note: note.trim(),
      page: pageNum,
      endPage: endPageNum && pageNum && endPageNum > pageNum ? endPageNum : null,
      date: date.trim(),
      parentId: parentId || null,
    };
    if (editingId) {
      updateBookmark(editingId, payload);
    } else {
      addBookmark({ section: active, ...payload });
    }
    resetForm();
  };

  const useCurrentPage = () => setPage(String(currentPage));

  const s = styles(p);

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Bookmark & { depth: number }>) => (
    <ScaleDecorator>
      <TouchableOpacity
        style={[s.row, isActive && s.rowDragging, item.depth > 0 && { marginLeft: 18 * item.depth }]}
        onPress={() => startEdit(item)}
        onLongPress={drag}
        delayLongPress={180}>
        <View style={s.rowMain}>
          {meta.showDate && !!item.date && <Text style={s.rowDate}>{item.date}</Text>}
          {!!item.title && (
            <Text style={s.rowTitle}>
              {item.depth > 0 ? '↳ ' : ''}
              {item.title}
            </Text>
          )}
          {!!item.note && (
            <Text style={s.rowNote} numberOfLines={4}>
              {item.note}
            </Text>
          )}
        </View>
        <View style={s.rowActions}>
          <TouchableOpacity
            style={s.nestBtn}
            onPress={() => {
              setParentId(item.id);
              setEditingId(null);
              setTitle('');
              setNote('');
              Alert.alert('Nest entry', `New entry will be nested under “${item.title || 'Untitled'}”.`);
            }}>
            <Text style={s.nestText}>Nest</Text>
          </TouchableOpacity>
          {item.page != null && (
            <TouchableOpacity style={s.pagePill} onPress={() => jumpToPage(item.page!)}>
              <Text style={s.pagePillText}>
                p. {item.page}
                {item.endPage && item.endPage > item.page ? `–${item.endPage}` : ''}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => {
              removeBookmark(item.id);
              if (editingId === item.id) resetForm();
            }}>
            <Text style={s.rowDelete}>×</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </ScaleDecorator>
  );

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.panel}>
          <BlurView style={StyleSheet.absoluteFill} blurType={p.blurType} blurAmount={26} reducedTransparencyFallbackColor={p.bg} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: p.glassTint }]} />

          <View style={[s.header, { paddingTop: insets.top + 18 }]}>
            <Text style={s.title}>Bundle index</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={s.tabs}>
            {SECTIONS.map((sec) => {
              const isActive = sec.key === active;
              const count = bookmarks.filter((b) => b.section === sec.key).length;
              return (
                <TouchableOpacity
                  key={sec.key}
                  style={[s.tab, isActive && s.tabActive]}
                  onPress={() => {
                    setActive(sec.key);
                    resetForm();
                  }}>
                  <Text style={[s.tabText, isActive && s.tabTextActive]}>
                    {sec.label}
                    {count > 0 ? ` · ${count}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.sectionHint}>
            {meta.hint}
            {parentId ? ' · Nesting under selected parent.' : ' · Long-press to reorder.'}
          </Text>

          <DraggableFlatList
            data={roots}
            keyExtractor={(item) => item.id}
            onDragEnd={({ data }) => reorderBookmarks(active, data.map((d) => d.id))}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 12 }}
            ListEmptyComponent={
              <Text style={s.empty}>
                {!docName
                  ? 'Open a PDF, then build this document’s index here.'
                  : 'No entries yet — add one below.'}
              </Text>
            }
            style={s.list}
          />

          <View style={s.form}>
            {parentId && (
              <TouchableOpacity onPress={() => setParentId(null)}>
                <Text style={s.nestHint}>Nesting on · tap to clear</Text>
              </TouchableOpacity>
            )}
            {meta.showDate && (
              <TextInput
                style={s.input}
                placeholder="Date (e.g. 12.03.2019)"
                placeholderTextColor={p.textMuted}
                value={date}
                onChangeText={setDate}
              />
            )}
            <TextInput
              style={s.input}
              placeholder={active === 'annexures' ? 'e.g. Annexure P-1' : 'Title'}
              placeholderTextColor={p.textMuted}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="Description / notes…"
              placeholderTextColor={p.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
            />
            <View style={s.formRow}>
              <TextInput
                style={[s.input, s.pageInput]}
                placeholder="Page"
                placeholderTextColor={p.textMuted}
                value={page}
                onChangeText={setPage}
                keyboardType="number-pad"
              />
              <TextInput
                style={[s.input, s.pageInput]}
                placeholder="to page"
                placeholderTextColor={p.textMuted}
                value={endPage}
                onChangeText={setEndPage}
                keyboardType="number-pad"
              />
              <TouchableOpacity style={s.linkPageBtn} onPress={useCurrentPage}>
                <Text style={s.linkPageText}>Use p. {currentPage}</Text>
              </TouchableOpacity>
              {editingId && (
                <TouchableOpacity style={s.cancelBtn} onPress={resetForm}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.submitBtn} onPress={submit}>
                <Text style={s.submitText}>{editingId ? 'Save' : 'Add entry'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function flattenTree(entries: Bookmark[]): Array<Bookmark & { depth: number }> {
  const byParent = new Map<string | null, Bookmark[]>();
  for (const e of entries) {
    const key = e.parentId || null;
    const list = byParent.get(key) || [];
    list.push(e);
    byParent.set(key, list);
  }
  const out: Array<Bookmark & { depth: number }> = [];
  const walk = (parent: string | null, depth: number) => {
    const kids = (byParent.get(parent) || []).sort((a, b) => a.order - b.order);
    for (const k of kids) {
      out.push({ ...k, depth });
      walk(k.id, depth + 1);
    }
  };
  walk(null, 0);
  // Orphans (parent missing) still show
  for (const e of entries) {
    if (!out.some((x) => x.id === e.id)) out.push({ ...e, depth: 0 });
  }
  return out;
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    backdrop: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: p.overlay },
    panel: { width: '88%', maxWidth: 460, overflow: 'hidden', borderLeftWidth: 1, borderLeftColor: p.border, ...ELEVATION.panel },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingBottom: 10,
    },
    title: { fontSize: 20, fontWeight: '800', color: p.text, fontFamily: SERIF },
    closeBtn: { paddingHorizontal: 10, paddingVertical: 6 },
    closeText: { color: p.tint, fontWeight: '700' },
    tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, marginBottom: 6 },
    tab: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      backgroundColor: p.surface2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
    },
    tabActive: { backgroundColor: p.tintSoft, borderColor: p.tint },
    tabText: { fontSize: 12, color: p.textMid, fontWeight: '600' },
    tabTextActive: { color: p.tint, fontWeight: '800' },
    sectionHint: { fontSize: 12, color: p.textMuted, paddingHorizontal: 18, marginBottom: 8 },
    list: { flex: 1, paddingHorizontal: 14 },
    empty: { color: p.textMuted, fontSize: 13, padding: 16, textAlign: 'center' },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 12,
      marginBottom: 8,
      borderRadius: RADIUS.sm,
      backgroundColor: p.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
    },
    rowDragging: { opacity: 0.92, borderColor: p.tint },
    rowMain: { flex: 1 },
    rowDate: { fontSize: 11, color: p.accent, fontWeight: '700', marginBottom: 2 },
    rowTitle: { fontSize: 14, color: p.text, fontWeight: '700' },
    rowNote: { fontSize: 12, color: p.textMid, marginTop: 4, lineHeight: 17 },
    rowActions: { alignItems: 'flex-end', gap: 6 },
    pagePill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: RADIUS.pill,
      backgroundColor: p.tintSoft,
    },
    pagePillText: { fontSize: 11, color: p.tint, fontWeight: '800' },
    nestBtn: { paddingHorizontal: 8, paddingVertical: 3 },
    nestText: { fontSize: 11, color: p.ai, fontWeight: '700' },
    rowDelete: { fontSize: 22, color: p.danger, fontWeight: '300', lineHeight: 22 },
    form: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p.separator,
      padding: 14,
      gap: 8,
      backgroundColor: p.grouped,
    },
    nestHint: { fontSize: 12, color: p.ai, fontWeight: '700', marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: p.text,
      backgroundColor: p.surface,
      fontSize: 14,
    },
    inputMulti: { minHeight: 64, textAlignVertical: 'top' },
    formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    pageInput: { width: 72 },
    linkPageBtn: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: RADIUS.sm, backgroundColor: p.surface2 },
    linkPageText: { fontSize: 12, color: p.text, fontWeight: '600' },
    cancelBtn: { paddingHorizontal: 10, paddingVertical: 10 },
    cancelText: { color: p.textMuted, fontWeight: '600' },
    submitBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.sm, backgroundColor: p.tint },
    submitText: { color: '#fff', fontWeight: '800' },
  });
