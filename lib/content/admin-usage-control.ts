import { loadUsagePreference, saveUsagePreference } from '../analytics/usage-preference';
import type { KeyValueArea } from '../storage';

const ADMIN_ORIGIN = 'https://drag-and-find-admin.maestro001220.workers.dev';
const CHANNEL = 'drag-and-find-usage';

export function installAdminUsageControl(win: Window, area: KeyValueArea): void {
  if (win.top !== win || win.location.origin !== ADMIN_ORIGIN) return;

  win.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (event.source !== win || event.origin !== ADMIN_ORIGIN) return;
    const message = event.data;
    if (typeof message !== 'object' || message === null || Array.isArray(message)) return;
    const { channel, kind, id, includeUsage } = message as Record<string, unknown>;
    if (channel !== CHANNEL || typeof id !== 'string' || id.length < 1 || id.length > 100) return;
    if (kind !== 'get' && kind !== 'set') return;
    if (kind === 'set' && typeof includeUsage !== 'boolean') return;

    void (async () => {
      try {
        if (kind === 'set') await saveUsagePreference(area, includeUsage as boolean);
        win.postMessage(
          { channel: CHANNEL, kind: 'state', id, includeUsage: await loadUsagePreference(area) },
          ADMIN_ORIGIN,
        );
      } catch {
        win.postMessage({ channel: CHANNEL, kind: 'error', id }, ADMIN_ORIGIN);
      }
    })();
  });
}
