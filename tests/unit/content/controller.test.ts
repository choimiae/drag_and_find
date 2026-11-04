import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createController, type ControllerDeps } from '../../../lib/content/controller';
import type { LookupResult } from '../../../lib/lookup/types';
import type { Overlay } from '../../../lib/ui/overlay';

const FOUND: LookupResult = {
  status: 'found',
  title: '온보딩',
  extract: '설명',
  url: 'https://ko.wikipedia.org/wiki/x',
  isDisambiguation: false,
};

const MEANINGS: LookupResult = {
  status: 'found',
  source: 'wikipedia',
  title: '트리거',
  extract: '',
  url: 'https://ko.wikipedia.org/wiki/트리거',
  isDisambiguation: true,
  disambiguation: {
    basic: [],
    meanings: [{ label: '데이터베이스 트리거', title: '데이터베이스 트리거' }],
    candidates: [],
  },
};

const DETAIL: LookupResult = {
  status: 'found',
  source: 'wikipedia',
  title: '데이터베이스 트리거',
  extract: '테이블 변경 시 실행되는 절차',
  url: 'https://ko.wikipedia.org/wiki/데이터베이스_트리거',
  isDisambiguation: false,
};

function fakeOverlay() {
  return {
    showIcon: vi.fn<Overlay['showIcon']>(),
    hideIcon: vi.fn<Overlay['hideIcon']>(),
    showCard: vi.fn<Overlay['showCard']>(),
    readCardScroll: vi.fn<Overlay['readCardScroll']>(() => ({ body: 25, meanings: 80 })),
    restoreCardScroll: vi.fn<Overlay['restoreCardScroll']>(),
    focusMeaning: vi.fn<Overlay['focusMeaning']>(),
    hideCard: vi.fn<Overlay['hideCard']>(),
    contains: vi.fn<Overlay['contains']>(() => false),
    setTheme: vi.fn<Overlay['setTheme']>(),
  };
}

function setup(overrides: Partial<ControllerDeps> = {}) {
  const overlay = fakeOverlay();
  const requestLookup = vi.fn<ControllerDeps['requestLookup']>(async () => FOUND);
  const controller = createController({
    win: window,
    overlay,
    requestLookup,
    isIconEnabled: async () => true,
    ...overrides,
  });
  return { overlay, requestLookup, controller };
}

function selectContentsOf(id: string) {
  const range = document.createRange();
  range.selectNodeContents(document.getElementById(id)!);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const settle = async () => {
  await tick();
  await tick();
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const lastCardState = (overlay: ReturnType<typeof fakeOverlay>) =>
  overlay.showCard.mock.calls.at(-1)?.[2];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  document.body.innerHTML = `
    <p>요즘 <span id="term">온보딩</span> 과정을 다룬다.</p>
    <p><span id="quoted">"온보딩",</span></p>
    <p><span id="long">${'가'.repeat(51)}</span></p>
    <div contenteditable="true"><span id="editable">온보딩</span></div>`;
  window.getSelection()?.removeAllRanges();
});

describe('mouse selection', () => {
  it('shows the icon after selecting a word', async () => {
    const { overlay, controller } = setup();
    selectContentsOf('term');

    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();

    expect(overlay.showIcon).toHaveBeenCalledTimes(1);
  });

  it('does not show the icon when it is turned off', async () => {
    const { overlay, controller } = setup({ isIconEnabled: async () => false });
    selectContentsOf('term');

    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();

    expect(overlay.showIcon).not.toHaveBeenCalled();
    expect(overlay.hideIcon).toHaveBeenCalled();
  });

  it('still shows the icon without throwing when the extension context is invalidated', async () => {
    const { overlay, controller } = setup({
      isIconEnabled: async () => {
        throw new Error('Extension context invalidated.');
      },
    });
    selectContentsOf('term');

    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();

    expect(overlay.showIcon).toHaveBeenCalledTimes(1);
  });

  it.each(['editable', 'long'])('does not show the icon for the %s selection', async (id) => {
    const { overlay, controller } = setup();
    selectContentsOf(id);

    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();

    expect(overlay.showIcon).not.toHaveBeenCalled();
  });

  it('ignores mouseup inside the overlay', async () => {
    const { overlay, controller } = setup();
    overlay.contains.mockReturnValue(true);
    selectContentsOf('term');

    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();

    expect(overlay.showIcon).not.toHaveBeenCalled();
  });

  it('clicking the icon shows loading and then the result', async () => {
    const { overlay, requestLookup, controller } = setup();
    selectContentsOf('quoted');
    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();

    overlay.showIcon.mock.calls[0]?.[1]();
    await settle();

    expect(requestLookup).toHaveBeenCalledWith('온보딩', expect.any(String));
    expect(overlay.showCard.mock.calls[0]?.[2]).toEqual({ kind: 'loading' });
    expect(lastCardState(overlay)).toEqual({ kind: 'result', result: FOUND });
    expect(overlay.hideIcon).toHaveBeenCalled();
  });
});

