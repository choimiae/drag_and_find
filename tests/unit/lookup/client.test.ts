import { describe, it, expect, vi } from 'vitest';
import { createLookupClient } from '../../../lib/lookup/client';
import type { LookupRequest } from '../../../lib/messages';

type Send = (message: LookupRequest) => Promise<unknown>;

describe('createLookupClient', () => {
  it('sends a lookup message and returns a valid result', async () => {
    const send = vi.fn<Send>(async () => ({ status: 'not_found' }));

    const result = await createLookupClient(send)('갓생');

    expect(send).toHaveBeenCalledWith({ type: 'lookup', query: '갓생' });
    expect(result).toEqual({ status: 'not_found' });
  });

  it('returns network_error when the extension connection is gone', async () => {
    const send = vi.fn<Send>(async () => {
      throw new Error('Extension context invalidated.');
    });

    expect(await createLookupClient(send)('온보딩')).toEqual({ status: 'network_error' });
  });

  it('returns network_error for a malformed response', async () => {
    const send = vi.fn<Send>(async () => ({ status: 'found' }));

    expect(await createLookupClient(send)('온보딩')).toEqual({ status: 'network_error' });
  });
});
