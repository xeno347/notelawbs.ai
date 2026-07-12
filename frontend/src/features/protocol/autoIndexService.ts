import { processOcr } from './ocrService';

export const runAutoIndex = async (documentId: string) => {
  await processOcr(documentId);
};
