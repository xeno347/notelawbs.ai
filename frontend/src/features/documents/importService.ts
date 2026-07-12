import DocumentPicker from 'react-native-document-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Document, DocumentType, OcrStatus, IndexStatus } from '../../models/types';
import { createId } from '../../utils/id';
import { toFilesystemPath } from '../../utils/filePaths';
import { useAuth } from '../auth/useAuth';
import { useSettings } from '../settings/useSettings';
import { createDocument, runOcrPipeline } from '../auth/backendApi';

export const importDocument = async (): Promise<Document | undefined> => {
  try {
    const file = await DocumentPicker.pickSingle({
      type: [DocumentPicker.types.pdf, DocumentPicker.types.docx],
      copyTo: 'documentDirectory',
    });

    const id = createId('doc');
    const dirs = ReactNativeBlobUtil.fs.dirs;
    const importDir = `${dirs.DocumentDir}/litnotes_data/imports/`;

    // Ensure directory exists
    const exists = await ReactNativeBlobUtil.fs.isDir(importDir);
    if (!exists) {
      await ReactNativeBlobUtil.fs.mkdir(importDir);
    }

    const originalName = file.name || 'Untitled';
    const fileExt = originalName.includes('.') ? `.${originalName.split('.').pop()}` : (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? '.docx' : '.pdf');
    const destPath = `${importDir}${id}${fileExt}`;
    const sourcePath = file.fileCopyUri ?? file.uri;
    if (!sourcePath) {
      throw new Error('Document picker did not return a usable file URI');
    }

    // Copy file to local storage
    await ReactNativeBlobUtil.fs.cp(toFilesystemPath(sourcePath), destPath);

    const doc: Document = {
      id,
      title: file.name || 'Untitled',
      filePath: destPath,
      pageCount: 0, // Should be analyzed
      fileSizeBytes: file.size || 0,
      lastOpened: new Date().toISOString(),
      type: fileExt === '.pdf' ? DocumentType.pdf : DocumentType.word,
      ocrStatus: OcrStatus.none,
      ocrConfidence: 0,
      tags: [],
      indexStatus: IndexStatus.none,
    };

    const { settings } = useSettings.getState();
    const { token } = useAuth.getState();
    if (!token) {
      throw new Error('No authenticated session.');
    }
    await createDocument(settings.backendUrl, token, doc);
    void runOcrPipeline(settings.backendUrl, token, id);

    return doc;
  } catch (err) {
    if (DocumentPicker.isCancel(err)) {
      console.log('User cancelled picker');
    } else {
      console.error('Import error:', err);
    }
  }
};
