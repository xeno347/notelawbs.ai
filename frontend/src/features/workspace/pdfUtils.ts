import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { useDocumentLibrary } from '../documents/useDocumentLibrary';
import { getFileNameFromPath, toFilesystemPath, toLocalFileUri } from '../../utils/filePaths';

export const compressPdf = async (filePath: string, quality: 'standard' | 'high' | 'maximum') => {
  try {
    const normalizedPath = toFilesystemPath(filePath);
    const fileName = getFileNameFromPath(normalizedPath) || 'document.pdf';
    const suffix = quality === 'maximum' ? 'max' : quality === 'high' ? 'high' : 'std';
    const destPath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/litnotes_data/compressed/${suffix}_${fileName}`;

    const exists = await ReactNativeBlobUtil.fs.isDir(`${ReactNativeBlobUtil.fs.dirs.DocumentDir}/litnotes_data/compressed/`);
    if (!exists) {
      await ReactNativeBlobUtil.fs.mkdir(`${ReactNativeBlobUtil.fs.dirs.DocumentDir}/litnotes_data/compressed/`);
    }

    await ReactNativeBlobUtil.fs.cp(normalizedPath, destPath);
    return destPath;
  } catch (error) {
    console.error('Compression failed:', error);
  }
  return null;
};

export const shareFile = async (filePath: string, title: string) => {
  try {
    await Share.open({
      url: toLocalFileUri(filePath),
      title,
      type: 'application/pdf',
    });
  } catch (error) {
    console.error('Sharing failed:', error);
  }
};

export const cleanupImportedFiles = async () => {
  try {
    const docs = useDocumentLibrary.getState().documents;
    const referencedPaths = new Set(docs.map((doc) => doc.filePath));
    const dirs = ReactNativeBlobUtil.fs.dirs;
    const importDir = `${dirs.DocumentDir}/litnotes_data/imports/`;
    const compressedDir = `${dirs.DocumentDir}/litnotes_data/compressed/`;

    const cleanupDir = async (dirPath: string) => {
      const exists = await ReactNativeBlobUtil.fs.isDir(dirPath);
      if (!exists) {
        return 0;
      }

      const entries = await ReactNativeBlobUtil.fs.ls(dirPath);
      let removed = 0;
      for (const entry of entries) {
        const fullPath = `${dirPath}${entry}`;
        if (!referencedPaths.has(fullPath)) {
          await ReactNativeBlobUtil.fs.unlink(fullPath);
          removed += 1;
        }
      }
      return removed;
    };

    const removedImports = await cleanupDir(importDir);
    const removedCompressed = await cleanupDir(compressedDir);

    return { removedImports, removedCompressed };
  } catch (error) {
    console.error('Import cleanup failed:', error);
    return { removedImports: 0, removedCompressed: 0 };
  }
};
