import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  FileText,
  Image as ImageIcon,
  Archive,
  Share2,
  FileDown,
  FileType,
} from 'lucide-react-native';
import { useTheme, RADIUS, TYPE } from '../theme';
import { AppButton } from './ui';

export type ExportPreset =
  | 'chamber_brief'
  | 'canvas_png'
  | 'notes_md'
  | 'notes_word'
  | 'annotated_pdf'
  | 'annotated_html'
  | 'source_pdf'
  | 'matter_backup'
  | 'import_backup'
  | 'compress_pdf'
  | 'import_word'
  | 'pdf_to_word';

type Props = {
  visible: boolean;
  onClose: () => void;
  onShareLive: () => void;
  onPreset: (preset: ExportPreset) => void;
};

const PRESETS: Array<{
  key: ExportPreset;
  title: string;
  hint: string;
  icon: React.ComponentType<any>;
}> = [
  {
    key: 'chamber_brief',
    title: 'Chamber brief',
    hint: 'Annotated PDF + notes outline — ready to file or circulate.',
    icon: FileText,
  },
  {
    key: 'annotated_pdf',
    title: 'Annotated PDF',
    hint: 'Bake highlights and ink into a shareable PDF.',
    icon: FileDown,
  },
  {
    key: 'canvas_png',
    title: 'Canvas snapshot',
    hint: 'PNG of the argument map.',
    icon: ImageIcon,
  },
  {
    key: 'notes_md',
    title: 'Notes outline',
    hint: 'Markdown outline of linear notes and marks.',
    icon: FileType,
  },
  {
    key: 'matter_backup',
    title: 'Matter backup',
    hint: 'JSON project sync — canvas, marks, and index.',
    icon: Archive,
  },
];

const MORE: Array<{ key: ExportPreset; title: string }> = [
  { key: 'notes_word', title: 'Notes → Word' },
  { key: 'pdf_to_word', title: 'PDF text → Word' },
  { key: 'annotated_html', title: 'Annotated HTML report' },
  { key: 'source_pdf', title: 'Source PDF' },
  { key: 'compress_pdf', title: 'Compress PDF copy' },
  { key: 'import_word', title: 'Import Word → PDF' },
  { key: 'import_backup', title: 'Import matter backup' },
];

export default function ExportSheet({ visible, onClose, onShareLive, onPreset }: Props) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const maxW = Math.min(440, width - 32);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.28)' }]} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: p.surface,
              borderColor: p.border,
              maxWidth: maxW,
              marginBottom: insets.bottom + 16,
            },
          ]}
          onPress={(e) => e.stopPropagation()}>
          <View style={styles.head}>
            <Text style={[TYPE.title3, { color: p.text }]}>Share & export</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={p.textMuted} strokeWidth={1.5} />
            </Pressable>
          </View>
          <Text style={[TYPE.caption1, { color: p.textMuted, marginBottom: 14 }]}>
            Filing presets first — more formats below.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            <AppButton
              label="Live share workspace"
              variant="secondary"
              onPress={() => {
                onClose();
                onShareLive();
              }}
              leading={<Share2 size={16} color={p.text} strokeWidth={1.5} />}
              full
            />
            <View style={{ height: 14 }} />
            {PRESETS.map((item) => {
              const Icon = item.icon;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    onClose();
                    onPreset(item.key);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: p.border, backgroundColor: pressed ? p.hover : p.surface2 },
                  ]}>
                  <View style={[styles.iconWrap, { borderColor: p.border, backgroundColor: p.surface }]}>
                    <Icon size={18} color={p.text} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[TYPE.headline, { color: p.text, fontSize: 15 }]}>{item.title}</Text>
                    <Text style={[TYPE.caption1, { color: p.textMuted, marginTop: 2 }]}>{item.hint}</Text>
                  </View>
                </Pressable>
              );
            })}
            <Text style={[TYPE.caption1, { color: p.textMuted, marginTop: 16, marginBottom: 8 }]}>
              More formats
            </Text>
            {MORE.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  onClose();
                  onPreset(item.key);
                }}
                style={({ pressed }) => [
                  styles.moreRow,
                  pressed && { backgroundColor: p.hover },
                ]}>
                <Text style={{ color: p.text, fontSize: 14, fontWeight: '500' }}>{item.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreRow: {
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: RADIUS.sm,
  },
});
