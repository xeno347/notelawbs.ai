import DocumentPicker from 'react-native-document-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { documents } from '../db/schema';
import { DocumentType, OcrStatus, IndexStatus } from '../models/types';
import { processOcr } from './ocrService';

export const importDocument = async () => {
  try {
    const res = await DocumentPicker.pick({
      type: [DocumentPicker.types.pdf, DocumentPicker.types.docx],
    });

    const file = res[0];
    const id = uuidv4();
    const dirs = ReactNativeBlobUtil.fs.dirs;
    const pdfDir = `${dirs.DocumentDir}/litnotes_data/pdfs/`;

    // Ensure directory exists
    const exists = await ReactNativeBlobUtil.fs.isDir(pdfDir);
    if (!exists) {
      await ReactNativeBlobUtil.fs.mkdir(pdfDir);
    }

    const destPath = `${pdfDir}${id}.pdf`;

    // Copy file to local storage
    await ReactNativeBlobUtil.fs.cp(file.uri, destPath);

    const doc = {
      id,
      title: file.name || 'Untitled',
      filePath: destPath,
      pageCount: 0, // Should be analyzed
      fileSizeBytes: file.size || 0,
      lastOpened: new Date().toISOString(),
      type: file.type === 'application/pdf' ? DocumentType.pdf : DocumentType.word,
      ocrStatus: OcrStatus.none,
      ocrConfidence: 0,
      tags: JSON.stringify([]),
      indexStatus: IndexStatus.none,
    };

    // @ts-ignore
    await db.insert(documents).values(doc);

    // Trigger OCR
    processOcr(id);

    return doc;
  } catch (err) {
    if (DocumentPicker.isCancel(err)) {
      console.log('User cancelled picker');
    } else {
      console.error('Import error:', err);
    }
  }
};
