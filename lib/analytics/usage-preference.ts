import type { KeyValueArea } from '../storage';

export const USAGE_PREFERENCE_KEY = 'includeUsage';

export async function loadUsagePreference(area: Pick<KeyValueArea, 'get'>): Promise<boolean> {
  return (await area.get(USAGE_PREFERENCE_KEY))[USAGE_PREFERENCE_KEY] !== false;
}

export async function saveUsagePreference(
  area: Pick<KeyValueArea, 'set'>,
  includeUsage: boolean,
): Promise<void> {
  await area.set({ [USAGE_PREFERENCE_KEY]: includeUsage });
}
