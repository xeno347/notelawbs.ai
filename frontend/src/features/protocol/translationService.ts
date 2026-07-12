import { useAuth } from '../auth/useAuth';
import { useSettings } from '../settings/useSettings';
import { request } from '../auth/backendApi';

export const translatePage = async (documentId: string, pageIndex: number, sourceLang: string) => {
  const { settings } = useSettings.getState();
  const { token } = useAuth.getState();
  if (!token) {
    throw new Error('No authenticated session.');
  }

  const response = await request<{ page: any }>(settings.backendUrl, `/api/documents/${documentId}/pipeline/translate?pageIndex=${pageIndex}&sourceLang=${encodeURIComponent(sourceLang)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.page;
};
