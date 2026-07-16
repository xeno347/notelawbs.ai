import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Plus, Trash2, BookOpen } from 'lucide-react-native';
import { useStore } from '../store';
import { getPalette, useTheme, SERIF, RADIUS, ELEVATION } from '../theme';

/**
 * PRD 4.2 Linear Notes — plain text blocks with optional page pills.
 * Not a full rich-text editor (V1 scope).
 */
export default function LinearNotesPanel() {
  const p = useTheme();
  const notes = useStore((s) => s.linearNotes);
  const currentPage = useStore((s) => s.currentPage);
  const addLinearNote = useStore((s) => s.addLinearNote);
  const updateLinearNote = useStore((s) => s.updateLinearNote);
  const removeLinearNote = useStore((s) => s.removeLinearNote);
  const jumpToPage = useStore((s) => s.jumpToPage);
  const [draft, setDraft] = useState('');
  const s = styles(p);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    addLinearNote(text, currentPage);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}>
      <View style={s.header}>
        <Text style={s.title}>Notes</Text>
        <Text style={s.sub}>Plain blocks linked to the page you’re reading.</Text>
      </View>

      <View style={s.composer}>
        <TextInput
          style={s.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder={`Note at p. ${currentPage || '—'}…`}
          placeholderTextColor={p.textMuted}
          multiline
        />
        <TouchableOpacity style={s.addBtn} onPress={add} accessibilityLabel="Add note">
          <Plus size={18} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.list} contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled">
        {notes.length === 0 ? (
          <Text style={s.empty}>No notes yet. Add a line while reading — it stays linked to the page.</Text>
        ) : (
          notes.map((n) => (
            <View key={n.id} style={s.card}>
              <View style={s.cardTop}>
                {n.page ? (
                  <TouchableOpacity style={s.pill} onPress={() => jumpToPage(n.page!)}>
                    <BookOpen size={12} color={p.tint} strokeWidth={2.2} />
                    <Text style={s.pillText}>p. {n.page}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[s.pill, s.pillMuted]}>
                    <Text style={[s.pillText, { color: p.textMuted }]}>No page</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => removeLinearNote(n.id)} hitSlop={8}>
                  <Trash2 size={14} color={p.textMuted} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={s.noteInput}
                value={n.text}
                onChangeText={(text) => updateLinearNote(n.id, { text })}
                multiline
                placeholder="Write…"
                placeholderTextColor={p.textMuted}
              />
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: p.bg },
    header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 4 },
    title: { fontSize: 20, fontWeight: '700', color: p.text, letterSpacing: -0.3 },
    sub: { fontSize: 13, color: p.textMuted, lineHeight: 17 },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    composerInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      backgroundColor: p.grouped,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: p.text,
      fontFamily: SERIF,
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: p.tint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },
    empty: { color: p.textMuted, fontSize: 13, lineHeight: 18, paddingTop: 24 },
    card: {
      backgroundColor: p.grouped,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.separator,
      padding: 12,
      gap: 8,
      ...ELEVATION.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: RADIUS.pill,
      backgroundColor: p.tintSoft,
    },
    pillMuted: { backgroundColor: p.fillSecondary },
    pillText: { fontSize: 11, fontWeight: '700', color: p.tint },
    noteInput: {
      fontSize: 15,
      lineHeight: 21,
      color: p.text,
      fontFamily: SERIF,
      minHeight: 48,
      textAlignVertical: 'top',
      padding: 0,
    },
  });
