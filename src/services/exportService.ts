import type { RefObject } from 'react';
import type { View } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import type {
  Highlight,
  FlowNode,
  AiData,
  NoteData,
  GroupData,
  ExcerptData,
  Bookmark,
  BookmarkSectionKey,
  Edge,
  Stroke,
  InkLink,
} from '../store';

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

/** Build a research-outline Markdown export (sections + excerpts + notes + index). */
export async function exportNotesMarkdown(params: {
  docName: string;
  highlights: Highlight[];
  nodes: FlowNode[];
  bookmarks: Bookmark[];
  edges?: Edge[];
}): Promise<void> {
  const md = buildMarkdown(params);
  const dest = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName(params.docName || 'litnotes')}-outline.md`;
  await ReactNativeBlobUtil.fs.writeFile(dest, md, 'utf8');
  await Share.open({ url: withFilePrefix(dest), type: 'text/markdown', failOnCancel: false });
}

/** Word-compatible HTML (.doc) — opens cleanly in Word / Pages / Google Docs. */
export async function exportNotesWord(params: {
  docName: string;
  highlights: Highlight[];
  nodes: FlowNode[];
  bookmarks: Bookmark[];
  edges?: Edge[];
}): Promise<void> {
  const html = buildWordHtml(params);
  const dest = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName(params.docName || 'litnotes')}-outline.doc`;
  await ReactNativeBlobUtil.fs.writeFile(dest, html, 'utf8');
  await Share.open({
    url: withFilePrefix(dest),
    type: 'application/msword',
    failOnCancel: false,
  });
}

/** Annotated reading report (HTML printable from Safari / share → PDF). */
export async function exportAnnotatedReport(params: {
  docName: string;
  highlights: Highlight[];
  bookmarks: Bookmark[];
}): Promise<void> {
  const lines = [
    '<!DOCTYPE html><html><head><meta charset="utf-8"/>',
    `<title>${esc(params.docName || 'NoteLawbs.Ai')} — Annotated report</title>`,
    '<style>body{font-family:Georgia,serif;max-width:720px;margin:32px auto;padding:0 20px;color:#1a1a1a}h1{font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:1px solid #ccc;padding-bottom:4px}.hl{margin:12px 0;padding:10px 12px;border-left:3px solid #c0392b;background:#faf6f2}.meta{font-size:12px;color:#666;margin-bottom:4px}.tag{display:inline-block;font-size:10px;padding:2px 6px;margin-right:4px;border-radius:4px;background:#eee}</style>',
    '</head><body>',
    `<h1>${esc(params.docName || 'NoteLawbs.Ai')}</h1>`,
    `<p>Annotated report · ${params.highlights.length} marks · ${new Date().toLocaleString()}</p>`,
  ];
  for (const h of [...params.highlights].sort((a, b) => a.page - b.page)) {
    const tags = (h.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    lines.push(
      `<div class="hl"><div class="meta">p.${h.page} · ${esc(h.category)} · ${esc(h.markStyle || 'highlight')} ${tags}</div>`,
      `<div>${esc(h.text)}</div>`,
      h.note ? `<div class="meta">${esc(h.note)}</div>` : '',
      '</div>',
    );
  }
  for (const key of SECTION_ORDER) {
    const entries = params.bookmarks.filter((b) => b.section === key).sort((a, b) => a.order - b.order);
    if (!entries.length) continue;
    lines.push(`<h2>${SECTION_TITLES[key]}</h2><ul>`);
    for (const e of entries) {
      const indent = e.parentId ? ' style="margin-left:20px"' : '';
      lines.push(
        `<li${indent}><strong>${esc(e.date ? `${e.date} — ` : '')}${esc(e.title)}</strong>${
          e.page != null ? ` (p. ${e.page})` : ''
        }${e.note ? ` — ${esc(e.note)}` : ''}</li>`,
      );
    }
    lines.push('</ul>');
  }
  lines.push('</body></html>');
  const dest = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName(params.docName || 'litnotes')}-annotated.html`;
  await ReactNativeBlobUtil.fs.writeFile(dest, lines.join('\n'), 'utf8');
  await Share.open({ url: withFilePrefix(dest), type: 'text/html', failOnCancel: false });
}

export type ProjectBundle = {
  version: 1;
  exportedAt: number;
  title: string;
  docName: string;
  numPages: number;
  highlights: Highlight[];
  nodes: FlowNode[];
  edges: Edge[];
  ink: { strokes: Stroke[]; links: InkLink[] };
  ocrPages: Record<number, string>;
  bookmarks: Bookmark[];
};

/** Device-to-device sync via shareable JSON (import on the other iPad). */
export async function exportProjectBundle(bundle: ProjectBundle): Promise<void> {
  const dest = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName(bundle.title || bundle.docName || 'litnotes')}-project.json`;
  await ReactNativeBlobUtil.fs.writeFile(dest, JSON.stringify(bundle, null, 2), 'utf8');
  await Share.open({ url: withFilePrefix(dest), type: 'application/json', failOnCancel: false });
}

export async function parseProjectBundle(json: string): Promise<ProjectBundle> {
  const data = JSON.parse(json) as ProjectBundle;
  if (!data || data.version !== 1 || !Array.isArray(data.nodes)) {
    throw new Error('Invalid NoteLawbs.Ai project file');
  }
  return data;
}

