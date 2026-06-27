import { db } from '../db';
import { bookmarks, ocrPages } from '../db/schema';
import { BookmarkType } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

const INDEX_PATTERNS = [
  { pattern: /\bINDEX\b/i, label: 'INDEX' },
  { pattern: /\bSYNOPSIS\b/i, label: 'SYNOPSIS' },
  { pattern: /\bFACTS\b/i, label: 'FACTS' },
  { pattern: /\bISSUES?\b/i, label: 'ISSUES' },
  { pattern: /\bARGUMENTS?\b/i, label: 'ARGUMENTS' },
  { pattern: /\bAUTHORITIES\b/i, label: 'AUTHORITIES' },
  { pattern: /\bANNEXURE\s+[A-Z0-9]+/i, label: 'ANNEXURE' },
];

export const runAutoIndex = async (documentId: string) => {
  const pages = await db.query.ocrPages.findMany({
    where: eq(ocrPages.documentId, documentId),
  });

  let sortOrder = 0;
  for (const page of pages) {
    const pageData = JSON.parse(page.content);
    for (const block of pageData.blocks) {
      if (block.text.length < 120) {
        for (const { pattern, label } of INDEX_PATTERNS) {
          if (pattern.test(block.text)) {
            await db.insert(bookmarks).values({
              id: uuidv4(),
              documentId,
              label: block.text.trim(),
              subtitle: 'Auto-detected',
              type: BookmarkType.section,
              startPage: page.pageIndex + 1,
              sortOrder: sortOrder++,
              isAutoIndexed: true,
            });
            break;
          }
        }
      }
    }
  }
};
