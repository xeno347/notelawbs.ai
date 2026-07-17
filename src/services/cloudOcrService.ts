/**
 * Cloud OCR via OCR.space (https://ocr.space/ocrapi).
 *
 * Sends a page image (base64) to their API and maps word overlays into our
 * normalized OcrPageData shape so selection / highlights keep working.
 *
 * Key: Settings → Advanced → Cloud OCR, or `CLOUD_OCR_API_KEY` in aiConfig.local.ts
 */
import { getSetting, setSetting } from '../storage';
import { CLOUD_OCR_API_KEY as LOCAL_CLOUD_OCR_KEY } from './aiConfig.local';
import { getSecret, setSecret, migrateSettingToSecret } from './secureStore';
import type { OcrBlock, OcrLine, OcrPageData, OcrQuality, OcrRect } from './ocrService';

const CLOUD_OCR_KEY_SETTING = 'cloud_ocr_key';
const CLOUD_OCR_ENABLED_SETTING = 'cloud_ocr_enabled';
const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';

const localCloudKey = (LOCAL_CLOUD_OCR_KEY || '').trim();
let cloudKeyMigrated = false;

async function ensureCloudKeyMigrated(): Promise<void> {
  if (cloudKeyMigrated) return;
  cloudKeyMigrated = true;
  await migrateSettingToSecret(
    CLOUD_OCR_KEY_SETTING,
    getSetting,
    async (k) => setSetting(k, ''),
    CLOUD_OCR_KEY_SETTING,
  );
}

export async function getCloudOcrKey(): Promise<string | null> {
  await ensureCloudKeyMigrated();
  const stored = await getSecret(CLOUD_OCR_KEY_SETTING);
  if (stored?.trim()) return stored.trim();
  return localCloudKey || null;
}

export async function saveCloudOcrKey(key: string): Promise<void> {
  await setSecret(CLOUD_OCR_KEY_SETTING, key.trim());
  await setSetting(CLOUD_OCR_KEY_SETTING, '');
}

export async function clearCloudOcrKey(): Promise<void> {
  await setSecret(CLOUD_OCR_KEY_SETTING, '');
  await setSetting(CLOUD_OCR_KEY_SETTING, '');
}

export async function isCloudOcrEnabled(): Promise<boolean> {
  const raw = await getSetting(CLOUD_OCR_ENABLED_SETTING);
  if (raw === '0') return false;
  if (raw === '1') return true;
  // Default on when a key exists.
  return !!(await getCloudOcrKey());
}

export async function setCloudOcrEnabled(enabled: boolean): Promise<void> {
  await setSetting(CLOUD_OCR_ENABLED_SETTING, enabled ? '1' : '0');
}

export async function canUseCloudOcr(): Promise<boolean> {
  return (await isCloudOcrEnabled()) && !!(await getCloudOcrKey());
}

type OverlayWord = { WordText?: string; Left?: number; Top?: number; Height?: number; Width?: number };
type OverlayLine = {
  LineText?: string;
  Words?: OverlayWord[];
  MaxHeight?: number;
  MinTop?: number;
};
type ParsedResult = {
  ParsedText?: string;
  TextOverlay?: { Lines?: OverlayLine[]; HasOverlay?: boolean };
  FileParseExitCode?: number;
  ErrorMessage?: string | string[];
};

type OcrSpaceResponse = {
  OCRExitCode?: number;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
  ParsedResults?: ParsedResult[];
};

/**
 * Recognize one page image with OCR.space.
 * `base64` may be raw or a data-URI (`data:image/jpg;base64,...`).
 * `imageWidth` / `imageHeight` must match the captured bitmap used for OCR.
 */
