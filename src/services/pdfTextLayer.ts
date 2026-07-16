/**
 * Detect + import an existing PDF text layer so already-OCR’d / searchable
 * documents skip raster OCR.
 *
 * Uses pdf-lib to decode page content streams and pull Tj / TJ / ' / " text
 * (literal and hex strings). Word positions are approximate line bands —
 * good enough for search and rough selection; users can still re-OCR a page.
 */
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  PDFDocument,
  PDFArray,
  PDFRawStream,
  PDFContentStream,
  decodePDFRawStream,
} from 'pdf-lib';
import type { OcrBlock, OcrLine, OcrPageData, OcrElement } from './ocrService';

export type TextLayerProbe = {
  searchable: boolean;
  pageCount: number;
  /** Characters extracted across sampled pages (before importing all). */
  sampleChars: number;
  pages: Record<number, OcrPageData>;
};

const MIN_CHARS_PER_PAGE = 28;
const MIN_SAMPLE_CHARS = 60;

function base64ToBytes(b64: string): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { decode } = require('base-64') as { decode: (s: string) => string };
  const binary = decode(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function readPdfBytes(docUri: string): Promise<Uint8Array> {
  const path = docUri.replace(/^file:\/\//, '');
  const b64 = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
  return base64ToBytes(b64);
}

function decodePdfLiteral(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\\' && i + 1 < raw.length) {
      const n = raw[++i];
      if (n === 'n') out += '\n';
      else if (n === 'r') out += '\r';
      else if (n === 't') out += '\t';
      else if (n === 'b') out += '\b';
      else if (n === 'f') out += '\f';
      else if (n === '(' || n === ')' || n === '\\') out += n;
      else if (/[0-7]/.test(n)) {
        let oct = n;
        if (i + 1 < raw.length && /[0-7]/.test(raw[i + 1])) oct += raw[++i];
        if (i + 1 < raw.length && /[0-7]/.test(raw[i + 1])) oct += raw[++i];
        out += String.fromCharCode(parseInt(oct, 8));
      } else out += n;
    } else out += c;
  }
  return out;
}

function decodePdfHex(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  if (!clean.length || clean.length % 2 !== 0) return '';
  // UTF-16BE BOM
  if (clean.length >= 4 && clean.slice(0, 4).toUpperCase() === 'FEFF') {
    let out = '';
    for (let i = 4; i + 3 < clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      if (code) out += String.fromCharCode(code);
    }
    return out;
  }
  let out = '';
  for (let i = 0; i < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if (Number.isFinite(code) && code >= 32) out += String.fromCharCode(code);
  }
  return out;
}

