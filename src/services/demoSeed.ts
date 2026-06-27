import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { documents, bookmarks } from '../db/schema';
import {
  DocumentType,
  OcrStatus,
  IndexStatus,
  Language,
  BookmarkType
} from '../models/types';

const DEMO_DOCS = [
  {
    id: 'demo-petition-001',
    title: 'litnotes_demo_petition.pdf',
    pageCount: 12,
    language: Language.english,
  },
  // ... more docs from the list
];

export const seedIfEmpty = async () => {
  const existingDocs = await db.query.documents.findMany();
  if (existingDocs.length === 0) {
    console.log('Seeding demo documents...');
    for (const demo of DEMO_DOCS) {
      // In a real app, we'd copy from assets
      // For now, we just insert metadata
      await db.insert(documents).values({
        id: demo.id,
        title: demo.title,
        filePath: `${FileSystem.documentDirectory}litnotes_data/pdfs/${demo.id}.pdf`,
        pageCount: demo.pageCount,
        fileSizeBytes: 0,
        lastOpened: new Date().toISOString(),
        type: DocumentType.pdf,
        ocrStatus: OcrStatus.complete,
        ocrConfidence: 0.95,
        detectedLanguage: demo.language,
        tags: JSON.stringify(['demo']),
        indexStatus: IndexStatus.complete,
      });
    }
  }
};
