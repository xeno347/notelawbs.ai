import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import { useStore } from '../store';
import { getPalette, useTheme, catStyle, SERIF, RADIUS, ELEVATION } from '../theme';
import { buildSearchIndex, searchIndex, type SearchHit, type SearchResult, type SearchHitKind } from '../search/searchIndex';

type Scope = 'all' | 'page' | 'canvas';
const SCOPES: Array<{ key: Scope; label: string }> = [
  { key: 'all', label: 'Everything' },
  { key: 'page', label: 'This page' },
  { key: 'canvas', label: 'Notes & canvas' },
];
const CANVAS_KINDS: SearchHitKind[] = ['excerpt', 'ai', 'note', 'group', 'linear'];

const KIND_LABEL: Record<SearchHitKind, string> = {
  highlight: 'Highlight',
  excerpt: 'Canvas excerpt',
  ai: 'AI memo',
  ocr: 'Scanned page',
  note: 'Note',
  group: 'Section',
  bookmark: 'Index',
  linear: 'Linear note',
};

function Snippet({ text, term, style, matchStyle }: { text: string; term: string; style: any; matchStyle: any }) {
  if (!term) return <Text style={style}>{text}</Text>;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {text.slice(0, idx)}
      <Text style={matchStyle}>{text.slice(idx, idx + term.length)}</Text>
      {text.slice(idx + term.length)}
    </Text>
  );
}

