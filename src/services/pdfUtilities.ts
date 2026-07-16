/**
 * PDF utilities for V1 PRD items: compress, PDF→Word text export, Word→PDF.
 */
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import DocumentPicker from 'react-native-document-picker';

function withFilePrefix(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function safeName(name: string): string {
  return (name || 'litnotes').replace(/[^\w.\-]+/g, '_').slice(0, 80);
}

function base64ToBytes(b64: string): Uint8Array {
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

export type CompressPreset = 'standard' | 'high' | 'max';

/**
 * Re-save PDF with object streams (smaller cross-ref). Does not re-encode images —
 * still useful for e-filing copies; reports before/after sizes.
 */
export async function compressPdfCopy(
  docUri: string,
  docName: string,
  _preset: CompressPreset = 'standard',
): Promise<{ before: number; after: number; path: string }> {
  if (!docUri) throw new Error('No PDF open');
  const src = await readPdfBytes(docUri);
  const before = src.byteLength;
  const pdf = await PDFDocument.load(src, { ignoreEncryption: true, updateMetadata: false });
  pdf.setTitle(`${docName || 'document'} (compressed)`);
  pdf.setProducer('LitNotes Canvas');
  const out = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
  const after = out.byteLength;
  const dest = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName(docName)}-compressed.pdf`;
  await ReactNativeBlobUtil.fs.writeFile(dest, bytesToBase64(out), 'base64');
  await Share.open({
    url: withFilePrefix(dest),
    type: 'application/pdf',
    filename: `${safeName(docName)}-compressed.pdf`,
    failOnCancel: false,
  });
  return { before, after, path: dest };
}

/** Export OCR / page text as a Word-compatible .doc (HTML). */
export async function exportPdfTextAsWord(params: {
  docName: string;
  pages: Record<number, string>;
}): Promise<void> {
  const keys = Object.keys(params.pages)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (!keys.length) throw new Error('No text layer / OCR yet — scan the document first.');
  const body = keys
    .map((pg) => {
      const text = (params.pages[pg] || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<h2>Page ${pg}</h2><p>${text.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeName(
    params.docName,
  )}</title></head><body><h1>${safeName(params.docName)}</h1>${body}</body></html>`;
  const dest = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName(params.docName)}-from-pdf.doc`;
  await ReactNativeBlobUtil.fs.writeFile(dest, html, 'utf8');
  await Share.open({
    url: withFilePrefix(dest),
    type: 'application/msword',
    failOnCancel: false,
  });
}

/**
 * Import a .doc/.docx/.txt file, extract readable text, and write a simple PDF
 * into the cache for the caller to open via openPdf.
 */
export async function importWordAsPdf(): Promise<{ uri: string; name: string } | null> {
  try {
    const file = await DocumentPicker.pickSingle({
      type: [
        DocumentPicker.types.doc,
        DocumentPicker.types.docx,
        DocumentPicker.types.plainText,
        'com.microsoft.word.doc',
        'org.openxmlformats.wordprocessingml.document',
        'public.plain-text',
      ],
      copyTo: 'cachesDirectory',
    });
    const uri = (file.fileCopyUri || file.uri || '').replace(/^file:\/\//, '');
    if (!uri) return null;
    let text = '';
    try {
      text = await ReactNativeBlobUtil.fs.readFile(uri, 'utf8');
    } catch {
      // DOCX is a zip — pull visible strings as a best-effort fallback.
      const b64 = await ReactNativeBlobUtil.fs.readFile(uri, 'base64');
      const binary = (require('base-64') as { decode: (s: string) => string }).decode(b64);
      const matches = binary.match(/[\x20-\x7E\u00A0-\u024F]{4,}/g) || [];
      text = matches
        .filter((s) => /[a-zA-Z]{3,}/.test(s) && !/^PK/.test(s))
        .slice(0, 400)
        .join('\n');
    }
    text = text.replace(/\0/g, '').trim();
    if (!text) throw new Error('Could not extract text from that file.');

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const margin = 48;
    const fontSize = 11;
    const lineHeight = 14;
    const pageWidth = 595;
    const pageHeight = 842;
    const maxWidth = pageWidth - margin * 2;
    const words = text.split(/\s+/);
    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    let line = '';
    const flush = () => {
      if (!line) return;
      if (y < margin + lineHeight) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.12) });
      y -= lineHeight;
      line = '';
    };
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, fontSize) > maxWidth) {
        flush();
        line = w;
      } else {
        line = next;
      }
    }
    flush();

    const bytes = await pdf.save();
    const name = (file.name || 'imported').replace(/\.(docx?|txt)$/i, '') + '.pdf';
    const dest = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName(name)}`;
    await ReactNativeBlobUtil.fs.writeFile(dest, bytesToBase64(bytes), 'base64');
    return { uri: dest, name };
  } catch (e: any) {
    if (DocumentPicker.isCancel(e)) return null;
    throw e;
  }
}
