import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import Pdf from 'react-native-pdf';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import { useActiveDocument } from './useActiveDocument';
import {
  ZoomIn,
  ZoomOut,
  Languages,
  Maximize,
  Highlighter,
  MessageSquarePlus,
  Send,
  X,
  Share2,
} from 'lucide-react-native';
import { useCanvas } from './useCanvas';
import { useDragDrop } from './useDragDrop';
import { useAnnotations } from './useAnnotations';
import { createId } from '../../utils/id';
import { DocumentTextMode, HighlightColor, DocumentType } from '../../models/types';
import { shareFile } from './pdfUtils';
import { toLocalFileUri } from '../../utils/filePaths';
import { listOcrPages } from '../auth/backendApi';
import { useAuth } from '../auth/useAuth';

type Props = {
  page: number;
  onPageChanged: (page: number) => void;
};

type OcrBlock = {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence?: number;
};

export default function PdfPane({ page, onPageChanged }: Props) {
  const { settings } = useSettings();
  const { activeDocument, textMode, setTextMode } = useActiveDocument();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const { addCard } = useCanvas();
  const { setDragged } = useDragDrop();
  const { annotations, fetchAnnotations, addAnnotation } = useAnnotations();

  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [ocrData, setOcrData] = useState<any>(null);
  const [composerVisible, setComposerVisible] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<OcrBlock | null>(null);
  const [comment, setComment] = useState('');
  const [highlight, setHighlight] = useState<HighlightColor>(HighlightColor.yellow);
  const unsupportedShareTextStyle = useMemo(() => [styles.modalActionText, { color: '#fff' }], []);
  const modalActionPrimaryTextStyle = useMemo(() => [styles.modalActionText, { color: theme.textPrimary }], [theme.textPrimary]);
  const modalActionLightTextStyle = useMemo(() => [styles.modalActionText, { color: '#fff' }], []);
  const swatchSelectedStyle = useMemo(() => ({ borderColor: theme.accent }), [theme.accent]);

  const loadOcrForPage = useCallback(async (pageIdx: number) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      const pages = await listOcrPages(settings.backendUrl, token, activeDocument!.id);
      const result = pages.ocrPages.find(
        (page) => Number(page.pageIndex) === pageIdx && Boolean(page.isTranslation) === (textMode === DocumentTextMode.english),
      );
      if (result) {
        setOcrData(JSON.parse(result.content));
      } else {
        setOcrData(null);
      }
    } catch (e) {
      console.error('Failed to load OCR data:', e);
    }
  }, [activeDocument, textMode]);

  useEffect(() => {
    if (activeDocument) {
      fetchAnnotations(activeDocument.id);
    }
  }, [activeDocument, fetchAnnotations]);

  useEffect(() => {
    if (activeDocument) {
      loadOcrForPage(page - 1);
    }
  }, [activeDocument, page, loadOcrForPage]);

  if (!activeDocument) {
    return null;
  }

  const source = { uri: toLocalFileUri(activeDocument.filePath), cache: true };
  const pageAnnotations = annotations.filter((annotation) => annotation.documentId === activeDocument.id && annotation.pageIndex === page - 1);

  const handleBlockPress = (block: OcrBlock) => {
    setSelectedBlock(block);
    setComment('');
    setHighlight(HighlightColor.yellow);
    setComposerVisible(true);
  };

  const createCanvasExcerpt = async () => {
    if (!selectedBlock) {
      return;
    }
    addCard({
      id: createId('card'),
      workspaceId: activeDocument.id,
      type: 'excerpt' as any,
      position: { x: 80, y: 80 },
      size: { width: 280, height: 150 },
      content: selectedBlock.text,
      sourceDocumentId: activeDocument.id,
      sourcePageIndex: page,
      sourceTextRange: { start: 0, end: selectedBlock.text.length },
      accentColor: 0xFF6B8E23,
      isPinned: false,
      isBold: false,
      isUnderline: false,
      createdAt: new Date().toISOString(),
    });
    setDragged(null);
    setComposerVisible(false);
  };

  const saveAnnotation = async () => {
    if (!selectedBlock) {
      return;
    }
    await addAnnotation({
      id: createId('ann'),
      documentId: activeDocument.id,
      pageIndex: page - 1,
      textRange: { start: 0, end: selectedBlock.text.length },
      boundingRect: {
        left: selectedBlock.left,
        top: selectedBlock.top,
        width: selectedBlock.width,
        height: selectedBlock.height,
      },
      color: highlight,
      comment: comment.trim() || undefined,
      linkedCanvasCardId: undefined,
      createdAt: new Date().toISOString(),
      underline: false,
      bold: false,
    });
    setComposerVisible(false);
  };

  const highlightColorMap: Record<HighlightColor, string> = {
    [HighlightColor.yellow]: theme.highlightYellow,
    [HighlightColor.pink]: theme.highlightPink,
    [HighlightColor.teal]: theme.highlightTeal,
  };

  if (activeDocument.type !== DocumentType.pdf) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.unsupportedCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.unsupportedTitle, { color: theme.textPrimary }]}>This file is a Word document</Text>
          <Text style={[styles.unsupportedText, { color: theme.textSecondary }]}>
            The local workspace currently previews PDFs. You can keep this file in the library, share it, or convert it outside the app before opening it here.
          </Text>
          <TouchableOpacity onPress={() => shareFile(activeDocument.filePath, activeDocument.title)} style={[styles.unsupportedButton, { backgroundColor: theme.accent }]}>
            <Share2 size={16} color="#fff" />
            <Text style={unsupportedShareTextStyle}>Share file</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.toolbar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={[styles.toolBtn, textMode === DocumentTextMode.english && { backgroundColor: theme.accent + '15' }]}
            onPress={() => setTextMode(textMode === DocumentTextMode.original ? DocumentTextMode.english : DocumentTextMode.original)}
          >
            <Languages size={18} color={textMode === DocumentTextMode.english ? theme.accent : theme.textPrimary} />
            <Text style={[styles.btnText, { color: textMode === DocumentTextMode.english ? theme.accent : theme.textPrimary }]}>
              {textMode === DocumentTextMode.english ? 'English' : 'Original'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.toolGroup}>
          <TouchableOpacity onPress={() => setZoom(Math.max(0.5, zoom - 0.1))} style={styles.iconBtn}>
            <ZoomOut size={18} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.zoomText, { color: theme.textPrimary }]}>{Math.round(zoom * 100)}%</Text>
          <TouchableOpacity onPress={() => setZoom(Math.min(3.0, zoom + 0.1))} style={styles.iconBtn}>
            <ZoomIn size={18} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.toolGroup}>
          <Text style={[styles.pageIndicator, { color: theme.textPrimary }]}>
            {page} / {totalPages}
          </Text>
        </View>

        <TouchableOpacity onPress={() => shareFile(activeDocument.filePath, activeDocument.title)} style={styles.shareBtn}>
          <Share2 size={18} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.viewerContainer}>
        {loading && <ActivityIndicator style={styles.loader} color={theme.accent} />}
        <Pdf
          source={source}
          page={page}
          scale={zoom}
          onLoadComplete={(n) => {
            setTotalPages(n);
            setLoading(false);
          }}
          onPageChanged={(p) => onPageChanged(p)}
          onError={(error) => {
            console.log('PDF Viewer Error:', error);
            setLoading(false);
          }}
          style={[styles.pdf, { backgroundColor: theme.background }]}
        />

        {ocrData && !loading && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {ocrData.blocks.map((block: OcrBlock, idx: number) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.4}
                onLongPress={() => handleBlockPress(block)}
                style={[
                  styles.ocrBlock,
                  {
                    left: block.left * zoom,
                    top: block.top * zoom,
                    width: block.width * zoom,
                    height: block.height * zoom,
                  },
                ]}
              />
            ))}

            {pageAnnotations.map((annotation) => (
              <View
                key={annotation.id}
                style={[
                  styles.annotationBlock,
                  {
                    left: annotation.boundingRect.left * zoom,
                    top: annotation.boundingRect.top * zoom,
                    width: annotation.boundingRect.width * zoom,
                    height: annotation.boundingRect.height * zoom,
                    backgroundColor: highlightColorMap[annotation.color] || theme.highlightYellow,
                  },
                ]}
                pointerEvents="none"
              />
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.fitBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => setZoom(1.0)}
      >
        <Maximize size={16} color={theme.textPrimary} />
      </TouchableOpacity>

      <Modal visible={composerVisible} transparent animationType="fade" onRequestClose={() => setComposerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Add highlight</Text>
                <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>Create a note or send this excerpt to the canvas.</Text>
              </View>
              <TouchableOpacity onPress={() => setComposerVisible(false)}>
                <X size={18} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedBlock && (
              <ScrollView style={[styles.previewBox, { backgroundColor: theme.background }]}>
                <Text style={[styles.previewText, { color: theme.textPrimary }]}>{selectedBlock.text}</Text>
              </ScrollView>
            )}

            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Comment</Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Add a quick note..."
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.background }]}
            />

            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Highlight color</Text>
            <View style={styles.colorRow}>
              {Object.values(HighlightColor).map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setHighlight(item)}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: highlightColorMap[item],
                    },
                    highlight === item ? swatchSelectedStyle : styles.colorSwatchUnselected,
                  ]}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.background }]} onPress={createCanvasExcerpt}>
                <Send size={16} color={theme.textPrimary} />
                <Text style={modalActionPrimaryTextStyle}>To canvas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.accent }]} onPress={saveAnnotation}>
                <Highlighter size={16} color="#fff" />
                <Text style={modalActionLightTextStyle}>Save highlight</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.background }]}
                onPress={() => {
                  setComment('');
                  setComposerVisible(false);
                }}
              >
                <MessageSquarePlus size={16} color={theme.textPrimary} />
                <Text style={modalActionPrimaryTextStyle}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 8,
  },
  toolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 6,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  zoomText: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'center',
  },
  pageIndicator: {
    fontSize: 13,
    fontWeight: '800',
  },
  shareBtn: {
    padding: 8,
    borderRadius: 8,
  },
  viewerContainer: {
    flex: 1,
    position: 'relative',
  },
  pdf: {
    flex: 1,
    width: '100%',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  ocrBlock: {
    position: 'absolute',
    backgroundColor: 'rgba(74, 93, 35, 0.04)',
    borderRadius: 1,
  },
  annotationBlock: {
    position: 'absolute',
    borderRadius: 3,
    opacity: 0.4,
  },
  fitBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalDescription: {
    marginTop: 4,
    lineHeight: 18,
  },
  previewBox: {
    maxHeight: 110,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  previewText: {
    lineHeight: 20,
  },
  modalLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 8,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
  },
  colorSwatchUnselected: {
    borderColor: 'transparent',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  modalBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalActionText: {
    fontWeight: '700',
  },
  unsupportedCard: {
    margin: 20,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
  },
  unsupportedTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  unsupportedText: {
    fontSize: 15,
    lineHeight: 22,
  },
  unsupportedButton: {
    marginTop: 8,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'flex-start',
  },
});
