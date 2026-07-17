import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import {
  Plus,
  FileText,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react-native';
import { useStore } from '../store';
import {
  getPalette,
  useTheme,
  RADIUS,
  TYPE,
  SIDEBAR_W,
  SIDEBAR_COMPACT_W,
  ICON_SIZE,
  ROW_H,
} from '../theme';
import { importWordAsPdf } from '../services/pdfUtilities';

const LOGO = require('../assets/notelawbs-logo.png');
const QUICK_TAGS = ['judgment', 'statute', 'brief', 'evidence', 'research'];
export const DOC_SIDEBAR_COLLAPSED_W = 40;

type Props = {
  compact?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export default function DocSidebar({
  compact = false,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const p = useTheme();
  const library = useStore((s) => s.library);
  const activeDocId = useStore((s) => s.activeDocId);
  const highlights = useStore((s) => s.highlights);
  const openPdf = useStore((s) => s.openPdf);
  const selectLibraryDoc = useStore((s) => s.selectLibraryDoc);
  const updateLibraryDoc = useStore((s) => s.updateLibraryDoc);
  const projectTitle = useStore((s) => s.projectTitle);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(true);
  const s = styles(p, compact);

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

  if (collapsed) {
    return (
      <View style={s.collapsedRail}>
        <Pressable
          style={({ pressed }) => [s.expandBtn, pressed && { backgroundColor: p.hover }]}
          onPress={onToggleCollapse}
          accessibilityLabel="Expand documents sidebar">
          <PanelLeftOpen size={ICON_SIZE} color={p.textMid} strokeWidth={1.5} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.expandBtn, pressed && { backgroundColor: p.hover }]}
          onPress={openAddMenu}
          accessibilityLabel="Add document">
          <Plus size={ICON_SIZE} color={p.textMuted} strokeWidth={1.5} />
        </Pressable>
      </View>
    );
  }

  if (compact) {
    return (
      <View style={s.root}>
        <Image source={LOGO} style={s.compactLogo} resizeMode="contain" accessibilityLabel="NoteLawbs.Ai" />
        {onToggleCollapse ? (
          <Pressable
            style={({ pressed }) => [s.compactRow, pressed && { backgroundColor: p.hover }]}
            onPress={onToggleCollapse}
            accessibilityLabel="Collapse documents sidebar">
            <PanelLeftClose size={ICON_SIZE} color={p.textMuted} strokeWidth={1.5} />
          </Pressable>
        ) : null}
        <ScrollView style={s.list} contentContainerStyle={s.compactList} showsVerticalScrollIndicator={false}>
          {visible.map((doc) => {
            const active = doc.id === activeDocId;
            return (
              <Pressable
                key={doc.id}
                style={({ pressed }) => [
                  s.compactRow,
                  (active || pressed) && { backgroundColor: p.hover },
                ]}
                onPress={() => selectLibraryDoc(doc.id)}
                onLongPress={active ? editTags : undefined}
                accessibilityLabel={doc.name}>
                <FileText size={ICON_SIZE} color={active ? p.text : p.textMuted} strokeWidth={1.5} />
              </Pressable>
            );
          })}
          <Pressable
            style={({ pressed }) => [s.compactRow, pressed && { backgroundColor: p.hover }]}
            onPress={openAddMenu}
            accessibilityLabel="Add document">
            <Plus size={ICON_SIZE} color={p.textMuted} strokeWidth={1.5} />
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.workspaceRow}>
        <Pressable
          style={({ pressed }) => [s.workspace, pressed && { backgroundColor: p.hover }]}
          onPress={() => {}}>
          <Image source={LOGO} style={s.logo} resizeMode="contain" />
          <Text style={s.workspaceLabel} numberOfLines={1}>
            {projectTitle || 'NoteLawbs.Ai'}
          </Text>
        </Pressable>
        {onToggleCollapse ? (
          <Pressable
            hitSlop={8}
            onPress={onToggleCollapse}
            style={({ pressed }) => [s.collapseBtn, pressed && { backgroundColor: p.hover }]}
            accessibilityLabel="Collapse documents sidebar">
            <PanelLeftClose size={16} color={p.textMuted} strokeWidth={1.5} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}>
        {usedTags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterContent}>
            <Pressable
              style={[s.filterChip, !tagFilter && s.filterChipOn]}
              onPress={() => setTagFilter(null)}>
              <Text style={[s.filterText, !tagFilter && s.filterTextOn]}>All</Text>
            </Pressable>
            {usedTags.map((t) => (
              <Pressable
                key={t}
                style={[s.filterChip, tagFilter === t && s.filterChipOn]}
                onPress={() => setTagFilter(tagFilter === t ? null : t)}>
                <Text style={[s.filterText, tagFilter === t && s.filterTextOn]} numberOfLines={1}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Pressable style={s.sectionHead} onPress={() => setDocsOpen((v) => !v)}>
          {docsOpen ? (
            <ChevronDown size={14} color={p.textMuted} strokeWidth={1.5} />
          ) : (
            <ChevronRight size={14} color={p.textMuted} strokeWidth={1.5} />
          )}
          <Text style={s.sectionLabel}>Documents</Text>
          <Pressable hitSlop={8} onPress={openAddMenu} style={s.ghostAdd}>
            <Plus size={14} color={p.textMuted} strokeWidth={1.5} />
          </Pressable>
        </Pressable>

        {docsOpen
          ? visible.map((doc) => {
              const active = doc.id === activeDocId;
              const count = highlights.filter((h) => h.docId === doc.id).length;
              return (
                <Pressable
                  key={doc.id}
                  style={({ pressed }) => [
                    s.row,
                    (active || pressed) && { backgroundColor: p.hover },
                  ]}
                  onPress={() => selectLibraryDoc(doc.id)}
                  onLongPress={active ? editTags : undefined}>
                  <FileText
                    size={ICON_SIZE}
                    color={active ? p.text : p.textMuted}
                    strokeWidth={1.5}
                  />
                  <Text style={[s.rowLabel, active && s.rowLabelActive]} numberOfLines={1}>
                    {doc.name.replace(/\.pdf$/i, '')}
                  </Text>
                  {count > 0 ? <Text style={s.count}>{count > 99 ? '99+' : count}</Text> : null}
                </Pressable>
              );
            })
          : null}

        {activeDoc ? (
          <Pressable style={s.tagHint} onPress={editTags}>
            <Text style={s.tagHintText} numberOfLines={2}>
              {(activeDoc.tags || []).length
                ? (activeDoc.tags || []).join(' · ')
                : 'Long-press a doc to tag'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = (p: ReturnType<typeof getPalette>, compact: boolean) =>
  StyleSheet.create({
    root: {
      width: compact ? SIDEBAR_COMPACT_W : SIDEBAR_W,
      backgroundColor: p.sidebar,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: p.separator,
      paddingTop: 6,
      alignItems: compact ? 'center' : undefined,
    },
    collapsedRail: {
      width: DOC_SIDEBAR_COLLAPSED_W,
      backgroundColor: p.sidebar,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: p.separator,
      paddingTop: 10,
      alignItems: 'center',
      gap: 4,
    },
    expandBtn: {
      width: 32,
      height: 32,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    workspaceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 4,
      marginBottom: 8,
    },
    workspace: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: RADIUS.md,
      minHeight: ROW_H + 4,
    },
    collapseBtn: {
      width: 28,
      height: 28,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 4,
    },
    logo: { width: 22, height: 22 },
    compactLogo: { width: 28, height: 28, marginBottom: 8, marginTop: 4 },
    workspaceLabel: {
      ...TYPE.subhead,
      fontWeight: '600',
      color: p.text,
      flex: 1,
    },
    list: { flex: 1, width: '100%' },
    listContent: { paddingBottom: 28, paddingHorizontal: 8, gap: 1 },
    compactList: { paddingBottom: 28, alignItems: 'center', gap: 2, paddingHorizontal: 6 },
    compactRow: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterContent: { gap: 4, paddingBottom: 8, alignItems: 'center' },
    filterChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: RADIUS.sm,
      backgroundColor: 'transparent',
      marginRight: 2,
    },
    filterChipOn: { backgroundColor: p.hover },
    filterText: { fontSize: 12, fontWeight: '500', color: p.textMuted },
    filterTextOn: { color: p.text },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 4,
      minHeight: ROW_H,
      marginTop: 4,
    },
    sectionLabel: {
      ...TYPE.caption1,
      fontWeight: '500',
      color: p.textMuted,
      flex: 1,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    ghostAdd: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.sm,
      opacity: 0.7,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      minHeight: ROW_H,
      borderRadius: RADIUS.md,
      marginLeft: 12,
    },
    rowLabel: {
      ...TYPE.subhead,
      color: p.textMid,
      flex: 1,
    },
    rowLabelActive: { color: p.text, fontWeight: '500' },
    count: {
      ...TYPE.caption2,
      color: p.textMuted,
      fontWeight: '500',
    },
    tagHint: { paddingHorizontal: 10, paddingTop: 10 },
    tagHintText: {
      ...TYPE.caption2,
      color: p.textMuted,
      lineHeight: 14,
    },
  });
