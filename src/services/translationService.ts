import { db } from '../db';
import { ocrPages } from '../db/schema';
import { useSettings } from '../stores/useSettings';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';

export const translatePage = async (documentId: string, pageIndex: number, sourceLang: string) => {
  const { settings } = useSettings.getState();

  // Check if translation already exists
  const existing = await db.query.ocrPages.findFirst({
    where: and(
      eq(ocrPages.documentId, documentId),
      eq(ocrPages.pageIndex, pageIndex),
      eq(ocrPages.isTranslation, true)
    )
  });

  if (existing) return JSON.parse(existing.content);

  try {
    const original = await db.query.ocrPages.findFirst({
      where: and(
        eq(ocrPages.documentId, documentId),
        eq(ocrPages.pageIndex, pageIndex),
        eq(ocrPages.isTranslation, false)
      )
    });

    if (!original) return null;

    const response = await fetch(`${settings.backendUrl}/translation/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pages: [JSON.parse(original.content)],
        source_language: sourceLang,
        target_language: 'en'
      })
    });

    if (response.ok) {
      const result = await response.json();
      const translatedPage = result.pages[0];

      await db.insert(ocrPages).values({
        id: uuidv4(),
        documentId,
        pageIndex,
        content: JSON.stringify(translatedPage),
        isTranslation: true
      });

      return translatedPage;
    }
  } catch (error) {
    console.error('Translation failed:', error);
  }
  return null;
};
