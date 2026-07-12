import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { getPalette } from '../theme';

export default function TopBar({
  onResearch,
  onReset,
  researchOpen,
}: {
  onResearch: () => void;
  onReset: () => void;
  researchOpen: boolean;
}) {
  const insets = useSafeAreaInsets();
  const p = getPalette();
  const threadsOn = useStore((s) => s.threadsOn);
  const toggleThreads = useStore((s) => s.toggleThreads);

  const s = styles(p);

  return (
    <View style={[s.bar, { paddingTop: insets.top + 8 }]}>
      <View style={s.spine} />
      <View style={s.brandWrap}>
        <Text style={s.brand}>
          LitNotes<Text style={s.brandLight}> Canvas</Text>
        </Text>
        <Text style={s.note} numberOfLines={1}>
          Single-user prototype · everything stays on this machine
        </Text>
      </View>

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.btn, threadsOn ? s.btnActive : s.btnGhost]}
          onPress={toggleThreads}>
          <Text style={[s.btnText, threadsOn && s.btnTextActive]}>
            Threads {threadsOn ? 'on' : 'off'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.btn, researchOpen ? s.btnActive : s.btnGhost]}
          onPress={onResearch}>
          <Text style={[s.btnText, researchOpen && s.btnTextActive]}>
            Legal research
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={onReset}>
          <Text style={s.btnText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    bar: {
      backgroundColor: p.topbar,
      paddingHorizontal: 14,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      zIndex: 100,
    },
    spine: {
      width: 5,
      height: 22,
      borderRadius: 1.5,
      backgroundColor: p.accent,
    },
    brandWrap: { flex: 1, minWidth: 0 },
    brand: { color: p.topbarText, fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
    brandLight: { color: '#9AA7B3', fontWeight: '400' },
    note: { color: p.topbarMuted, fontSize: 10.5, marginTop: 1 },
    actions: { flexDirection: 'row', gap: 6 },
    btn: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 7,
      borderWidth: 1,
    },
    btnGhost: {
      backgroundColor: 'transparent',
      borderColor: 'rgba(242,244,241,0.28)',
    },
    btnActive: {
      backgroundColor: p.accent,
      borderColor: p.accent,
    },
    btnText: { color: p.topbarText, fontSize: 12, fontWeight: '600' },
    btnTextActive: { color: '#fff' },
  });
