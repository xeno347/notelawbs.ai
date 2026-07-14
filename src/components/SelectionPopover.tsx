import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X } from 'lucide-react-native';
import { CATEGORIES, CATEGORY_KEYS, getPalette, useTheme, SERIF, RADIUS, ELEVATION, glow } from '../theme';
import type { CategoryKey } from '../theme';
import type { MarkStyle } from '../store';
import { useAnnotation } from '../annotationStore';
import { translateToEnglish } from '../services/translateService';

export type PopoverSubmit = {
  text: string;
  category: CategoryKey;
  note: string;
  tags: string[];
  markStyle: MarkStyle;
};

const MARK_STYLES: Array<{ key: MarkStyle; label: string }> = [
  { key: 'highlight', label: 'Highlight' },
  { key: 'underline', label: 'Underline' },
  { key: 'strikethrough', label: 'Strike' },
];

export default function SelectionPopover({
  visible,
  page,
  initialText = '',
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  page: number;
  initialText?: string;
  onSubmit: (v: PopoverSubmit) => void;
  onCancel: () => void;
}) {
  const p = useTheme();
  const defaultMark = useAnnotation((s) => s.markStyle);
  const [category, setCategory] = useState<CategoryKey>('key_fact');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [markStyle, setMarkStyle] = useState<MarkStyle>('highlight');
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (visible) {
      setText(initialText);
      setNote('');
      setTagsRaw('');
      setCategory('key_fact');
      setMarkStyle(defaultMark || 'highlight');
    }
  }, [visible, initialText, defaultMark]);

  const submit = () => {
    const tags = tagsRaw
      .split(/[,#]/)
      .map((t) => t.trim())
      .filter(Boolean);
    onSubmit({
      text: text.trim() || `Highlight on p. ${page}`,
      category,
      note: note.trim(),
      tags,
      markStyle,
    });
    setText('');
    setNote('');
    setTagsRaw('');
    setCategory('key_fact');
  };

  const onTranslate = async () => {
    if (!text.trim()) return;
    setTranslating(true);
    try {
      const en = await translateToEnglish(text);
      if (en) setText(en);
    } catch (e: any) {
      Alert.alert('Translation failed', e?.message || 'Could not translate this passage.');
    } finally {
      setTranslating(false);
    }
  };

  const s = styles(p);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onCancel} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <View>
              <Text style={s.title}>Send to canvas</Text>
              <Text style={s.subtitle}>
                Page {page} · {CATEGORIES[category].label} · {markStyle}
              </Text>
            </View>
            <TouchableOpacity onPress={onCancel} hitSlop={10} style={s.closeBtn}>
              <X size={18} color={p.textMuted} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.catRow}>
              {CATEGORY_KEYS.map((key) => {
                const active = category === key;
                const cat = CATEGORIES[key];
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      s.catPill,
                      { borderColor: active ? cat.color : p.border },
                      active && { backgroundColor: cat.soft },
                    ]}
                    onPress={() => setCategory(key)}>
                    <View style={[s.catDot, { backgroundColor: cat.color }]} />
                    <Text style={[s.catText, active && { color: cat.color, fontWeight: '700' }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.catRow}>
              {MARK_STYLES.map((m) => {
                const active = markStyle === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[s.catPill, { borderColor: active ? p.tint : p.border }, active && { backgroundColor: p.tintSoft }]}
                    onPress={() => setMarkStyle(m.key)}>
                    <Text style={[s.catText, active && { color: p.tint, fontWeight: '700' }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[s.quoteWrap, { borderLeftColor: CATEGORIES[category].color }]}>
              <TextInput
                style={s.quoteInput}
                placeholder="Passage text (from OCR — edit if needed)"
                placeholderTextColor={p.textMuted}
                value={text}
                onChangeText={setText}
                multiline
              />
            </View>

            <TouchableOpacity style={s.translateBtn} onPress={onTranslate} disabled={translating || !text.trim()}>
              {translating ? (
                <ActivityIndicator size="small" color={p.tint} />
              ) : (
                <Text style={s.translateText}>Translate to English</Text>
              )}
            </TouchableOpacity>

            <TextInput
              style={s.noteInput}
              placeholder="Optional note for this excerpt…"
              placeholderTextColor={p.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
            />
            <TextInput
              style={s.noteInput}
              placeholder="Tags (comma-separated, e.g. limitation, jurisdiction)"
              placeholderTextColor={p.textMuted}
              value={tagsRaw}
              onChangeText={setTagsRaw}
            />
          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.submitBtn} onPress={submit}>
              <Text style={s.submitText}>Highlight + canvas</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: p.overlay },
    sheet: {
      backgroundColor: p.surface,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      paddingHorizontal: 18,
      paddingBottom: Platform.OS === 'ios' ? 28 : 18,
      paddingTop: 10,
      maxHeight: '78%',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      ...ELEVATION.popover,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: p.borderStrong,
      marginBottom: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    title: { fontSize: 17, fontWeight: '800', color: p.text, fontFamily: SERIF },
    subtitle: { fontSize: 12, color: p.textMuted, marginTop: 2 },
    closeBtn: { padding: 4 },
    catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    catPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      borderWidth: 1.5,
      backgroundColor: p.bg,
    },
    catDot: { width: 8, height: 8, borderRadius: 4 },
    catText: { fontSize: 12, color: p.textMid, fontWeight: '600' },
    quoteWrap: {
      borderLeftWidth: 3,
      paddingLeft: 12,
      marginBottom: 8,
      backgroundColor: p.bg,
      borderRadius: RADIUS.sm,
      paddingVertical: 10,
      paddingRight: 10,
    },
    quoteInput: {
      minHeight: 72,
      color: p.text,
      fontSize: 15,
      fontFamily: SERIF,
      fontStyle: 'italic',
      lineHeight: 22,
      textAlignVertical: 'top',
      padding: 0,
    },
    translateBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: RADIUS.sm,
      backgroundColor: p.aiSoft,
      marginBottom: 12,
      minWidth: 140,
      alignItems: 'center',
    },
    translateText: { fontSize: 12, fontWeight: '700', color: p.ai },
    noteInput: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.sm,
      padding: 12,
      minHeight: 52,
      color: p.text,
      backgroundColor: p.bg,
      marginBottom: 12,
      textAlignVertical: 'top',
      fontSize: 14,
    },
    actions: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingTop: 4 },
    cancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: RADIUS.sm,
      backgroundColor: p.surface2,
    },
    cancelText: { color: p.text, fontWeight: '600', fontSize: 14 },
    submitBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: RADIUS.sm,
      backgroundColor: p.tint,
      alignItems: 'center',
      ...glow(p.tintSoft, 0.5),
    },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  });
