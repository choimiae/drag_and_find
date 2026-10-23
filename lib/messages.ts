import type { LookupResult } from './lookup/types';

export const LOOKUP_MESSAGE = 'lookup';
export const TRIGGER_MESSAGE = 'trigger-from-shortcut';

export interface LookupRequest {
  type: typeof LOOKUP_MESSAGE;
  query: string;
}

export interface TriggerRequest {
  type: typeof TRIGGER_MESSAGE;
}

/** 페이지 → 백그라운드 조회 요청인지 확인한다. */
export function isLookupRequest(message: unknown): message is LookupRequest {
  return isRecord(message) && message.type === LOOKUP_MESSAGE && typeof message.query === 'string';
}

/** 백그라운드 → 페이지 단축키 알림인지 확인한다. */
export function isTriggerRequest(message: unknown): message is TriggerRequest {
  return isRecord(message) && message.type === TRIGGER_MESSAGE;
}

/** 백그라운드가 돌려준 응답이 올바른 조회 결과인지 확인한다. */
export function isLookupResult(value: unknown): value is LookupResult {
  if (!isRecord(value)) return false;
  switch (value.status) {
    case 'found':
      return (
        typeof value.title === 'string' &&
        typeof value.extract === 'string' &&
        typeof value.url === 'string' &&
        typeof value.isDisambiguation === 'boolean'
      );
    case 'not_found':
    case 'rate_limited':
    case 'network_error':
      return true;
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
