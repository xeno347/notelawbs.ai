import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import ReactNativeBlobUtil from 'react-native-blob-util';
import TextRecognition from '@react-native-ml-kit/text-recognition';

export type OcrRect = { x: number; y: number; w: number; h: number };
export type OcrElement = { text: string; rect: OcrRect };
export type OcrLine = { text: string; rect: OcrRect; elements: OcrElement[] };
export type OcrBlock = { text: string; rect: OcrRect; lines: OcrLine[] };
export type OcrPageData = { text: string; blocks: OcrBlock[] };

const CAPTURE_WIDTH = 1200;

/**
 * On-device OCR for a single rendered PDF page. Captures the currently-rendered
 * page view as an image, runs ML Kit text recognition on it, and preserves ML
 * Kit's word/line/block bounds as normalized page coordinates. No network.
 *
 * Returns empty data (never throws to RedBox) when capture/OCR fails so the
 * reader can keep going and we don't loop forever on bad pages.
 */
export async function recognizePage(
  pageRef: RefObject<View | null>,
  pageAspect: number,
): Promise<OcrPageData> {
  if (!pageRef?.current) return emptyPage();

  let uri = '';
  try {
    uri = await captureRef(pageRef, {
      format: 'jpg',
      quality: 0.85,
      result: 'tmpfile',
      // Cap capture size — full-retina tablet pages are huge and slow ML Kit down.
      width: CAPTURE_WIDTH,
    });
  } catch {
    return emptyPage();
  }

  if (!uri || typeof uri !== 'string') return emptyPage();

  const fileUri = toFileUri(uri);
  const path = fileUri.replace(/^file:\/\//, '');

  try {
    const exists = await ReactNativeBlobUtil.fs.exists(path);
    if (!exists) return emptyPage();
    const stat = await ReactNativeBlobUtil.fs.stat(path);
    if (!stat || Number(stat.size) < 64) return emptyPage();

    // ML Kit iOS loads via NSURL URLWithString — requires a file:// URL.
    const result = await TextRecognition.recognize(fileUri);
    const imageWidth = CAPTURE_WIDTH;
    const imageHeight = CAPTURE_WIDTH / Math.max(0.1, pageAspect || 0.72);
    const blocks: OcrBlock[] = (result?.blocks || [])
      .map((block) => {
        const lines: OcrLine[] = (block.lines || [])
          .map((line) => ({
            text: normalizeInline(line.text || ''),
            rect: normalizeFrame(line.frame, imageWidth, imageHeight),
            elements: (line.elements || [])
              .map((element) => ({
                text: normalizeInline(element.text || ''),
                rect: normalizeFrame(element.frame, imageWidth, imageHeight),
              }))
              .filter((element) => element.text && element.rect.w > 0 && element.rect.h > 0),
          }))
          .filter((line) => line.text && line.rect.w > 0 && line.rect.h > 0);
        return {
          text: normalize(block.text || lines.map((line) => line.text).join('\n')),
          rect: normalizeFrame(block.frame, imageWidth, imageHeight),
          lines,
        };
      })
      .filter((block) => block.text && block.rect.w > 0 && block.rect.h > 0);
    return { text: normalize(result?.text || ''), blocks };
  } catch {
    return emptyPage();
  } finally {
    cleanupTemp(path);
  }
}

/** Backwards-compatible text-only helper. */
export async function recognizePageText(
  pageRef: RefObject<View | null>,
  pageAspect = 0.72,
): Promise<string> {
  return (await recognizePage(pageRef, pageAspect)).text;
}

function toFileUri(uri: string): string {
  if (uri.startsWith('file://')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return Platform.OS === 'ios' ? `file://${uri}` : uri;
}

function normalize(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeInline(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeFrame(
  frame: { left: number; top: number; width: number; height: number } | undefined,
  imageWidth: number,
  imageHeight: number,
): OcrRect {
  if (!frame) return { x: 0, y: 0, w: 0, h: 0 };
  const x = clamp(frame.left / imageWidth);
  const y = clamp(frame.top / imageHeight);
  return {
    x,
    y,
    w: Math.max(0, Math.min(1 - x, frame.width / imageWidth)),
    h: Math.max(0, Math.min(1 - y, frame.height / imageHeight)),
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function emptyPage(): OcrPageData {
  return { text: '', blocks: [] };
}

function cleanupTemp(path: string) {
  ReactNativeBlobUtil.fs.unlink(path).catch(() => {
    /* best-effort */
  });
}
