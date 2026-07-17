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
  Pressable,
} from 'react-native';
import { Plus, Trash2, BookOpen, LayoutGrid, Pencil } from 'lucide-react-native';
import { useStore } from '../store';
import { getPalette, useTheme, RADIUS, ELEVATION, ICON_SIZE } from '../theme';
import MarkdownText from './MarkdownText';

/**
 * Linear notes with minimal markdown (bold/italic/headings/lists)
 * and a bridge to drop notes onto the canvas.
 */
export default function LinearNotesPanel() {
  const p = useTheme();
  const notes = useStore((s) => s.linearNotes);
  const currentPage = useStore((s) => s.currentPage);
  const addLinearNote = useStore((s) => s.addLinearNote);
  const updateLinearNote = useStore((s) => s.updateLinearNote);
  const removeLinearNote = useStore((s) => s.removeLinearNote);
  const sendLinearNoteToCanvas = useStore((s) => s.sendLinearNoteToCanvas);
  const setRightPaneMode = useStore((s) => s.setRightPaneMode);
  const jumpToPage = useStore((s) => s.jumpToPage);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const s = styles(p);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    addLinearNote(text, currentPage);
    setDraft('');
  };

  const sendToCanvas = (id: string) => {
    sendLinearNoteToCanvas(id);
    setRightPaneMode('canvas');
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}>
      <View style={s.header}>
        <Text style={s.title}>Notes</Text>
        <Text style={s.sub}>
          Markdown: **bold**, *italic*, # headings, - bullets. Send to canvas anytime.
        </Text>
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
          <Plus size={18} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.list} contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled">
        {notes.length === 0 ? (
          <Text style={s.empty}>
            No notes yet. Capture while reading — use markdown for structure, then send to canvas to
            map the argument.
          </Text>
        ) : (
          notes.map((n) => {
            const editing = editingId === n.id;
            return (
              <View key={n.id} style={s.card}>
                <View style={s.cardTop}>
                  {n.page ? (
                    <TouchableOpacity style={s.pill} onPress={() => jumpToPage(n.page!)}>
                      <BookOpen size={12} color={p.tint} strokeWidth={1.5} />
                      <Text style={s.pillText}>p. {n.page}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[s.pill, s.pillMuted]}>
                      <Text style={[s.pillText, { color: p.textMuted }]}>No page</Text>
                    </View>
                  )}
                  <View style={s.actions}>
                    <TouchableOpacity
                      onPress={() => setEditingId(editing ? null : n.id)}
                      hitSlop={8}
                      accessibilityLabel={editing ? 'Done editing' : 'Edit'}>
                      <Pencil size={ICON_SIZE - 2} color={editing ? p.tint : p.textMuted} strokeWidth={1.5} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => sendToCanvas(n.id)}
                      hitSlop={8}
                      accessibilityLabel="Send to canvas">
                      <LayoutGrid size={ICON_SIZE - 2} color={p.textMuted} strokeWidth={1.5} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeLinearNote(n.id)} hitSlop={8}>
                      <Trash2 size={ICON_SIZE - 2} color={p.textMuted} strokeWidth={1.5} />
                    </TouchableOpacity>
                  </View>
                </View>
                {editing ? (
                  <TextInput
                    style={s.noteInput}
                    value={n.text}
                    onChangeText={(text) => updateLinearNote(n.id, { text })}
                    multiline
                    autoFocus
                    placeholder="Write markdown…"
                    placeholderTextColor={p.textMuted}
                    onBlur={() => setEditingId(null)}
                  />
                ) : (
                  <Pressable onPress={() => setEditingId(n.id)}>
                    <MarkdownText text={n.text || ' '} color={p.text} />
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: p.bg },
    header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 4 },
    title: { fontSize: 20, fontWeight: '600', color: p.text, letterSpacing: -0.3 },
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
      backgroundColor: p.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: p.text,
    },
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.md,
      backgroundColor: p.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 8 },
    empty: { color: p.textMuted, fontSize: 13, lineHeight: 18, paddingTop: 24 },
    card: {
      backgroundColor: p.surface,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      padding: 16,
      gap: 8,
      ...ELEVATION.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: RADIUS.sm,
      backgroundColor: p.tintSoft,
    },
    pillMuted: { backgroundColor: p.fillSecondary },
    pillText: { fontSize: 11, fontWeight: '500', color: p.tint },
    noteInput: {
      fontSize: 16,
      lineHeight: 24,
      color: p.text,
      minHeight: 48,
      textAlignVertical: 'top',
      padding: 0,
    },
  });
