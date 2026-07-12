import { useAuth } from '../auth/useAuth';
import { useDocumentLibrary } from './useDocumentLibrary';

export const seedIfEmpty = async () => {
  const { token } = useAuth.getState();
  if (!token) {
    return;
  }

  await useDocumentLibrary.getState().fetchDocuments();
};
