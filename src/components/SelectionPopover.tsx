import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { CATEGORIES, CATEGORY_KEYS, getPalette, SERIF, type CategoryKey } from '../theme';

export type PopoverSubmit = {
  text: string;
  category: CategoryKey;
  note: string;
};

export default function SelectionPopover({
  visible,
  page,
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  page: number;
  onSubmit: (v: PopoverSubmit) => void;
  onCancel: () => void;
}) {
  const p = getPalette();
  const [category, setCategory] = useState<CategoryKey>('key_fact');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');

  const submit = () => {
    onSubmit({ text: text.trim() || `Highlight on p. ${page}`, category, note: note.trim() });
    setText('');
    setNote('');
    setCategory('key_fact');
  };

  const s = styles(p);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.swatchRow}>
            {CATEGORY_KEYS.map((key) => (
              <TouchableOpacity
                key={key}
                style={[
                  s.swatch,
                  { backgroundColor: CATEGORIES[key].color },
                  category === key && s.swatchSelected,
                ]}
                onPress={() => setCategory(key)}
              />
            ))}
          </View>
          <Text style={[s.catLabel, { color: CATEGORIES[category].color }]}>
            {CATEGORIES[category].label.toUpperCase()} · p. {page}
          </Text>

          <View style={s.quoteWrap}>
            <TextInput
              style={s.quoteInput}
              placeholder="Type or paste the passage you are marking…"
              placeholderTextColor={p.textMuted}
              value={text}
              onChangeText={setText}
              multiline
            />
          </View>

          <TextInput
            style={s.noteInput}
            placeholder="Optional note…"
            placeholderTextColor={p.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
          />

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.submitBtn} onPress={submit}>
              <Text style={s.submitText}>Highlight + send to canvas</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(29,39,51,0.35)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: p.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: p.border,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    swatchRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
    swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
    swatchSelected: { borderColor: p.text, transform: [{ scale: 1.12 }] },
    catLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 12 },
    quoteWrap: {
      borderLeftWidth: 3,
      borderLeftColor: p.accent,
      paddingLeft: 10,
      marginBottom: 10,
    },
    quoteInput: {
      minHeight: 58,
      color: p.text,
      fontSize: 15,
      fontFamily: SERIF,
      fontStyle: 'italic',
      textAlignVertical: 'top',
      padding: 0,
    },
    noteInput: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 8,
      padding: 8,
      minHeight: 44,
      color: p.text,
      backgroundColor: p.bg,
      marginBottom: 12,
      textAlignVertical: 'top',
    },
    actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    cancelBtn: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 8, backgroundColor: p.surface2 },
    cancelText: { color: p.text },
    submitBtn: { flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: p.accent, alignItems: 'center' },
    submitText: { color: '#fff', fontWeight: '700' },
  });
