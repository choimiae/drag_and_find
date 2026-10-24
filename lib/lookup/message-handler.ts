import { MAX_CONTEXT_LENGTH, isLookupRequest } from '../messages';
import type { LookupService } from './service';
import type { LookupResult } from './types';

/** 백그라운드로 온 메시지 중 조회 요청만 처리한다. 다른 메시지면 undefined. */
export function createLookupMessageHandler(
  lookup: LookupService,
): (message: unknown) => Promise<LookupResult> | undefined {
  return (message) =>
    isLookupRequest(message)
      ? lookup(message.query, message.context?.slice(0, MAX_CONTEXT_LENGTH))
      : undefined;
}
