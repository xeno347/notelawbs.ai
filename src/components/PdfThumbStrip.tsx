import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import Pdf from 'react-native-pdf';
import { getPalette, useTheme, RADIUS } from '../theme';

type Props = {
  docUri: string;
  numPages: number;
  currentPage: number;
  password?: string;
  markedPages: Set<number>;
  onSelectPage: (page: number) => void;
};

/** Compact real PDF thumbnails for the reader dock. */
export default function PdfThumbStrip({
  docUri,
  numPages,
  currentPage,
  password,
  markedPages,
  onSelectPage,
}: Props) {
  const p = useTheme();
  const s = styles(p);
  const pages = useMemo(
    () => Array.from({ length: Math.min(numPages, 120) }, (_, i) => i + 1),
    [numPages],
  );

  if (numPages <= 1) return null;

  return (
    <FlatList
      horizontal
      data={pages}
      keyExtractor={(pg) => String(pg)}
      showsHorizontalScrollIndicator={false}
      style={s.strip}
      contentContainerStyle={s.content}
      initialScrollIndex={Math.max(0, Math.min(currentPage - 1, pages.length - 1))}
      getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
      onScrollToIndexFailed={() => {}}
      windowSize={5}
      maxToRenderPerBatch={6}
      initialNumToRender={8}
      renderItem={({ item: pg }) => {
        const active = pg === currentPage;
        const hasMark = markedPages.has(pg);
        return (
          <TouchableOpacity
            style={[s.thumb, active && s.thumbActive]}
            onPress={() => onSelectPage(pg)}
            accessibilityLabel={`Page ${pg}`}>
            <View style={s.pdfWrap} pointerEvents="none">
              <Pdf
                source={{ uri: docUri }}
                page={pg}
                singlePage
                fitPolicy={2}
                scale={1}
                minScale={1}
                maxScale={1}
                spacing={0}
                enablePaging
                password={password || undefined}
                style={s.pdf}
                onError={() => {}}
              />
            </View>
            {hasMark ? <View style={[s.dot, { backgroundColor: p.accent }]} /> : null}
          </TouchableOpacity>
        );
      }}
      ListFooterComponent={
        numPages > 120 ? <Text style={s.more}>+{numPages - 120}</Text> : null
      }
    />
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    strip: { maxHeight: 56 },
    content: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
    thumb: {
      width: 38,
      height: 50,
      borderRadius: 5,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.separator,
      backgroundColor: p.pdfPage,
    },
    thumbActive: {
      borderColor: p.tint,
      borderWidth: 1.5,
    },
    pdfWrap: { flex: 1 },
    pdf: { flex: 1, width: '100%', height: '100%', backgroundColor: p.pdfPage },
    dot: {
      position: 'absolute',
      top: 3,
      right: 3,
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    more: {
      alignSelf: 'center',
      paddingHorizontal: 8,
      fontSize: 11,
      color: p.textMuted,
      fontWeight: '600',
    },
  });
