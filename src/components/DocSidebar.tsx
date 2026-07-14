import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { Plus, FileText } from 'lucide-react-native';
import { useStore } from '../store';
import { getPalette, useTheme, RADIUS, TYPE } from '../theme';

export default function DocSidebar() {
  const p = useTheme();
  const library = useStore((s) => s.library);
  const activeDocId = useStore((s) => s.activeDocId);
  const highlights = useStore((s) => s.highlights);
  const openPdf = useStore((s) => s.openPdf);
  const selectLibraryDoc = useStore((s) => s.selectLibraryDoc);
  const s = styles(p);

  const addDocument = async () => {
    try {
      const file = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf],
        copyTo: 'cachesDirectory',
      });
      const uri = file.fileCopyUri || file.uri;
      await openPdf(uri, file.name || 'document.pdf');
    } catch (e: any) {
      if (!DocumentPicker.isCancel(e)) {
        /* ignore */
      }
    }
  };

  return (
    <View style={s.root}>
      <Text style={s.header}>Documents</Text>
      <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {library.map((doc) => {
          const active = doc.id === activeDocId;
          const count = highlights.filter((h) => h.docId === doc.id).length;
          return (
            <TouchableOpacity
              key={doc.id}
              style={[s.docCard, active && s.docCardActive]}
              onPress={() => selectLibraryDoc(doc.id)}
              activeOpacity={0.72}>
              <View style={[s.thumb, active && s.thumbActive]}>
                <FileText size={22} color={active ? p.tint : p.textMuted} strokeWidth={1.8} />
                {count > 0 && (
                  <View style={s.countPip}>
                    <Text style={s.countText}>{count}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.docName, active && s.docNameActive]} numberOfLines={3}>
                {doc.name.replace(/\.pdf$/i, '')}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={s.addCard} onPress={addDocument} activeOpacity={0.72}>
          <View style={s.addIcon}>
            <Plus size={20} color={p.tint} strokeWidth={2.4} />
          </View>
          <Text style={s.addText}>Add PDF</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    root: {
      width: 120,
      backgroundColor: p.bg,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: p.separator,
      paddingTop: 10,
    },
    header: {
      ...TYPE.caption2,
      color: p.textMid,
      textAlign: 'center',
      marginBottom: 10,
      fontWeight: '600',
    },
    list: { flex: 1 },
    listContent: { gap: 10, paddingBottom: 24, paddingHorizontal: 8 },
    docCard: {
      alignItems: 'center',
      padding: 6,
      borderRadius: RADIUS.sm,
    },
    docCardActive: { backgroundColor: p.tintSoft },
    thumb: {
      width: '100%',
      aspectRatio: 0.72,
      maxHeight: 88,
      borderRadius: RADIUS.sm,
      backgroundColor: p.grouped,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.separator,
    },
    thumbActive: { borderColor: p.tint, borderWidth: 2 },
    countPip: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: p.tint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    docName: {
      ...TYPE.caption2,
      color: p.textMid,
      fontWeight: '500',
      lineHeight: 14,
      textAlign: 'center',
    },
    docNameActive: { color: p.text, fontWeight: '600' },
    addCard: {
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: RADIUS.sm,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: p.separator,
      gap: 6,
    },
    addIcon: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.sm,
      backgroundColor: p.tintSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addText: { ...TYPE.caption2, color: p.tint, fontWeight: '600' },
  });
