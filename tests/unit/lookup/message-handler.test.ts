import { describe, it, expect, vi } from 'vitest';
import { createLookupMessageHandler } from '../../../lib/lookup/message-handler';
import type { LookupService } from '../../../lib/lookup/service';

describe('createLookupMessageHandler', () => {
  it('looks up the query of a lookup message', async () => {
    const lookup = vi.fn<LookupService>(async () => ({ status: 'not_found' }));
    const handle = createLookupMessageHandler(lookup);

    expect(await handle({ type: 'lookup', query: '갓생' })).toEqual({ status: 'not_found' });
    expect(lookup).toHaveBeenCalledWith('갓생', undefined);
  });

  it('passes the context, cut to the maximum length', async () => {
    const lookup = vi.fn<LookupService>(async () => ({ status: 'not_found' }));
    const handle = createLookupMessageHandler(lookup);

    await handle({ type: 'lookup', query: '트리거', context: '가'.repeat(300) });

    expect(lookup).toHaveBeenCalledWith('트리거', '가'.repeat(250));
  });

  it('ignores other messages', () => {
    const lookup = vi.fn<LookupService>();
    const handle = createLookupMessageHandler(lookup);

    expect(handle({ type: 'something-else' })).toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
  });
});
