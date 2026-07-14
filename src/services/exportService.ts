import type { RefObject } from 'react';
import type { View } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import type { Highlight, FlowNode, AiData, Bookmark, BookmarkSectionKey } from '../store';

const SECTION_TITLES: Record<BookmarkSectionKey, string> = {
  index: 'INDEX',
  dates: 'LIST OF DATES',
  synopsis: 'SYNOPSIS',
  issues: 'ISSUE-WISE',
  annexures: 'ANNEXURES',
};
const SECTION_ORDER: BookmarkSectionKey[] = ['index', 'dates', 'synopsis', 'issues', 'annexures'];

/** Snapshot the canvas board and hand it to the native share sheet as a PNG. */
export async function exportCanvasSnapshot(canvasRef: RefObject<View>, docName: string): Promise<void> {
  const tmp = await captureRef(canvasRef, { format: 'png', quality: 1, result: 'tmpfile' });
  const dest = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName(docName)}-canvas.png`;
  await copyOver(tmp, dest);
  await Share.open({ url: withFilePrefix(dest), type: 'image/png', failOnCancel: false });
}

/** Build a court-bundle-style Markdown export of the index, highlights and AI memos. */
export async function exportNotesMarkdown(params: {
  docName: string;
  highlights: Highlight[];
  nodes: FlowNode[];
  bookmarks: Bookmark[];
}): Promise<void> {
  const md = buildMarkdown(params);
  const dest = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName(params.docName || 'litnotes')}-notes.md`;
  await ReactNativeBlobUtil.fs.writeFile(dest, md, 'utf8');
  await Share.open({ url: withFilePrefix(dest), type: 'text/markdown', failOnCancel: false });
}

function buildMarkdown(params: {
  docName: string;
  highlights: Highlight[];
  nodes: FlowNode[];
  bookmarks: Bookmark[];
}): string {
  const { docName, highlights, nodes, bookmarks } = params;
  const lines: string[] = [`# ${docName || 'LitNotes Canvas export'}`, ''];

  for (const key of SECTION_ORDER) {
    const entries = bookmarks.filter((b) => b.section === key).sort((a, b) => a.order - b.order);
    if (!entries.length) continue;
    lines.push(`## ${SECTION_TITLES[key]}`, '');
    for (const e of entries) {
      const pageStr = e.page != null ? ` (p. ${e.page})` : '';
      const dateStr = e.date ? `${e.date} — ` : '';
      lines.push(`- **${dateStr}${e.title}**${pageStr}`);
      if (e.note) lines.push(`  ${e.note}`);
    }
    lines.push('');
  }

  if (highlights.length) {
    lines.push('## Highlights', '');
    for (const h of [...highlights].sort((a, b) => a.page - b.page)) {
      const noteStr = h.note ? ` — _${h.note}_` : '';
      lines.push(`- p.${h.page} [${h.category}] "${h.text}"${noteStr}`);
    }
    lines.push('');
  }

  const aiNodes = nodes.filter((n) => n.type === 'ai');
  if (aiNodes.length) {
    lines.push('## AI research memos', '');
    for (const n of aiNodes) {
      const d = n.data as AiData;
      lines.push(`### ${d.heading}`, '', d.body, '');
      if (d.citations?.length) lines.push(`Citations: ${d.citations.join('; ')}`, '');
    }
  }

  return lines.join('\n');
}

function safeName(name: string): string {
  return name.replace(/[^\w.-]/g, '_') || 'export';
}

function withFilePrefix(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

async function copyOver(src: string, dest: string): Promise<void> {
  const cleanSrc = src.startsWith('file://') ? src.slice('file://'.length) : src;
  const exists = await ReactNativeBlobUtil.fs.exists(dest);
  if (exists) await ReactNativeBlobUtil.fs.unlink(dest);
  await ReactNativeBlobUtil.fs.cp(cleanSrc, dest);
}
