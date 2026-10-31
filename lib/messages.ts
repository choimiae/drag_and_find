import type { DisambiguationInfo, LookupResult, LookupSourceResult, Meaning, SenseCandidate } from './lookup/types';

export const LOOKUP_MESSAGE = 'lookup';
export const TRIGGER_MESSAGE = 'trigger-from-shortcut';

/** 찾기 요청에 담는 문맥의 최대 길이(앞 100 + 선택 최대 50 + 뒤 100). */
export const MAX_CONTEXT_LENGTH = 250;

export interface LookupRequest {
  type: typeof LOOKUP_MESSAGE;
  query: string;
  context?: string;
}

export interface TriggerRequest {
  type: typeof TRIGGER_MESSAGE;
}

/** 페이지 → 백그라운드 조회 요청인지 확인한다. */
export function isLookupRequest(message: unknown): message is LookupRequest {
  return (
    isRecord(message) &&
    message.type === LOOKUP_MESSAGE &&
    typeof message.query === 'string' &&
    (message.context === undefined || typeof message.context === 'string')
  );
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
        typeof value.isDisambiguation === 'boolean' &&
        (value.source === undefined || value.source === 'naver' || value.source === 'wikipedia') &&
        (value.disambiguation === undefined || isDisambiguationInfo(value.disambiguation)) &&
        (value.suggestion === undefined || isSenseCandidate(value.suggestion)) &&
        (value.alternatives === undefined ||
          (Array.isArray(value.alternatives) && value.alternatives.every(isLookupSourceResult)))
      );
    case 'not_found':
    case 'rate_limited':
    case 'network_error':
      return true;
    default:
      return false;
  }
}

function isLookupSourceResult(value: unknown): value is LookupSourceResult {
  return (
    isRecord(value) &&
    (value.source === 'naver' || value.source === 'wikipedia') &&
    typeof value.title === 'string' &&
    typeof value.extract === 'string' &&
    typeof value.url === 'string' &&
    typeof value.isDisambiguation === 'boolean' &&
    (value.disambiguation === undefined || isDisambiguationInfo(value.disambiguation))
  );
}

function isSenseCandidate(value: unknown): value is SenseCandidate {
  return (
    isRecord(value) &&
    typeof value.title === 'string' &&
    typeof value.extract === 'string' &&
    typeof value.url === 'string'
  );
}

function isMeaning(value: unknown): value is Meaning {
  return (
    isRecord(value) &&
    typeof value.label === 'string' &&
    (value.title === null || typeof value.title === 'string')
  );
}

function isDisambiguationInfo(value: unknown): value is DisambiguationInfo {
  return (
    isRecord(value) &&
    Array.isArray(value.basic) &&
    value.basic.every((line) => typeof line === 'string') &&
    Array.isArray(value.meanings) &&
    value.meanings.every(isMeaning) &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isSenseCandidate)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