export async function recognizePageCloud(
  base64: string,
  imageWidth: number,
  imageHeight: number,
  opts?: { timeoutMs?: number },
): Promise<OcrPageData> {
  const apiKey = await getCloudOcrKey();
  if (!apiKey) throw new Error('No cloud OCR key configured');

  const payload = base64.includes('base64,') ? base64 : `data:image/jpg;base64,${base64}`;
  const body = new URLSearchParams();
  body.set('base64Image', payload);
  body.set('language', 'eng');
  body.set('isOverlayRequired', 'true');
  body.set('OCREngine', '2');
  body.set('scale', 'true');
  body.set('detectOrientation', 'true');
  body.set('filetype', 'JPG');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 60000);
  try {
    const res = await fetch(OCR_SPACE_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Cloud OCR HTTP ${res.status}`);
    const data = (await res.json()) as OcrSpaceResponse;
    if (data.IsErroredOnProcessing || (data.OCRExitCode != null && data.OCRExitCode > 1)) {
      const msg = formatErr(data.ErrorMessage) || 'Cloud OCR failed';
      throw new Error(msg);
    }
    const parsed = data.ParsedResults?.[0];
    if (!parsed) throw new Error('Cloud OCR returned no pages');
    return mapParsedResult(parsed, imageWidth, imageHeight);
  } finally {
    clearTimeout(timer);
  }
}

function mapParsedResult(parsed: ParsedResult, imageWidth: number, imageHeight: number): OcrPageData {
  const w = Math.max(1, imageWidth);
  const h = Math.max(1, imageHeight);
  const linesOverlay = parsed.TextOverlay?.Lines || [];
  const blocks: OcrBlock[] = [];

  if (linesOverlay.length) {
    const lines: OcrLine[] = linesOverlay
      .map((line) => {
        const elements = (line.Words || [])
          .map((word) => ({
            text: normalizeInline(word.WordText || ''),
            rect: normalizePx(word.Left ?? 0, word.Top ?? 0, word.Width ?? 0, word.Height ?? 0, w, h),
          }))
          .filter((el) => el.text && el.rect.w > 0 && el.rect.h > 0);
        const text = normalizeInline(line.LineText || elements.map((e) => e.text).join(' '));
        const rect = elements.length
          ? unionRects(elements.map((e) => e.rect))
          : normalizePx(0, line.MinTop ?? 0, w, line.MaxHeight ?? 0, w, h);
        return { text, rect, elements };
      })
      .filter((line) => line.text && line.rect.w > 0 && line.rect.h > 0);

    // Group nearby lines into paragraph-like blocks for highlight UX.
    let bucket: OcrLine[] = [];
    const flush = () => {
      if (!bucket.length) return;
      blocks.push({
        text: normalize(bucket.map((l) => l.text).join('\n')),
        rect: unionRects(bucket.map((l) => l.rect)),
        lines: bucket,
      });
      bucket = [];
    };
    lines.forEach((line, index) => {
      const prev = bucket[bucket.length - 1];
      if (prev && Math.abs(line.rect.y - (prev.rect.y + prev.rect.h)) > 0.035) flush();
      bucket.push(line);
      if (index === lines.length - 1) flush();
    });
  }

  const text = normalize(parsed.ParsedText || blocks.map((b) => b.text).join('\n'));
  if (!blocks.length && text) {
    blocks.push({
      text,
      rect: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 },
      lines: [{ text, rect: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 }, elements: [] }],
    });
  }
  return { text, blocks, quality: estimateQuality(text) };
}

function normalizePx(
  left: number,
  top: number,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
): OcrRect {
  const x = clamp(left / imageWidth);
  const y = clamp(top / imageHeight);
  return {
    x,
    y,
    w: Math.max(0, Math.min(1 - x, width / imageWidth)),
    h: Math.max(0, Math.min(1 - y, height / imageHeight)),
  };
}

function unionRects(rects: OcrRect[]): OcrRect {
  if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  rects.forEach((r) => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  });
  return { x: minX, y: minY, w: Math.max(0, maxX - minX), h: Math.max(0, maxY - minY) };
}

function estimateQuality(text: string): OcrQuality {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return { score: 0, label: 'low' };
  const avgWordLen = words.reduce((a, w) => a + w.length, 0) / words.length;
  const alnumRatio = (text.match(/[a-zA-Z0-9]/g)?.length || 0) / Math.max(1, text.length);
  let score = 1;
  if (avgWordLen < 2.2) score -= 0.35;
  if (alnumRatio < 0.55) score -= 0.35;
  if (words.length < 8) score -= 0.2;
  score = Math.max(0, Math.min(1, score));
  const label: OcrQuality['label'] = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
  return { score, label };
}

function normalize(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeInline(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function formatErr(msg: string | string[] | undefined): string {
  if (!msg) return '';
  return Array.isArray(msg) ? msg.filter(Boolean).join(' ') : String(msg);
}