describe('anchor coordinates', () => {
  const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')!;
  afterEach(() => {
    Object.defineProperty(window, 'scrollY', originalScrollY);
  });

  it('captures the anchor in document coordinates by adding the scroll at selection time', async () => {
    Object.defineProperty(window, 'scrollY', { value: 250, configurable: true });
    const { overlay, controller } = setup();
    selectContentsOf('term');

    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();

    // happy-dom 은 레이아웃이 없어 선택 영역의 화면 좌표가 0 이므로, 문서 좌표는 스크롤 값과 같다.
    expect(overlay.showIcon.mock.calls[0]?.[0]).toMatchObject({ top: 250, bottom: 250 });
  });

  it('passes the same anchor to the card even if the page scrolls before the icon is clicked', async () => {
    const { overlay, controller } = setup();
    selectContentsOf('term');
    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();
    const iconAnchor = overlay.showIcon.mock.calls[0]?.[0];

    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true });
    overlay.showIcon.mock.calls[0]?.[1]();
    await settle();

    expect(overlay.showCard.mock.calls.length).toBeGreaterThan(0);
    for (const call of overlay.showCard.mock.calls) expect(call[0]).toEqual(iconAnchor);
  });
});

describe('shortcut', () => {
  it('looks up the normalized selection', async () => {
    const { requestLookup, controller } = setup();
    selectContentsOf('quoted');

    controller.handleShortcut();
    await settle();

    expect(requestLookup).toHaveBeenCalledWith('온보딩', expect.any(String));
  });

  it('shows the too-long card without looking up', () => {
    const { overlay, requestLookup, controller } = setup();
    selectContentsOf('long');

    controller.handleShortcut();

    expect(lastCardState(overlay)).toEqual({ kind: 'too_long' });
    expect(requestLookup).not.toHaveBeenCalled();
  });

  it('does nothing without a selection', () => {
    const { overlay, controller } = setup();

    controller.handleShortcut();

    expect(overlay.showCard).not.toHaveBeenCalled();
  });

  it('does nothing when this frame does not have focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const { overlay, requestLookup, controller } = setup();
    selectContentsOf('term');

    controller.handleShortcut();

    expect(overlay.showCard).not.toHaveBeenCalled();
    expect(requestLookup).not.toHaveBeenCalled();
  });

  it('does nothing inside an editable area', () => {
    const { overlay, controller } = setup();
    selectContentsOf('editable');

    controller.handleShortcut();

    expect(overlay.showCard).not.toHaveBeenCalled();
  });
});

