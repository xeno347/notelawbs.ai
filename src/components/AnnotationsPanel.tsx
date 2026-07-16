import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import { X } from 'lucide-react-native';
import { useStore, type Highlight } from '../store';
import { CATEGORIES, catStyle, getPalette, useTheme, SERIF, RADIUS, ELEVATION } from '../theme';
import type { CategoryKey } from '../theme';

/**
 * PRD 4.4 Annotations panel — list every highlight with page, colour, snippet;
 * tap jumps to the region.
 */
export default function AnnotationsPanel({ onClose }: { onClose: () => void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const highlights = useStore((s) => s.highlights);
  const jumpToHighlight = useStore((s) => s.jumpToHighlight);
  const [filter, setFilter] = useState<CategoryKey | 'all'>('all');
  const s = styles(p);

  const list = useMemo(() => {
    const sorted = [...highlights].sort((a, b) => a.page - b.page || a.rect.y - b.rect.y);
    if (filter === 'all') return sorted;
    return sorted.filter((h) => h.category === filter);
  }, [highlights, filter]);

  const onJump = (h: Highlight) => {
    jumpToHighlight(h.id);
    onClose();
  };

  return (
    <Modal animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[s.panel, { marginTop: insets.top + 12, marginBottom: insets.bottom + 12 }]}>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType={p.blurType}
            blurAmount={26}
            reducedTransparencyFallbackColor={p.bg}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: p.glassTint }]} />

          <View style={s.header}>
            <Text style={s.title}>Annotations</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={20} color={p.textMid} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filters} contentContainerStyle={s.filtersRow}>
            <TouchableOpacity
              style={[s.chip, filter === 'all' && s.chipOn]}
              onPress={() => setFilter('all')}>
              <Text style={[s.chipText, filter === 'all' && s.chipTextOn]}>All ({highlights.length})</Text>
            </TouchableOpacity>
            {(Object.keys(CATEGORIES) as CategoryKey[]).map((key) => {
              const cs = catStyle(key);
              const count = highlights.filter((h) => h.category === key).length;
              if (!count) return null;
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.chip, filter === key && { backgroundColor: cs.soft, borderColor: cs.color }]}
                  onPress={() => setFilter(key)}>
                  <View style={[s.dot, { backgroundColor: cs.color }]} />
                  <Text style={[s.chipText, filter === key && { color: cs.color }]}>
                    {cs.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 24 }}>
            {list.length === 0 ? (
              <Text style={s.empty}>No annotations yet. Highlight text in the reader to populate this list.</Text>
            ) : (
              list.map((h) => {
                const cs = catStyle(h.category);
                return (
                  <TouchableOpacity key={h.id} style={s.row} onPress={() => onJump(h)} activeOpacity={0.85}>
                    <View style={[s.swatch, { backgroundColor: cs.color }]} />
                    <View style={s.rowBody}>
                      <Text style={s.meta}>
                        p. {h.page}
                        {h.markStyle && h.markStyle !== 'highlight' ? ` · ${h.markStyle}` : ''}
                        {h.anchorStatus === 'approximate' ? ' · ≈' : ''}
                      </Text>
                      <Text style={s.snippet} numberOfLines={3}>
                        {h.text || '(empty)'}
                      </Text>
                      {!!h.note && (
                        <Text style={s.note} numberOfLines={2}>
                          {h.note}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', paddingHorizontal: 16 },
    panel: {
      flex: 1,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      ...ELEVATION.float,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    title: { fontSize: 20, fontWeight: '800', color: p.text, fontFamily: SERIF },
    filters: { maxHeight: 44, marginBottom: 4 },
    filtersRow: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      backgroundColor: p.fillSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
    },
    chipOn: { backgroundColor: p.tintSoft, borderColor: p.tint },
    chipText: { fontSize: 12, fontWeight: '700', color: p.textMid },
    chipTextOn: { color: p.tint },
    dot: { width: 8, height: 8, borderRadius: 4 },
    list: { flex: 1, paddingHorizontal: 12 },
    empty: { color: p.textMuted, fontSize: 13, lineHeight: 18, padding: 16 },
    row: {
      flexDirection: 'row',
      gap: 10,
      padding: 12,
      borderRadius: RADIUS.md,
      backgroundColor: p.grouped,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.separator,
      marginBottom: 8,
    },
    swatch: { width: 4, borderRadius: 2 },
    rowBody: { flex: 1, gap: 3 },
    meta: { fontSize: 11, fontWeight: '700', color: p.textMuted, letterSpacing: 0.3 },
    snippet: { fontSize: 14, lineHeight: 19, color: p.text, fontFamily: SERIF },
    note: { fontSize: 12, color: p.textMid, fontStyle: 'italic' },
  });
