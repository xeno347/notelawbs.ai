import { db } from '../db';
import { documents, ocrPages } from '../db/schema';
import { OcrStatus, OcrPageResult } from '../models/types';
import { eq } from 'drizzle-orm';
import { useSettings } from '../stores/useSettings';
import { v4 as uuidv4 } from 'uuid';

export const processOcr = async (documentId: string) => {
  const { settings } = useSettings.getState();
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  });

  if (!doc || doc.ocrStatus === OcrStatus.complete) return;

  await db.update(documents)
    .set({ ocrStatus: OcrStatus.processing })
    .where(eq(documents.id, documentId));

  try {
    const response = await fetch(`${settings.backendUrl}/ocr/process`, {
      method: 'POST',
      // Multipart body with file...
    });

    if (response.ok) {
      const result = await response.json();
      // result.pages: OcrPageResult[]

      for (const page of result.pages) {
        await db.insert(ocrPages).values({
          id: uuidv4(),
          documentId,
          pageIndex: page.pageIndex,
          content: JSON.stringify(page),
          isTranslation: false,
        });

        // Rebuild FTS
        const content = page.blocks.map((b: any) => b.text).join(' ');
        // @ts-ignore
        db.run(`
          INSERT INTO search_fts (document_id, page_index, source, content)
          VALUES ('${documentId}', ${page.pageIndex}, 'pdf', '${content.replace(/'/g, "''")}')
        `);
      }

      await db.update(documents)
        .set({
          ocrStatus: OcrStatus.complete,
          ocrConfidence: result.avg_confidence,
          detectedLanguage: result.detected_language,
        })
        .where(eq(documents.id, documentId));
    } else {
      throw new Error('OCR failed');
    }
  } catch (error) {
    console.error('OCR error:', error);
    await db.update(documents)
      .set({ ocrStatus: OcrStatus.failed })
      .where(eq(documents.id, documentId));
  }
};
