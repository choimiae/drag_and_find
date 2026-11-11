import { describe, it, expect, vi } from 'vitest';
import { createLookupMessageHandler } from '../../../lib/lookup/message-handler';
import type { LookupService } from '../../../lib/lookup/service';
import { createFallbackLookupService } from '../../../lib/lookup/fallback-service';

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

  it('Worker 장애 후 직접 조회한 최종 결과를 한 번만 통계에 전달한다', async () => {
    const lookup = createFallbackLookupService(
      async () => ({ status: 'network_error' }),
      async () => ({ status: 'not_found' }),
    );
    const onResult = vi.fn();
    const handle = createLookupMessageHandler(lookup, onResult);

    expect(await handle({ type: 'lookup', query: '단어' })).toEqual({ status: 'not_found' });
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith({ status: 'not_found' });
  });

  it('조회 함수가 예외를 내도 실패 결과를 통계에 한 번 전달한다', async () => {
    const onResult = vi.fn();
    const handle = createLookupMessageHandler(async () => {
      throw new Error('offline');
    }, onResult);

    expect(await handle({ type: 'lookup', query: '단어' })).toEqual({ status: 'network_error' });
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith({ status: 'network_error' });
  });
});
