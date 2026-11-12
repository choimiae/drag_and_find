import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSidepanelView } from '../../lib/sidepanel-view';
import type { LookupResult } from '../../lib/lookup/types';

const FOUND: LookupResult = {
  status: 'found',
  title: '온보딩',
  extract: '새 구성원이 적응하도록 돕는 과정',
  url: 'https://ko.wikipedia.org/wiki/%EC%98%A8%EB%B3%B4%EB%94%A9',
  source: 'wikipedia',
  isDisambiguation: false,
};

beforeEach(() => {
  document.body.replaceChildren();
});

function part(role: string): HTMLElement | null {
  return document.querySelector('main')?.shadowRoot?.querySelector(`[data-role="${role}"]`) ?? null;
}

describe('createSidepanelView', () => {
  it('shows a lookup result for a selected word', async () => {
    const lookup = vi.fn(async () => FOUND);
    const view = createSidepanelView(document, lookup);

    view.showSelection('  온보딩  ');
    await vi.waitFor(() => expect(part('extract')?.textContent).toBe(FOUND.extract));
    expect(lookup).toHaveBeenCalledWith('온보딩');
  });

  it('shows the length warning without sending overlong text', () => {
    const lookup = vi.fn(async () => FOUND);
    const view = createSidepanelView(document, lookup);

    view.showSelection('가'.repeat(51));

    expect(part('card')?.textContent).toContain('50자 이하');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('keeps the latest selection when an earlier request finishes late', async () => {
    let resolveFirst!: (result: LookupResult) => void;
    const lookup = vi
      .fn<(query: string) => Promise<LookupResult>>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ ...FOUND, title: '트리거', extract: '두 번째 설명' });
    const view = createSidepanelView(document, lookup);

    view.showSelection('온보딩');
    view.showSelection('트리거');
    await vi.waitFor(() => expect(part('extract')?.textContent).toBe('두 번째 설명'));
    resolveFirst(FOUND);
    await Promise.resolve();
    expect(part('extract')?.textContent).toBe('두 번째 설명');
  });

  it('clears a previous result when the active tab has no lookup', async () => {
    const view = createSidepanelView(document, async () => FOUND);
    view.showSelection('온보딩');
    await vi.waitFor(() => expect(part('extract')).not.toBeNull());

    view.clear();

    expect(part('card')).toBeNull();
    expect(document.querySelector('main')?.shadowRoot?.textContent).toContain(
      'PDF에서 단어를 선택한 뒤',
    );
  });
});
