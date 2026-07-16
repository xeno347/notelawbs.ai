import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { canUseCloudOcr, recognizePageCloud } from './cloudOcrService';

/** ML Kit is device-linked only on iOS (simulator prebuilts are device-arm64). */
type TextRecognitionModule = {
  recognize: (uri: string) => Promise<{
    text?: string;
    blocks?: Array<{
      text?: string;
      frame?: { left?: number; top?: number; width?: number; height?: number; x?: number; y?: number; w?: number; h?: number };
      lines?: Array<{
        text?: string;
        frame?: { left?: number; top?: number; width?: number; height?: number; x?: number; y?: number; w?: number; h?: number };
        elements?: Array<{
          text?: string;
          frame?: { left?: number; top?: number; width?: number; height?: number; x?: number; y?: number; w?: number; h?: number };
        }>;
      }>;
    }>;
  }>;
};

function loadTextRecognition(): TextRecognitionModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-ml-kit/text-recognition').default as TextRecognitionModule;
  } catch {
    return null;
  }
}

const TextRecognition = loadTextRecognition();

export type OcrRect = { x: number; y: number; w: number; h: number };
export type OcrElement = { text: string; rect: OcrRect };
export type OcrLine = { text: string; rect: OcrRect; elements: OcrElement[] };
export type OcrBlock = { text: string; rect: OcrRect; lines: OcrLine[] };
export type OcrQuality = { score: number; label: 'high' | 'medium' | 'low' };
export type OcrPageData = { text: string; blocks: OcrBlock[]; quality: OcrQuality };

const CAPTURE_WIDTH = 1200;

/**
 * Heuristic recognition-quality estimate derived from the OCR text itself.
 * Google ML Kit's on-device Text Recognition API does not expose a real
 * per-word/per-page confidence score, so this is a proxy (word length, alnum
 * density, near-empty output) — good enough to flag a page as worth a manual
 * retry, but it is NOT a calibrated confidence value from the recognizer.
 */
function estimateQuality(text: string): OcrQuality {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return { score: 0, label: 'low' };
  const avgWordLen = words.reduce((a, w) => a + w.length, 0) / words.length;
  const alnumRatio = (text.match(/[a-zA-Z0-9]/g)?.length || 0) / Math.max(1, text.length);
  const shortWordRatio = words.filter((w) => w.length <= 1).length / words.length;
  let score = 1;
  if (avgWordLen < 2.2) score -= 0.35;
  if (alnumRatio < 0.55) score -= 0.35;
  if (shortWordRatio > 0.35) score -= 0.25;
  if (words.length < 8) score -= 0.2;
  score = Math.max(0, Math.min(1, score));
  const label: OcrQuality['label'] = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
  return { score, label };
}

export type CapturedPageImage = {
  path: string;
  fileUri: string;
  base64: string;
  width: number;
  height: number;
};

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
  opts?: { width?: number },
): Promise<OcrPageData> {
  const captured = await capturePageImage(pageRef, pageAspect, opts);
  if (!captured) return emptyPage();
  try {
    return await recognizeCapturedOnDevice(captured);
  } finally {
    cleanupTemp(captured.path);
  }
}

/** Run OCR on an already-captured page image (cloud preferred when configured). */
export async function recognizeCapturedAuto(
  captured: CapturedPageImage,
  opts?: { preferCloud?: boolean },
): Promise<{ data: OcrPageData; engine: 'cloud' | 'device' }> {
  const preferCloud = opts?.preferCloud !== false;
  try {
    if (preferCloud) {
      try {
        if (await canUseCloudOcr()) {
          const data = await recognizePageCloud(captured.base64, captured.width, captured.height);
          if (data.text.trim() || data.blocks.length) {
            return { data, engine: 'cloud' };
          }
        }
      } catch {
        /* fall through */
      }
    }
    const data = await recognizeCapturedOnDevice(captured);
    return { data, engine: 'device' };
  } finally {
    cleanupTemp(captured.path);
  }
}

/** Capture + prefer cloud OCR when configured; fall back to on-device ML Kit. */
export async function recognizePageAuto(
  pageRef: RefObject<View | null>,
  pageAspect: number,
  opts?: { width?: number; preferCloud?: boolean },
): Promise<{ data: OcrPageData; engine: 'cloud' | 'device' }> {
  const captured = await capturePageImage(pageRef, pageAspect, opts);
  if (!captured) return { data: emptyPage(), engine: 'device' };
  return recognizeCapturedAuto(captured, opts);
}

/** Screenshot the page view for on-device or cloud OCR. */
export async function capturePageImage(
  pageRef: RefObject<View | null>,
  pageAspect: number,
  opts?: { width?: number },
): Promise<CapturedPageImage | null> {
  if (!pageRef?.current) return null;
  const width = opts?.width ?? CAPTURE_WIDTH;
  let uri = '';
  try {
    uri = await captureRef(pageRef, {
      format: 'jpg',
      quality: 0.82,
      result: 'tmpfile',
      width,
    });
  } catch {
    return null;
  }
  if (!uri || typeof uri !== 'string') return null;
  const fileUri = toFileUri(uri);
  const path = fileUri.replace(/^file:\/\//, '');
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(path);
    if (!exists) return null;
    const stat = await ReactNativeBlobUtil.fs.stat(path);
    if (!stat || Number(stat.size) < 64) return null;
    const base64 = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
    if (!base64 || typeof base64 !== 'string') return null;
    const height = width / Math.max(0.1, pageAspect || 0.72);
    return { path, fileUri, base64, width, height };
  } catch {
    cleanupTemp(path);
    return null;
  }
}

async function recognizeCapturedOnDevice(captured: CapturedPageImage): Promise<OcrPageData> {
  if (!TextRecognition) return emptyPage();
  try {
    const result = await TextRecognition.recognize(captured.fileUri);
    const imageWidth = captured.width;
    const imageHeight = captured.height;
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
    const text = normalize(result?.text || '');
    return { text, blocks, quality: estimateQuality(text) };
  } catch {
    return emptyPage();
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
  frame:
    | { left?: number; top?: number; width?: number; height?: number; x?: number; y?: number; w?: number; h?: number }
    | undefined,
  imageWidth: number,
  imageHeight: number,
): OcrRect {
  if (!frame) return { x: 0, y: 0, w: 0, h: 0 };
  // Different platform/binding versions of the native module have used both
  // {left,top,width,height} and {x,y,w,h} — accept either.
  const left = frame.left ?? frame.x ?? 0;
  const top = frame.top ?? frame.y ?? 0;
  const width = frame.width ?? frame.w ?? 0;
  const height = frame.height ?? frame.h ?? 0;
  const x = clamp(left / imageWidth);
  const y = clamp(top / imageHeight);
  return {
    x,
    y,
    w: Math.max(0, Math.min(1 - x, width / imageWidth)),
    h: Math.max(0, Math.min(1 - y, height / imageHeight)),
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function emptyPage(): OcrPageData {
  return { text: '', blocks: [], quality: { score: 0, label: 'low' } };
}

function cleanupTemp(path: string) {
  ReactNativeBlobUtil.fs.unlink(path).catch(() => {
    /* best-effort */
  });
}
