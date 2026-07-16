/**
 * Content-hash identity for PDF de-duplication (PRD 4.1).
 */
import ReactNativeBlobUtil from 'react-native-blob-util';
import { sha256 } from '@noble/hashes/sha256';

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

/** SHA-256 hex of a local file (file:// or absolute path). */
export async function hashFileSha256(uri: string): Promise<string> {
  const path = uri.replace(/^file:\/\//, '');
  const b64 = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { decode } = require('base-64') as { decode: (s: string) => string };
  const binary = decode(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return toHex(sha256(bytes));
}

export async function fileByteSize(uri: string): Promise<number> {
  try {
    const path = uri.replace(/^file:\/\//, '');
    const stat = await ReactNativeBlobUtil.fs.stat(path);
    return Number(stat.size) || 0;
  } catch {
    return 0;
  }
}
