/** chrome.storage 영역 중 이 확장이 쓰는 최소 기능. 테스트에서 메모리 저장소로 바꿔 끼운다. */
export interface KeyValueArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}
