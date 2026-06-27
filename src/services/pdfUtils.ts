import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { useSettings } from '../stores/useSettings';

export const compressPdf = async (filePath: string, quality: 'standard' | 'high' | 'maximum') => {
  const { settings } = useSettings.getState();

  try {
    const response = await ReactNativeBlobUtil.config({
      fileCache: true,
    }).fetch('POST', `${settings.backendUrl}/pdf/compress?quality=${quality}`, {
      'Content-Type': 'application/octet-stream',
    }, ReactNativeBlobUtil.wrap(filePath));

    if (response.respInfo.status === 200) {
      const newPath = response.path();
      return newPath;
    }
  } catch (error) {
    console.error('Compression failed:', error);
  }
  return null;
};

export const shareFile = async (filePath: string, title: string) => {
  try {
    await Share.open({
      url: `file://${filePath}`,
      title,
      type: 'application/pdf',
    });
  } catch (error) {
    console.error('Sharing failed:', error);
  }
};