export default function SearchOverlay({ onClose }: { onClose: () => void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const docName = useStore((s) => s.docName);
  const highlights = useStore((s) => s.highlights);
  const nodes = useStore((s) => s.nodes);
  const ocrPages = useStore((s) => s.ocr.pages);
  const bookmarks = useStore((s) => s.bookmarks);
  const linearNotes = useStore((s) => s.linearNotes);
  const currentPage = useStore((s) => s.currentPage);
  const jumpToHighlight = useStore((s) => s.jumpToHighlight);
  const jumpToPage = useStore((s) => s.jumpToPage);
  const requestFocusNode = useStore((s) => s.requestFocusNode);

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [cursor, setCursor] = useState(0);

  const index = useMemo(
    () => buildSearchIndex({ highlights, nodes, ocrPages, bookmarks, linearNotes }),
    [highlights, nodes, ocrPages, bookmarks, linearNotes],
  );
  const scopedIndex = useMemo(() => {
    if (scope === 'page') return index.filter((h: SearchHit) => h.page === currentPage);
    if (scope === 'canvas') return index.filter((h: SearchHit) => CANVAS_KINDS.includes(h.kind));
    return index;
  }, [index, scope, currentPage]);
  const results = useMemo(() => searchIndex(scopedIndex, query), [scopedIndex, query]);
  const firstTerm = query.trim().split(/\s+/)[0] || '';
  const scannedPages = Object.keys(ocrPages).length;

  React.useEffect(() => {
    setCursor(0);
  }, [query, scope, results.length]);

  const jumpHit = (hit: SearchResult) => {
    if (hit.highlightId) {
      jumpToHighlight(hit.highlightId);
      if (hit.nodeId) requestFocusNode(hit.nodeId);
      else {
        const linked = useStore
          .getState()
          .nodes.find(
            (n) => n.type === 'excerpt' && (n.data as any).highlightId === hit.highlightId,
          );
        if (linked) requestFocusNode(linked.id);
      }
    } else if ((hit.kind === 'ocr' || hit.kind === 'bookmark' || hit.kind === 'linear') && hit.page) {
      jumpToPage(hit.page);
    } else if (hit.nodeId) {
      requestFocusNode(hit.nodeId);
    }
  };

  const onPressHit = (hit: SearchResult) => {
    jumpHit(hit);
    onClose();
  };

  const goRelative = (delta: number) => {
    if (!results.length) return;
    const next = (cursor + delta + results.length) % results.length;
    setCursor(next);
    jumpHit(results[next]);
  };

  const s = styles(p);

  return (
    <Modal animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[s.panel, { marginTop: insets.top + 16 }]}>
          <BlurView style={StyleSheet.absoluteFill} blurType={p.blurType} blurAmount={26} reducedTransparencyFallbackColor={p.bg} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: p.glassTint }]} />

          <View style={s.header}>
            <Text style={s.title}>Search</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            autoFocus
            style={s.input}
            placeholder="Search highlights, notes, index, tags, OCR…"
            placeholderTextColor={p.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />

          <View style={s.scopeRow}>
            {SCOPES.map((sc) => {
              const active = scope === sc.key;
              return (
                <TouchableOpacity
                  key={sc.key}
                  style={[s.scopeChip, active && s.scopeChipActive]}
                  onPress={() => setScope(sc.key)}>
                  <Text style={[s.scopeChipText, active && s.scopeChipTextActive]}>{sc.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!docName ? (
            <Text style={s.hint}>Open a PDF to start building a searchable workspace.</Text>
          ) : query.trim().length === 0 ? (
            <Text style={s.hint}>
              {scannedPages > 0
                ? `${scannedPages} page${scannedPages === 1 ? '' : 's'} scanned for text search. Start typing to search.`
                : 'Type to search highlights, canvas notes and AI memos. Use "Scan for search" in the reader to make scanned pages searchable too.'}
            </Text>
          ) : results.length === 0 ? (
            <Text style={s.hint}>No matches for "{query.trim()}".</Text>
          ) : (
            <>
              <View style={s.findBar}>
                <Text style={s.findCount}>
                  {cursor + 1} of {results.length}
                </Text>
                <TouchableOpacity style={s.findBtn} onPress={() => goRelative(-1)}>
                  <Text style={s.findBtnText}>Prev</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.findBtn} onPress={() => goRelative(1)}>
                  <Text style={s.findBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={s.list} keyboardShouldPersistTaps="handled">
                {results.map((hit, i) => {
                  const cs = hit.category ? catStyle(hit.category) : null;
                  const active = i === cursor;
                  return (
                    <TouchableOpacity
                      key={hit.id}
                      style={[s.row, active && { borderColor: p.tint, borderWidth: 1.5 }]}
                      onPress={() => {
                        setCursor(i);
                        onPressHit(hit);
                      }}>
                      <View
                        style={[
                          s.rowBar,
                          { backgroundColor: cs ? cs.color : hit.kind === 'ai' ? p.ai : p.accent },
                        ]}
                      />
                      <View style={s.rowBody}>
                        <View style={s.rowHeader}>
                          <Text style={s.rowKind}>{KIND_LABEL[hit.kind].toUpperCase()}</Text>
                          <Text style={s.rowTitle} numberOfLines={1}>
                            {hit.title}
                          </Text>
                        </View>
                        <Snippet
                          text={hit.snippet}
                          term={firstTerm}
                          style={s.rowSnippet}
                          matchStyle={s.rowMatch}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: p.overlay, alignItems: 'center' },
    panel: {
      width: '92%',
      maxWidth: 640,
      maxHeight: '78%',
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: p.border,
      padding: 18,
      ...ELEVATION.panel,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    title: { fontSize: 19, fontWeight: '700', color: p.text, fontFamily: SERIF },
    closeBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: p.border },
    closeText: { color: p.text, fontSize: 13 },
    input: {
      borderWidth: 1,
      borderColor: p.borderStrong,
      borderRadius: RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: p.text,
      backgroundColor: p.surfaceGlass,
      fontSize: 15,
      marginBottom: 14,
    },
    scopeRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    scopeChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: RADIUS.pill,
      backgroundColor: p.surface2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
    },
    scopeChipActive: { backgroundColor: p.tintSoft, borderColor: p.tint },
    scopeChipText: { fontSize: 12, color: p.textMid, fontWeight: '600' },
    scopeChipTextActive: { color: p.tint, fontWeight: '800' },
    hint: { color: p.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center', paddingVertical: 24, paddingHorizontal: 8 },
    findBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    findCount: { flex: 1, fontSize: 13, fontWeight: '700', color: p.textMid },
    findBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: RADIUS.pill,
      backgroundColor: p.tintSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.tint,
    },
    findBtnText: { fontSize: 12, fontWeight: '800', color: p.tint },
    list: { maxHeight: 440 },
    row: {
      flexDirection: 'row',
      borderRadius: RADIUS.md,
      overflow: 'hidden',
      marginBottom: 8,
      backgroundColor: p.surfaceGlass,
      borderWidth: 1,
      borderColor: p.border,
    },
    rowBar: { width: 4 },
    rowBody: { flex: 1, padding: 12 },
    rowHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
    rowKind: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: p.textMuted },
    rowTitle: { fontSize: 12.5, fontWeight: '700', color: p.text, flexShrink: 1 },
    rowSnippet: { fontSize: 13, lineHeight: 19, color: p.textMid, fontFamily: SERIF },
    rowMatch: { fontWeight: '800', color: p.accent, fontFamily: SERIF },
  });
