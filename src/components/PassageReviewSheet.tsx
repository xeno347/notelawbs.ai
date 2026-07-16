import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import { Check, Sparkles, Cpu } from 'lucide-react-native';
import { catStyle, getPalette, useTheme, SERIF, RADIUS, ELEVATION } from '../theme';
import { AppButton } from './ui';
import type { ImportantPassage } from '../services/importantPassagesService';

/**
 * Confirmation gate for AI-selected passages: nothing lands on the canvas
 * until the user reviews and confirms which cards to keep. Replaces the
 * previous behavior of silently auto-adding every AI pick.
 */
export default function PassageReviewSheet({
  passages,
  mode,
  onConfirm,
  onDismiss,
}: {
  passages: ImportantPassage[];
  mode: 'live' | 'on-device';
  onConfirm: (selected: ImportantPassage[]) => void;
  onDismiss: () => void;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const s = styles(p);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectedCount = passages.length - excluded.size;
  const allSelected = excluded.size === 0;

  return (
    <Modal animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={s.backdrop}>
        <View style={s.panel}>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType={p.blurType}
            blurAmount={26}
            reducedTransparencyFallbackColor={p.bg}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: p.glassTint }]} />

          <View style={[s.header, { paddingTop: insets.top + 18 }]}>
            <View style={s.headerTitleRow}>
              {mode === 'live' ? (
                <Sparkles size={18} color={p.ai} strokeWidth={2.2} />
              ) : (
                <Cpu size={18} color={p.textMid} strokeWidth={2.2} />
              )}
              <Text style={s.title}>Review passages</Text>
            </View>
            <TouchableOpacity onPress={onDismiss} style={s.closeBtn}>
              <Text style={s.closeText}>Dismiss</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.subtitle}>
            {mode === 'live' ? 'Live AI' : 'On-device analysis'} found {passages.length} candidate
            {passages.length === 1 ? '' : 's'}. Nothing is added to the canvas until you confirm.
          </Text>

          <TouchableOpacity
            style={s.selectAllRow}
            onPress={() => setExcluded(allSelected ? new Set(passages.map((_, i) => i)) : new Set())}>
            <Text style={s.selectAllText}>{allSelected ? 'Deselect all' : 'Select all'}</Text>
            <Text style={s.selectAllCount}>
              {selectedCount} of {passages.length} selected
            </Text>
          </TouchableOpacity>

          <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 16 }}>
            {passages.map((passage, index) => {
              const cs = catStyle(passage.category);
              const checked = !excluded.has(index);
              return (
                <TouchableOpacity
                  key={index}
                  style={[s.row, !checked && s.rowExcluded]}
                  activeOpacity={0.75}
                  onPress={() => toggle(index)}>
                  <View style={[s.checkbox, checked && { backgroundColor: cs.color, borderColor: cs.color }]}>
                    {checked && <Check size={13} color="#fff" strokeWidth={3} />}
                  </View>
                  <View style={s.rowBody}>
                    <View style={s.rowTop}>
                      <View style={[s.catBadge, { backgroundColor: cs.color }]}>
                        <Text style={s.catBadgeText}>{cs.label}</Text>
                      </View>
                      <Text style={s.pageText}>p. {passage.page}</Text>
                    </View>
                    <Text style={s.quote} numberOfLines={3}>
                      {passage.text}
                    </Text>
                    {!!passage.reason && (
                      <Text style={s.reason} numberOfLines={2}>
                        {passage.reason}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
            <AppButton
              label={selectedCount ? `Add ${selectedCount} to canvas` : 'Select at least one'}
              onPress={() => onConfirm(passages.filter((_, i) => !excluded.has(i)))}
              disabled={!selectedCount}
              full
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    backdrop: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: p.overlay },
    panel: { width: '90%', maxWidth: 480, overflow: 'hidden', borderLeftWidth: 1, borderLeftColor: p.border, ...ELEVATION.panel },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingBottom: 8,
    },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 20, fontWeight: '800', color: p.text, fontFamily: SERIF },
    closeBtn: { paddingHorizontal: 10, paddingVertical: 6 },
    closeText: { fontSize: 15, fontWeight: '600', color: p.tint },
    subtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: p.textMid,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    selectAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: p.separator,
    },
    selectAllText: { fontSize: 14, fontWeight: '700', color: p.tint },
    selectAllCount: { fontSize: 12, color: p.textMid },
    list: { flex: 1, paddingHorizontal: 14 },
    row: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.separator,
    },
    rowExcluded: { opacity: 0.42 },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: p.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    rowBody: { flex: 1, gap: 4 },
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    catBadge: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: RADIUS.pill },
    catBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },
    pageText: { fontSize: 11.5, color: p.textMuted, fontWeight: '600' },
    quote: { fontFamily: SERIF, fontSize: 13.5, lineHeight: 19, color: p.text },
    reason: { fontSize: 11, fontStyle: 'italic', color: p.textMuted },
    footer: {
      paddingHorizontal: 18,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p.separator,
    },
  });