describe('late responses', () => {
  it('shows only the latest lookup when an earlier response arrives late', async () => {
    const first = deferred<LookupResult>();
    const second = deferred<LookupResult>();
    const requestLookup = vi
      .fn<ControllerDeps['requestLookup']>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { overlay, controller } = setup({ requestLookup });
    selectContentsOf('term');

    controller.handleShortcut();
    controller.handleShortcut();
    second.resolve({ status: 'not_found' });
    await settle();
    first.resolve(FOUND);
    await settle();

    expect(lastCardState(overlay)).toEqual({ kind: 'result', result: { status: 'not_found' } });
  });

  it('does not reopen the card when a response arrives after closing with Esc', async () => {
    const pending = deferred<LookupResult>();
    const { overlay, controller } = setup({ requestLookup: () => pending.promise });
    selectContentsOf('term');

    controller.handleShortcut();
    controller.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
    const callsAfterClose = overlay.showCard.mock.calls.length;
    pending.resolve(FOUND);
    await settle();

    expect(overlay.hideCard).toHaveBeenCalled();
    expect(overlay.showCard.mock.calls).toHaveLength(callsAfterClose);
  });

  it('uses only the latest direct lookup response', async () => {
    const oldResponse = deferred<LookupResult>();
    const newResponse = deferred<LookupResult>();
    const requestLookup = vi
      .fn<ControllerDeps['requestLookup']>()
      .mockResolvedValueOnce(FOUND)
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(newResponse.promise);
    const { overlay, controller } = setup({ requestLookup });
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();
    overlay.showCard.mock.calls.at(-1)![3].onLookup('첫 단어');
    overlay.showCard.mock.calls.at(-1)![3].onLookup('새 단어');
    newResponse.resolve({ status: 'not_found' });
    await settle();
    oldResponse.resolve(FOUND);
    await settle();

    expect(overlay.showCard.mock.calls.at(-1)?.[1]).toBe('새 단어');
    expect(lastCardState(overlay)).toEqual({ kind: 'result', result: { status: 'not_found' } });
  });

  it('retry looks up the same word again', async () => {
    const { overlay, requestLookup, controller } = setup();
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();

    overlay.showCard.mock.calls.at(-1)?.[3].onRetry();
    await settle();

    expect(requestLookup).toHaveBeenCalledTimes(2);
    expect(requestLookup).toHaveBeenLastCalledWith('온보딩', expect.any(String));
  });
});

