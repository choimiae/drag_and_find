import { MAX_CONTEXT_LENGTH, isLookupRequest } from '../messages';
import type { LookupService } from './service';
import type { LookupResult } from './types';

/** 백그라운드로 온 메시지 중 조회 요청만 처리한다. 다른 메시지면 undefined. */
export function createLookupMessageHandler(
  lookup: LookupService,
  onResult?: (result: LookupResult) => void,
): (message: unknown) => Promise<LookupResult> | undefined {
  return (message) => {
    if (!isLookupRequest(message)) return undefined;
    return (async () => {
      let result: LookupResult;
      try {
        result = await lookup(message.query, message.context?.slice(0, MAX_CONTEXT_LENGTH));
      } catch {
        result = { status: 'network_error' };
      }
      try {
        onResult?.(result);
      } catch {
        // 부가 작업 오류가 사용자 조회 결과를 바꾸지 않게 한다.
      }
      return result;
    })();
  };
}
