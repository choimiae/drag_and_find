import { LOOKUP_MESSAGE, isLookupResult, type LookupRequest } from '../messages';
import type { LookupResult } from './types';

/** 페이지 쪽에서 백그라운드에 조회를 요청한다. 연결이 끊기거나 응답이 깨지면 network_error. */
export function createLookupClient(
  send: (message: LookupRequest) => Promise<unknown>,
): (query: string, context?: string) => Promise<LookupResult> {
  return async (query, context) => {
    try {
      const response = await send({
        type: LOOKUP_MESSAGE,
        query,
        ...(context === undefined ? {} : { context }),
      });
      return isLookupResult(response) ? response : { status: 'network_error' };
    } catch {
      // 확장이 업데이트·재시작되면 이미 열린 페이지와의 연결이 끊긴다. 사용자에게는 연결 실패로 보여 준다.
      return { status: 'network_error' };
    }
  };
}
