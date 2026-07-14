import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import { useStore, type Bookmark, type BookmarkSectionKey } from '../store';
import { getPalette, useTheme, SERIF, RADIUS, ELEVATION } from '../theme';

const SECTIONS: Array<{ key: BookmarkSectionKey; label: string; hint: string; showDate?: boolean }> = [
  { key: 'index', label: 'Index', hint: 'Table of contents for this bundle — section, page.' },
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
  const jumpToPage = useStore((s) => s.jumpToPage);

  const [active, setActive] = useState<BookmarkSectionKey>('index');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [page, setPage] = useState('');
  const [date, setDate] = useState('');

  const meta = SECTIONS.find((sec) => sec.key === active)!;
  const entries = useMemo(
    () => bookmarks.filter((b) => b.section === active).sort((a, b) => a.order - b.order),
    [bookmarks, active],
  );

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setNote('');
    setPage('');
    setDate('');
  };

  const startEdit = (b: Bookmark) => {
    setEditingId(b.id);
    setTitle(b.title);
    setNote(b.note);
    setPage(b.page ? String(b.page) : '');
    setDate(b.date);
  };

  const submit = () => {
    if (!title.trim() && !note.trim()) return;
    const pageNum = page.trim() ? Math.max(1, parseInt(page, 10) || 0) || null : null;
    const payload = { title: title.trim(), note: note.trim(), page: pageNum, date: date.trim() };
    if (editingId) {
      updateBookmark(editingId, payload);
    } else {
      addBookmark({ section: active, ...payload });
    }
    resetForm();
  };

  const useCurrentPage = () => setPage(String(currentPage));

  const s = styles(p);

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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs} contentContainerStyle={s.tabsContent}>
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
          </ScrollView>

          <Text style={s.sectionHint}>{meta.hint}</Text>

          <ScrollView style={s.list} keyboardShouldPersistTaps="handled">
            {!docName && entries.length === 0 && (
              <Text style={s.empty}>Open a PDF, then build this document's index here.</Text>
            )}
            {entries.map((b) => (
              <TouchableOpacity key={b.id} style={s.row} onPress={() => startEdit(b)}>
                <View style={s.rowMain}>
                  {meta.showDate && !!b.date && <Text style={s.rowDate}>{b.date}</Text>}
                  {!!b.title && <Text style={s.rowTitle}>{b.title}</Text>}
                  {!!b.note && (
                    <Text style={s.rowNote} numberOfLines={4}>
                      {b.note}
                    </Text>
                  )}
                </View>
                <View style={s.rowActions}>
                  {b.page != null && (
                    <TouchableOpacity style={s.pagePill} onPress={() => jumpToPage(b.page!)}>
                      <Text style={s.pagePillText}>p. {b.page}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => {
                      removeBookmark(b.id);
                      if (editingId === b.id) resetForm();
                    }}>
                    <Text style={s.rowDelete}>×</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.form}>
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

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    backdrop: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: p.overlay },
    panel: { width: '88%', maxWidth: 460, overflow: 'hidden', borderLeftWidth: 1, borderLeftColor: p.border, ...ELEVATION.panel },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    title: { fontSize: 19, fontWeight: '700', color: p.text, fontFamily: SERIF },
    closeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: p.border },
    closeText: { color: p.text, fontSize: 13 },
    tabs: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: p.border },
    tabsContent: { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
    tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, marginRight: 4, backgroundColor: p.surfaceGlass, borderWidth: 1, borderColor: p.border },
    tabActive: { backgroundColor: p.accent, borderColor: p.accent },
    tabText: { fontSize: 12.5, fontWeight: '600', color: p.textMid },
    tabTextActive: { color: '#fff' },
    sectionHint: { fontSize: 11.5, color: p.textMuted, paddingHorizontal: 18, paddingVertical: 8, fontStyle: 'italic' },
    list: { flex: 1, paddingHorizontal: 14 },
    empty: { color: p.textMuted, fontSize: 13, textAlign: 'center', padding: 24, lineHeight: 20 },
    row: {
      flexDirection: 'row',
      backgroundColor: p.surfaceGlass,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: p.border,
      padding: 12,
      marginBottom: 8,
      gap: 8,
    },
    rowMain: { flex: 1, minWidth: 0 },
    rowDate: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: p.accent, marginBottom: 2 },
    rowTitle: { fontSize: 14, fontWeight: '700', color: p.text, marginBottom: 2, fontFamily: SERIF },
    rowNote: { fontSize: 12.5, lineHeight: 18, color: p.textMid, fontFamily: SERIF },
    rowActions: { alignItems: 'flex-end', gap: 8, justifyContent: 'space-between' },
    pagePill: { borderWidth: 1, borderColor: p.accent, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
    pagePillText: { fontSize: 10.5, color: p.accent, fontWeight: '700' },
    rowDelete: { fontSize: 18, color: p.textMuted, lineHeight: 18 },
    form: { borderTopWidth: 1, borderTopColor: p.border, padding: 14, gap: 8 },
    input: {
      borderWidth: 1,
      borderColor: p.borderStrong,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 11,
      paddingVertical: 9,
      color: p.text,
      backgroundColor: p.surfaceGlass,
      fontSize: 13.5,
    },
    inputMulti: { minHeight: 56, textAlignVertical: 'top' },
    formRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pageInput: { width: 64 },
    linkPageBtn: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: RADIUS.sm, backgroundColor: p.surface2 },
    linkPageText: { fontSize: 11.5, color: p.textMid, fontWeight: '600' },
    cancelBtn: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: RADIUS.sm },
    cancelText: { color: p.textMuted, fontSize: 12.5 },
    submitBtn: { flex: 1, backgroundColor: p.accent, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' },
    submitText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  });