describe('context and meanings', () => {
  it('looks up a directly entered word without the selected page context', async () => {
    const { overlay, requestLookup, controller } = setup();
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();

    overlay.showCard.mock.calls.at(-1)![3].onLookup('데이터베이스');
    await settle();

    expect(requestLookup).toHaveBeenLastCalledWith('데이터베이스', undefined);
    expect(overlay.showCard.mock.calls.at(-1)?.[1]).toBe('데이터베이스');
  });

  it('leaves a meaning detail when a new word is entered directly', async () => {
    const requestLookup = vi
      .fn<ControllerDeps['requestLookup']>()
      .mockResolvedValueOnce(MEANINGS)
      .mockResolvedValueOnce(DETAIL)
      .mockResolvedValueOnce(FOUND);
    const { overlay, controller } = setup({ requestLookup });
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();
    overlay.showCard.mock.calls.at(-1)![3].onSelectMeaning('데이터베이스 트리거');
    await settle();

    overlay.showCard.mock.calls.at(-1)![3].onLookup('새 단어');
    await settle();

    expect(overlay.showCard.mock.calls.at(-1)?.[3].onBackToMeanings).toBeUndefined();
    expect(requestLookup).toHaveBeenLastCalledWith('새 단어', undefined);
  });

  it('sends the surrounding paragraph as context', async () => {
    const { requestLookup, controller } = setup();
    selectContentsOf('term');

    controller.handleShortcut();
    await settle();

    expect(requestLookup).toHaveBeenCalledWith('온보딩', '요즘 온보딩 과정을 다룬다.');
  });

  it('looks up a chosen meaning at the same place without context', async () => {
    const { overlay, requestLookup, controller } = setup();
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();
    const anchor = overlay.showCard.mock.calls.at(-1)?.[0];

    overlay.showCard.mock.calls.at(-1)?.[3].onSelectMeaning('데이터베이스 트리거');
    await settle();

    expect(requestLookup).toHaveBeenLastCalledWith('데이터베이스 트리거', undefined);
    expect(overlay.showCard.mock.calls.at(-1)?.[0]).toEqual(anchor);
  });

  it('retries with the same context', async () => {
    const { overlay, requestLookup, controller } = setup();
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();

    overlay.showCard.mock.calls.at(-1)?.[3].onRetry();
    await settle();

    expect(requestLookup).toHaveBeenLastCalledWith('온보딩', '요즘 온보딩 과정을 다룬다.');
  });

  it('returns to the original meaning list and scroll position without another lookup', async () => {
    const requestLookup = vi
      .fn<ControllerDeps['requestLookup']>()
      .mockResolvedValueOnce(MEANINGS)
      .mockResolvedValueOnce(DETAIL);
    const { overlay, controller } = setup({ requestLookup });
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();

    overlay.showCard.mock.calls.at(-1)![3].onSelectMeaning('데이터베이스 트리거');
    await settle();
    expect(lastCardState(overlay)).toEqual({ kind: 'result', result: DETAIL });
    expect(overlay.showCard.mock.calls.at(-1)?.[3].onBackToMeanings).toBeTypeOf('function');

    overlay.showCard.mock.calls.at(-1)![3].onBackToMeanings?.();

    expect(lastCardState(overlay)).toEqual({ kind: 'result', result: MEANINGS });
    expect(overlay.showCard.mock.calls.at(-1)?.[1]).toBe('온보딩');
    expect(overlay.restoreCardScroll).toHaveBeenCalledWith({ body: 25, meanings: 80 });
    expect(overlay.focusMeaning).toHaveBeenCalledWith('데이터베이스 트리거');
    expect(requestLookup).toHaveBeenCalledTimes(2);
  });

  it('keeps the restored list when a meaning response arrives after going back', async () => {
    const pending = deferred<LookupResult>();
    const requestLookup = vi
      .fn<ControllerDeps['requestLookup']>()
      .mockResolvedValueOnce(MEANINGS)
      .mockReturnValueOnce(pending.promise);
    const { overlay, controller } = setup({ requestLookup });
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();

    overlay.showCard.mock.calls.at(-1)![3].onSelectMeaning('데이터베이스 트리거');
    expect(lastCardState(overlay)).toEqual({ kind: 'loading' });
    overlay.showCard.mock.calls.at(-1)![3].onBackToMeanings?.();
    pending.resolve(DETAIL);
    await settle();

    expect(lastCardState(overlay)).toEqual({ kind: 'result', result: MEANINGS });
    expect(requestLookup).toHaveBeenCalledTimes(2);
  });

  it('keeps the back action after a meaning lookup fails', async () => {
    const requestLookup = vi
      .fn<ControllerDeps['requestLookup']>()
      .mockResolvedValueOnce(MEANINGS)
      .mockResolvedValueOnce({ status: 'network_error' });
    const { overlay, controller } = setup({ requestLookup });
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();

    overlay.showCard.mock.calls.at(-1)![3].onSelectMeaning('데이터베이스 트리거');
    await settle();
    expect(lastCardState(overlay)).toEqual({
      kind: 'result',
      result: { status: 'network_error' },
    });
    overlay.showCard.mock.calls.at(-1)![3].onBackToMeanings?.();

    expect(lastCardState(overlay)).toEqual({ kind: 'result', result: MEANINGS });
  });

  it('clears the previous meaning list when a new selection is looked up', async () => {
    const requestLookup = vi
      .fn<ControllerDeps['requestLookup']>()
      .mockResolvedValueOnce(MEANINGS)
      .mockResolvedValueOnce(DETAIL)
      .mockResolvedValueOnce(FOUND);
    const { overlay, controller } = setup({ requestLookup });
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();
    overlay.showCard.mock.calls.at(-1)![3].onSelectMeaning('데이터베이스 트리거');
    await settle();

    controller.handleShortcut();
    await settle();

    expect(lastCardState(overlay)).toEqual({ kind: 'result', result: FOUND });
    expect(overlay.showCard.mock.calls.at(-1)?.[3].onBackToMeanings).toBeUndefined();
  });
});

describe('closing', () => {
  it('closes on mousedown outside the overlay', () => {
    const { overlay, controller } = setup();

    controller.handleMouseDown(new MouseEvent('mousedown'));

    expect(overlay.hideCard).toHaveBeenCalled();
    expect(overlay.hideIcon).toHaveBeenCalled();
  });

  it('stays open on mousedown inside the overlay', () => {
    const { overlay, controller } = setup();
    overlay.contains.mockReturnValue(true);

    controller.handleMouseDown(new MouseEvent('mousedown'));

    expect(overlay.hideCard).not.toHaveBeenCalled();
  });

  it('ignores keys other than Escape', () => {
    const { overlay, controller } = setup();

    controller.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(overlay.hideCard).not.toHaveBeenCalled();
  });

  it('the close button handler closes the card', async () => {
    const { overlay, controller } = setup();
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();

    overlay.showCard.mock.calls.at(-1)?.[3].onClose();

    expect(overlay.hideCard).toHaveBeenCalled();
  });
});
