import { describe, expect, it, vi } from 'vitest';
import { createContextLookupHandler, type ContextLookupDeps } from '../../lib/context-lookup';

function deps() {
  return {
    openPanel: vi.fn<ContextLookupDeps['openPanel']>(async () => undefined),
    saveSelection: vi.fn<ContextLookupDeps['saveSelection']>(async () => undefined),
  };
}

describe('createContextLookupHandler', () => {
  it('opens the panel and saves the normalized selected word for its tab', async () => {
    const d = deps();
    await createContextLookupHandler(d)('  “온보딩”  ', 12);

    expect(d.openPanel).toHaveBeenCalledWith(12);
    expect(d.saveSelection).toHaveBeenCalledWith(12, '온보딩');
  });

  it('does not open a panel for an empty selection or missing tab', async () => {
    const d = deps();
    const handle = createContextLookupHandler(d);
    await handle('...', 12);
    await handle('온보딩', undefined);

    expect(d.openPanel).not.toHaveBeenCalled();
    expect(d.saveSelection).not.toHaveBeenCalled();
  });

  it('keeps an overlong selection out of the lookup path', async () => {
    const d = deps();
    await createContextLookupHandler(d)('가'.repeat(100), 12);

    expect(d.saveSelection).toHaveBeenCalledWith(12, '가'.repeat(51));
  });
});
