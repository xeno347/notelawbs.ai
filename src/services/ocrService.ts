import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import ReactNativeBlobUtil from 'react-native-blob-util';
import TextRecognition from '@react-native-ml-kit/text-recognition';

/**
 * On-device OCR for a single rendered PDF page. Captures the currently-rendered
 * page view as an image, runs ML Kit text recognition on it, then deletes the
 * temp capture. No network calls, no backend — everything happens on-device.
 */
export async function recognizePageText(pageRef: RefObject<View>): Promise<string> {
  const uri = await captureRef(pageRef, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
  try {
    const result = await TextRecognition.recognize(uri);
    return normalize(result.text);
  } finally {
    cleanupTemp(uri);
  }
}

function normalize(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function cleanupTemp(uri: string) {
  const path = uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
  ReactNativeBlobUtil.fs.unlink(path).catch(() => {
    /* best-effort cleanup */
  });
}
