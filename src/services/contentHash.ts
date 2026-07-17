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

/** Skip full-file hashing above this size — loading large PDFs as base64 OOMs JS. */
const HASH_MAX_BYTES = 4 * 1024 * 1024;

/** SHA-256 hex of a local file (file:// or absolute path). */
export async function hashFileSha256(uri: string): Promise<string> {
  const path = uri.replace(/^file:\/\//, '');
  try {
    const stat = await ReactNativeBlobUtil.fs.stat(path);
    const size = Number(stat.size) || 0;
    if (size > HASH_MAX_BYTES) {
      // Stable identity without loading the whole file into memory.
      const tag = `size:${size}|mtime:${stat.lastModified || 0}|name:${path.split('/').pop() || ''}`;
      const bytes = new Uint8Array(tag.length);
      for (let i = 0; i < tag.length; i++) bytes[i] = tag.charCodeAt(i) & 0xff;
      return toHex(sha256(bytes));
    }
  } catch {
    /* fall through to full read */
  }
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
