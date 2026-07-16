import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import type { Highlight, MarkStyle, Stroke } from '../store';
import { CATEGORIES, type CategoryKey } from '../theme';

function withFilePrefix(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function safeName(name: string): string {
  return (name || 'litnotes').replace(/[^\w.\-]+/g, '_').slice(0, 80);
}

function parseRgba(soft: string): { r: number; g: number; b: number; a: number } {
  const m = soft.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return { r: 0.85, g: 0.7, b: 0.2, a: 0.35 };
  return {
    r: Number(m[1]) / 255,
    g: Number(m[2]) / 255,
    b: Number(m[3]) / 255,
    a: m[4] != null ? Number(m[4]) : 0.35,
  };
}

function categoryRgb(key: string) {
  const cat = CATEGORIES[(key as CategoryKey) in CATEGORIES ? (key as CategoryKey) : 'key_fact'];
  return parseRgba(cat.soft);
}

function solidRgb(key: string) {
  const cat = CATEGORIES[(key as CategoryKey) in CATEGORIES ? (key as CategoryKey) : 'key_fact'];
  const hex = cat.color.replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}

function base64ToBytes(b64: string): Uint8Array {
  // Prefer the base-64 package shipped with react-native-blob-util.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { decode } = require('base-64') as { decode: (s: string) => string };
  const binary = decode(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { encode } = require('base-64') as { encode: (s: string) => string };
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return encode(binary);
}

async function readPdfBytes(docUri: string): Promise<Uint8Array> {
  const path = docUri.replace(/^file:\/\//, '');
  const b64 = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
  return base64ToBytes(b64);
}

/**
 * Bake highlights (+ optional PDF-page ink) into a copy of the source PDF and
 * open the system share sheet. Coordinates in the app are normalized 0–1 with
 * origin top-left; PDF user space is bottom-left, so Y is flipped.
 */
export async function exportAnnotatedPdf(params: {
  docUri: string;
  docName: string;
  highlights: Highlight[];
  inkStrokes?: Stroke[];
}): Promise<void> {
  if (!params.docUri) throw new Error('No PDF open');

  const src = await readPdfBytes(params.docUri);
  const pdf = await PDFDocument.load(src, { ignoreEncryption: true, updateMetadata: false });
  const pages = pdf.getPages();

  for (const h of params.highlights) {
    const page = pages[h.page - 1];
    if (!page) continue;
    const { width, height } = page.getSize();
    const rects = h.rects?.length ? h.rects : [h.rect];
    const style: MarkStyle = h.markStyle || 'highlight';
    const soft = categoryRgb(h.category);
    const solid = solidRgb(h.category);

    for (const rect of rects) {
      const x = rect.x * width;
      const w = rect.w * width;
      const hPx = Math.max(2, rect.h * height);
      const yTop = rect.y * height;
      // PDF y is bottom-up
      const y = height - yTop - hPx;

      if (style === 'underline') {
        page.drawRectangle({
          x,
          y: height - yTop - hPx * 0.12,
          width: w,
          height: Math.max(1.2, hPx * 0.12),
          color: rgb(solid.r, solid.g, solid.b),
          opacity: 0.95,
          borderWidth: 0,
        });
      } else if (style === 'strikethrough') {
        page.drawRectangle({
          x,
          y: height - yTop - hPx * 0.55,
          width: w,
          height: Math.max(1.2, hPx * 0.12),
          color: rgb(solid.r, solid.g, solid.b),
          opacity: 0.95,
          borderWidth: 0,
        });
      } else {
        page.drawRectangle({
          x,
          y,
          width: w,
          height: hPx,
          color: rgb(soft.r, soft.g, soft.b),
          opacity: Math.min(0.55, soft.a + 0.12),
          borderWidth: 0,
        });
      }
    }
  }

  // PDF-page ink (normalized points)
  const strokes = (params.inkStrokes || []).filter((st) => st.pdfPage != null);
  for (const st of strokes) {
    const page = pages[(st.pdfPage as number) - 1];
    if (!page || st.points.length < 2) continue;
    const { width, height } = page.getSize();
    const inkColor = rgb(0.12, 0.14, 0.2);
    const opacity = st.width >= 10 ? 0.4 : 0.9;
    for (let i = 1; i < st.points.length; i++) {
      const a = st.points[i - 1];
      const b = st.points[i];
      page.drawLine({
        start: { x: a.x * width, y: height - a.y * height },
        end: { x: b.x * width, y: height - b.y * height },
        thickness: Math.max(0.8, st.width * 0.35),
        color: inkColor,
        opacity,
      });
    }
  }

  // Cover stamp so recipients know marks are baked in
  if (pages[0]) {
    const { width, height } = pages[0].getSize();
    pages[0].drawText('LitNotes · annotated export', {
      x: 24,
      y: height - 18,
      size: 8,
      color: rgb(0.4, 0.4, 0.45),
      rotate: degrees(0),
      maxWidth: width - 48,
    });
  }

  const outBytes = await pdf.save();
  const dest = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName(params.docName || 'litnotes')}-annotated.pdf`;
  await ReactNativeBlobUtil.fs.writeFile(dest, bytesToBase64(outBytes), 'base64');
  await Share.open({
    url: withFilePrefix(dest),
    type: 'application/pdf',
    filename: `${safeName(params.docName || 'document')}-annotated.pdf`,
    failOnCancel: false,
  });
}
