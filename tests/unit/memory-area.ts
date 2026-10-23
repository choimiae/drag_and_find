import type { KeyValueArea } from '../../lib/storage';

/** 테스트용 메모리 저장소. */
export function memoryArea(initial: Record<string, unknown> = {}): KeyValueArea {
  let data = { ...initial };
  return {
    async get(key) {
      return key in data ? { [key]: data[key] } : {};
    },
    async set(items) {
      data = { ...data, ...items };
    },
  };
}
