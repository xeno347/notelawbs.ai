import { useAuth } from '../auth/useAuth';
import { useSettings } from '../settings/useSettings';
import { runIndexPipeline, runOcrPipeline } from '../auth/backendApi';

export const processOcr = async (documentId: string) => {
  const { settings } = useSettings.getState();
  const { token } = useAuth.getState();
  if (!token) {
    throw new Error('No authenticated session.');
  }

  await runOcrPipeline(settings.backendUrl, token, documentId);
  await runIndexPipeline(settings.backendUrl, token, documentId);
};