function extractPdfStrings(content: string): string[] {
  const parts: string[] = [];
  const pushLiteral = (inner: string) => {
    const t = decodePdfLiteral(inner).replace(/\0/g, '').trim();
    if (t) parts.push(t);
  };
  const pushHex = (inner: string) => {
    const t = decodePdfHex(inner).replace(/\0/g, '').trim();
    if (t) parts.push(t);
  };

  // (literal) Tj  /  (literal) '  /  (literal) "
  const litOp = /\((?:\\.|[^\\()])*\)\s*(?:Tj|'|")/g;
  let m: RegExpExecArray | null;
  while ((m = litOp.exec(content))) {
    const close = m[0].lastIndexOf(')');
    pushLiteral(m[0].slice(1, close));
  }

  // <hex> Tj
  const hexOp = /<([0-9A-Fa-f \t\n\r]+)>\s*(?:Tj|'|")/g;
  while ((m = hexOp.exec(content))) {
    pushHex(m[1]);
  }

  // [ ... ] TJ  — array mixes strings and kerning numbers
  const tjArr = /\[((?:[^\[\]]|\[[^\]]*\])*)\]\s*TJ/g;
  while ((m = tjArr.exec(content))) {
    const arr = m[1];
    const lit = /\((?:\\.|[^\\()])*\)/g;
    let s: RegExpExecArray | null;
    while ((s = lit.exec(arr))) {
      pushLiteral(s[0].slice(1, -1));
    }
    const hex = /<([0-9A-Fa-f \t\n\r]+)>/g;
    while ((s = hex.exec(arr))) {
      pushHex(s[1]);
    }
  }

  return parts;
}

function streamToContentString(stream: unknown): string {
  try {
    if (stream instanceof PDFContentStream) {
      return stream.getContentsString() || '';
    }
    if (stream instanceof PDFRawStream) {
      const decoded = decodePDFRawStream(stream);
      const bytes = decoded.decode();
      let out = '';
      for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
      return out;
    }
    const anyStream = stream as { getContentsString?: () => string; getContents?: () => Uint8Array };
    if (typeof anyStream?.getContentsString === 'function') {
      return anyStream.getContentsString() || '';
    }
    if (typeof anyStream?.getContents === 'function') {
      const bytes = anyStream.getContents();
      let out = '';
      for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
      return out;
    }
  } catch {
    /* ignore undecodable streams */
  }
  return '';
}

function pageContentString(page: ReturnType<PDFDocument['getPages']>[number]): string {
  try {
    const contents = page.node.normalizedEntries().Contents;
    if (!contents) return '';
    if (contents instanceof PDFArray) {
      let out = '';
      for (let i = 0; i < contents.size(); i++) {
        out += streamToContentString(contents.lookup(i)) + '\n';
      }
      return out;
    }
    return streamToContentString(contents);
  } catch {
    return '';
  }
}

/** Build approximate line/word boxes so selection still has something to grab. */
export function layoutFromPlainText(text: string): OcrPageData {
  const normalized = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) {
    return { text: '', blocks: [], quality: { score: 0, label: 'low' } };
  }

  const paragraphs = normalized.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const lineCount = Math.max(1, paragraphs.length);
  const blocks: OcrBlock[] = [];
  const marginX = 0.08;
  const usableW = 0.84;
  const top = 0.06;
  const bottom = 0.94;
  const span = bottom - top;

  paragraphs.forEach((para, idx) => {
    const y = top + (idx / lineCount) * span;
    const h = Math.min(0.045, span / lineCount);
    const words = para.split(/\s+/).filter(Boolean);
    const elements: OcrElement[] = [];
    let x = marginX;
    const avg = usableW / Math.max(1, words.reduce((a, w) => a + w.length + 1, 0));
    words.forEach((w) => {
      const wBox = Math.max(0.012, Math.min(0.4, (w.length + 1) * avg));
      elements.push({ text: w, rect: { x, y, w: wBox * 0.92, h } });
      x += wBox;
    });
    const line: OcrLine = {
      text: para,
      rect: { x: marginX, y, w: usableW, h },
      elements,
    };
    blocks.push({
      text: para,
      rect: { x: marginX, y, w: usableW, h },
      lines: [line],
    });
  });

  return {
    text: normalized,
    blocks,
    quality: { score: 0.85, label: 'high' },
  };
}

function extractPageText(page: ReturnType<PDFDocument['getPages']>[number]): string {
  const content = pageContentString(page);
  const parts = extractPdfStrings(content);
  // Join with spaces; OCR’d PDFs often emit one word/token per Tj.
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Probe whether a PDF already has a usable text layer.
 * Samples up to `samplePages` (default 3) from the start of the document.
 */
export async function probePdfTextLayer(
  docUri: string,
  opts?: { samplePages?: number },
): Promise<TextLayerProbe> {
  const samplePages = opts?.samplePages ?? 3;
  try {
    const bytes = await readPdfBytes(docUri);
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    const pages = pdf.getPages();
    const pageCount = pages.length;
    if (!pageCount) {
      return { searchable: false, pageCount: 0, sampleChars: 0, pages: {} };
    }

    const limit = Math.min(pageCount, samplePages);
    let sampleChars = 0;
    const sampled: Record<number, OcrPageData> = {};
    for (let i = 0; i < limit; i++) {
      const text = extractPageText(pages[i]);
      sampleChars += text.length;
      if (text.length) sampled[i + 1] = layoutFromPlainText(text);
    }

    const avg = sampleChars / limit;
    const searchable = sampleChars >= MIN_SAMPLE_CHARS && avg >= MIN_CHARS_PER_PAGE;
    return { searchable, pageCount, sampleChars, pages: searchable ? sampled : {} };
  } catch {
    return { searchable: false, pageCount: 0, sampleChars: 0, pages: {} };
  }
}

/**
 * Import the full text layer into OcrPageData for every page.
 * Call only after `probePdfTextLayer` reports searchable.
 */
export async function importPdfTextLayer(docUri: string): Promise<{
  pageCount: number;
  pages: Record<number, OcrPageData>;
}> {
  const bytes = await readPdfBytes(docUri);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const all = pdf.getPages();
  const pages: Record<number, OcrPageData> = {};
  for (let i = 0; i < all.length; i++) {
    const text = extractPageText(all[i]);
    pages[i + 1] = layoutFromPlainText(text);
  }
  return { pageCount: all.length, pages };
}
