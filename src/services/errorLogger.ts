import apiClient, { resilientRequest } from './apiClient';

async function sendToServer(payload: Record<string, unknown>) {
  try {
    await resilientRequest({ url: '/errors', method: 'POST', data: payload });
  } catch (err) {
    // fallback to apiClient.post if resilientRequest unavailable
    try {
      await apiClient.post('/errors', payload);
    } catch {
      // swallow — logging best-effort
    }
  }
}

async function logError(err: unknown, meta: string | Record<string, unknown> = ''): Promise<void> {
  try {
    const payload = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      meta,
      timestamp: Date.now(),
    };
    // console log locally for developer visibility
    // eslint-disable-next-line no-console
    console.error('[ErrorLogger]', payload);
    await sendToServer(payload);
  } catch (e) {
    // final fallback — do nothing
  }
}

export default { logError };