/** Share the original PDF (lighter workflow when user wants the source file). */
export async function exportSourcePdf(docUri: string, docName: string): Promise<void> {
  if (!docUri) throw new Error('No PDF open');
  await Share.open({
    url: withFilePrefix(docUri),
    type: 'application/pdf',
    filename: safeName(docName || 'document') + '.pdf',
    failOnCancel: false,
  });
}

function buildMarkdown(params: {
  docName: string;
  highlights: Highlight[];
  nodes: FlowNode[];
  bookmarks: Bookmark[];
  edges?: Edge[];
  /** When set, only this group and its members are exported. */
  groupId?: string;
}): string {
  const { docName, highlights, nodes, bookmarks, edges = [], groupId } = params;
  const lines: string[] = [`# ${docName || 'NoteLawbs.Ai export'}`, ''];

  const scoped = groupId
    ? nodes.filter((n) => n.id === groupId || n.groupId === groupId)
    : nodes;
  const sorted = [...scoped].sort((a, b) => a.y - b.y || a.x - b.x);
  if (sorted.length) {
    lines.push(groupId ? '## Section export' : '## Workspace outline', '');
    for (const n of sorted) {
      if (n.type === 'group') {
        const g = n.data as GroupData;
        lines.push(`### ${g.title || 'Untitled section'}`, '');
      } else if (n.type === 'note') {
        const d = n.data as NoteData;
        if (!d.text?.trim()) continue;
        const cite = d.page != null ? ` (p.${d.page})` : '';
        lines.push(`- **Note:** ${d.text.trim()}${cite}`, '');
      } else if (n.type === 'excerpt') {
        const d = n.data as ExcerptData;
        const src = d.docName ? ` (${d.docName.replace(/\.pdf$/i, '')}, p.${d.page})` : ` (p.${d.page})`;
        const tags = d.tags?.length ? ` [${d.tags.join(', ')}]` : '';
        lines.push(`- "${d.text}"${src}${tags}`);
        if (d.note) lines.push(`  _${d.note}_`);
        lines.push('');
      } else if (n.type === 'ai') {
        const d = n.data as AiData;
        lines.push(`#### ${d.heading}`, '', d.body, '');
      }
    }
  }

  if (edges.length) {
    lines.push('## Connections', '');
    for (const e of edges) {
      const a = nodeLabel(nodes, e.source);
      const b = nodeLabel(nodes, e.target);
      lines.push(`- ${a} → ${b}${e.label ? ` (${e.label})` : ''}`);
    }
    lines.push('');
  }

  for (const key of SECTION_ORDER) {
    const entries = bookmarks.filter((b) => b.section === key).sort((a, b) => a.order - b.order);
    if (!entries.length) continue;
    lines.push(`## ${SECTION_TITLES[key]}`, '');
    for (const e of entries) {
      const indent = e.parentId ? '  ' : '';
      const pageStr = e.page != null ? ` (p. ${e.page})` : '';
      const dateStr = e.date ? `${e.date} — ` : '';
      lines.push(`${indent}- **${dateStr}${e.title}**${pageStr}`);
      if (e.note) lines.push(`${indent}  ${e.note}`);
    }
    lines.push('');
  }

  if (highlights.length) {
    lines.push('## All highlights', '');
    for (const h of [...highlights].sort((a, b) => a.page - b.page)) {
      const noteStr = h.note ? ` — _${h.note}_` : '';
      const tagStr = h.tags?.length ? ` #${h.tags.join(' #')}` : '';
      const style = h.markStyle && h.markStyle !== 'highlight' ? ` (${h.markStyle})` : '';
      lines.push(`- p.${h.page} [${h.category}]${style} "${h.text}"${noteStr}${tagStr}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildWordHtml(params: {
  docName: string;
  highlights: Highlight[];
  nodes: FlowNode[];
  bookmarks: Bookmark[];
  edges?: Edge[];
}): string {
  const md = buildMarkdown(params);
  const body = md
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${esc(line.slice(2))}</h1>`;
      if (line.startsWith('## ')) return `<h2>${esc(line.slice(3))}</h2>`;
      if (line.startsWith('### ')) return `<h3>${esc(line.slice(4))}</h3>`;
      if (line.startsWith('#### ')) return `<h4>${esc(line.slice(5))}</h4>`;
      if (line.startsWith('- ')) return `<p>• ${esc(line.slice(2))}</p>`;
      if (!line.trim()) return '<br/>';
      return `<p>${esc(line)}</p>`;
    })
    .join('\n');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"/><title>${esc(
    params.docName || 'NoteLawbs.Ai',
  )}</title></head><body>${body}</body></html>`;
}

function nodeLabel(nodes: FlowNode[], id: string): string {
  const n = nodes.find((x) => x.id === id);
  if (!n) return id.slice(0, 6);
  if (n.type === 'excerpt') return `"${((n.data as ExcerptData).text || '').slice(0, 40)}…"`;
  if (n.type === 'note') return `Note: ${((n.data as NoteData).text || '').slice(0, 40)}`;
  if (n.type === 'group') return (n.data as GroupData).title || 'Section';
  if (n.type === 'ai') return (n.data as AiData).heading || 'AI';
  return n.type;
}

function esc(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
