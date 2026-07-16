import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { Plus, FileText } from 'lucide-react-native';
import { useStore } from '../store';
import { getPalette, useTheme, RADIUS, TYPE } from '../theme';
import { importWordAsPdf } from '../services/pdfUtilities';

const QUICK_TAGS = ['judgment', 'statute', 'brief', 'evidence', 'research'];

export default function DocSidebar() {
  const p = useTheme();
  const library = useStore((s) => s.library);
  const activeDocId = useStore((s) => s.activeDocId);
  const highlights = useStore((s) => s.highlights);
  const openPdf = useStore((s) => s.openPdf);
  const selectLibraryDoc = useStore((s) => s.selectLibraryDoc);
  const updateLibraryDoc = useStore((s) => s.updateLibraryDoc);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const s = styles(p);

  const usedTags = useMemo(() => {
    const set = new Set<string>();
    library.forEach((d) => (d.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [library]);

  const visible = useMemo(() => {
    if (!tagFilter) return library;
    return library.filter((d) => (d.tags || []).includes(tagFilter));
  }, [library, tagFilter]);

  const activeDoc = library.find((d) => d.id === activeDocId);

  const addDocument = async () => {
    try {
      const file = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf],
        copyTo: 'cachesDirectory',
      });
      const uri = file.fileCopyUri || file.uri;
      const result = await openPdf(uri, file.name || 'document.pdf');
      if (result?.deduped) {
        Alert.alert('Already in library', 'Opened the existing copy of this file.');
      }
    } catch (e: any) {
      if (!DocumentPicker.isCancel(e)) {
        /* ignore */
      }
    }
  };

  const openAddMenu = () => {
    Alert.alert('Add document', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'PDF', onPress: () => void addDocument() },
      {
        text: 'Word / text → PDF',
        onPress: async () => {
          try {
            const imported = await importWordAsPdf();
            if (!imported) return;
            await openPdf(imported.uri, imported.name, { forceNew: true });
          } catch (e: any) {
            Alert.alert('Import failed', e?.message || 'Could not import that file.');
          }
        },
      },
    ]);
  };

  const editTags = () => {
    if (!activeDoc) return;
    const cur = new Set(activeDoc.tags || []);
    Alert.alert(
      'Tags',
      'Tap a tag to toggle it on the active document.',
      [
        { text: 'Done', style: 'cancel' },
        ...QUICK_TAGS.map((t) => ({
          text: `${cur.has(t) ? '✓ ' : ''}${t}`,
          onPress: () => {
            const next = cur.has(t)
              ? (activeDoc.tags || []).filter((x) => x !== t)
              : [...(activeDoc.tags || []), t];
            updateLibraryDoc(activeDoc.id, { tags: next });
          },
        })),
      ],
    );
  };

  return (
    <View style={s.root}>
      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}>
        {usedTags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterContent}>
            <TouchableOpacity
              style={[s.filterChip, !tagFilter && s.filterChipOn]}
              onPress={() => setTagFilter(null)}>
              <Text style={[s.filterText, !tagFilter && s.filterTextOn]}>All</Text>
            </TouchableOpacity>
            {usedTags.map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.filterChip, tagFilter === t && s.filterChipOn]}
                onPress={() => setTagFilter(tagFilter === t ? null : t)}>
                <Text style={[s.filterText, tagFilter === t && s.filterTextOn]} numberOfLines={1}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {visible.map((doc) => {
          const active = doc.id === activeDocId;
          const count = highlights.filter((h) => h.docId === doc.id).length;
          return (
            <TouchableOpacity
              key={doc.id}
              style={[s.docCard, active && s.docCardActive]}
              onPress={() => selectLibraryDoc(doc.id)}
              onLongPress={active ? editTags : undefined}
              activeOpacity={0.72}>
              <View style={[s.thumb, active && s.thumbActive]}>
                <FileText size={20} color={active ? p.tint : p.textMuted} strokeWidth={1.7} />
                {count > 0 ? (
                  <View style={s.countPip}>
                    <Text style={s.countText}>{count > 99 ? '99+' : count}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[s.docName, active && s.docNameActive]} numberOfLines={2}>
                {doc.name.replace(/\.pdf$/i, '')}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={s.addCard} onPress={openAddMenu} activeOpacity={0.72}>
          <View style={s.addIcon}>
            <Plus size={18} color={p.tint} strokeWidth={2.4} />
          </View>
          <Text style={s.addText}>Add</Text>
        </TouchableOpacity>

        {activeDoc ? (
          <TouchableOpacity style={s.tagHint} onPress={editTags}>
            <Text style={s.tagHintText} numberOfLines={2}>
              {(activeDoc.tags || []).length
                ? (activeDoc.tags || []).join(' · ')
                : 'Long-press to tag'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    root: {
      width: 88,
      backgroundColor: p.sidebar,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: p.separator,
      paddingTop: 8,
    },
    list: { flex: 1 },
    listContent: { gap: 8, paddingBottom: 28, paddingHorizontal: 8 },
    filterContent: { gap: 4, paddingBottom: 4, alignItems: 'center' },
    filterChip: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: RADIUS.pill,
      backgroundColor: p.fillSecondary,
      marginRight: 4,
    },
    filterChipOn: { backgroundColor: p.tintSoft },
    filterText: { fontSize: 10, fontWeight: '600', color: p.textMuted },
    filterTextOn: { color: p.tint },
    docCard: {
      alignItems: 'center',
      padding: 4,
      borderRadius: RADIUS.md,
    },
    docCardActive: { backgroundColor: p.sidebarActive },
    thumb: {
      width: '100%',
      aspectRatio: 0.74,
      maxHeight: 72,
      borderRadius: RADIUS.sm,
      backgroundColor: p.grouped,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 5,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.separator,
      ...StyleSheet.flatten({
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }),
    },
    thumbActive: { borderColor: p.tint, borderWidth: 1.5 },
    countPip: {
      position: 'absolute',
      top: 3,
      right: 3,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: p.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countText: { color: '#fff', fontSize: 9, fontWeight: '700' },
    docName: {
      ...TYPE.caption2,
      fontSize: 11,
      color: p.textMid,
      fontWeight: '500',
      lineHeight: 13,
      textAlign: 'center',
    },
    docNameActive: { color: p.text, fontWeight: '600' },
    addCard: {
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: RADIUS.md,
      gap: 5,
    },
    addIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: p.tintSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addText: { fontSize: 11, color: p.tint, fontWeight: '600' },
    tagHint: { paddingHorizontal: 2, paddingTop: 4 },
    tagHintText: {
      fontSize: 9,
      color: p.textMuted,
      textAlign: 'center',
      lineHeight: 12,
    },
  });
