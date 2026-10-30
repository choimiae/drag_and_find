import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderCard, type CardHandlers, type CardState } from '../../../lib/ui/card';
import type { FoundResult } from '../../../lib/lookup/types';
import { searchUrl } from '../../../lib/search-urls';
import type { SearchEngine } from '../../../lib/settings';

let card: HTMLElement;
let handlers: CardHandlers;

const part = (role: string) => card.querySelector<HTMLElement>(`[data-role="${role}"]`);

const url = 'https://ko.wikipedia.org/wiki/x';
const DATABASE = { title: '데이터베이스 트리거', extract: '테이블에 행이 추가되면 실행', url };

function disambiguation(overrides: Partial<FoundResult> = {}): CardState {
  return {
    kind: 'result',
    result: {
      status: 'found',
      title: '트리거',
      extract: '',
      url,
      isDisambiguation: true,
      disambiguation: {
        basic: ['총의 방아쇠를 뜻하는 사격용어이다.'],
        meanings: [
          { label: '데이터베이스 트리거', title: '데이터베이스 트리거' },
          { label: '트리거 (애니메이션 제작사)', title: '트리거 (애니메이션 제작사)' },
          { label: '트리거 전략', title: null },
        ],
        candidates: [DATABASE],
      },
      ...overrides,
    },
  };
}

beforeEach(() => {
  card = document.createElement('section');
  handlers = {
    onClose: vi.fn(),
    onRetry: vi.fn(),
    onSelectMeaning: vi.fn(),
    getSearchEngine: () => 'naver',
  };
});

describe('renderCard', () => {
  it('shows a Naver encyclopedia result with its original link and source', () => {
    renderCard(
      card,
      '온보딩',
      {
        kind: 'result',
        result: {
          status: 'found',
          source: 'naver',
          title: '온보딩',
          extract: '신입 직원이 조직에 적응하는 과정',
          url: 'https://terms.naver.com/entry.naver?docId=123',
          isDisambiguation: false,
        },
      },
      handlers,
    );

    expect(part('extract')?.textContent).toBe('신입 직원이 조직에 적응하는 과정');
    expect(part('source-link')?.textContent).toBe('네이버 백과에서 보기 →');
    expect(part('source-link')?.getAttribute('href')).toBe(
      'https://terms.naver.com/entry.naver?docId=123',
    );
    expect(part('attribution')?.textContent).toContain('네이버 백과');
    expect(part('license-link')).toBeNull();
  });
  it('shows loading text with the query and search buttons', () => {
    renderCard(card, '온보딩', { kind: 'loading' }, handlers);

    expect(part('title')?.textContent).toBe('온보딩');
    expect(part('body')?.textContent).toBe('찾는 중…');
    expect(part('google')?.getAttribute('href')).toBe(
      'https://www.google.com/search?q=%EC%98%A8%EB%B3%B4%EB%94%A9',
    );
    expect(part('naver')?.getAttribute('href')).toBe(
      'https://search.naver.com/search.naver?query=%EC%98%A8%EB%B3%B4%EB%94%A9',
    );
  });

  it('opens search buttons in a new tab safely', () => {
    renderCard(card, '온보딩', { kind: 'loading' }, handlers);

    for (const role of ['google', 'naver']) {
      expect(part(role)?.getAttribute('target')).toBe('_blank');
      expect(part(role)?.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('shows the article title, extract and wiki link when found', () => {
    renderCard(
      card,
      'SaaS',
      {
        kind: 'result',
        result: {
          status: 'found',
          title: '서비스형 소프트웨어',
          extract: '응용 소프트웨어를 서비스로 제공하는 방식',
          url: 'https://ko.wikipedia.org/wiki/x',
          isDisambiguation: false,
        },
      },
      handlers,
    );

    expect(part('title')?.textContent).toBe('서비스형 소프트웨어');
    expect(part('extract')?.textContent).toBe('응용 소프트웨어를 서비스로 제공하는 방식');
    expect(part('wiki-link')?.getAttribute('href')).toBe('https://ko.wikipedia.org/wiki/x');
    expect(part('wiki-link')?.textContent).toBe('위키백과에서 보기 →');
    expect(part('google')?.getAttribute('href')).toBe('https://www.google.com/search?q=SaaS');
  });

  it('never turns the extract into HTML', () => {
    renderCard(
      card,
      'x',
      {
        kind: 'result',
        result: {
          status: 'found',
          title: 'x',
          extract: '<img src=x onerror=alert(1)>',
          url: 'https://ko.wikipedia.org/wiki/x',
          isDisambiguation: false,
        },
      },
      handlers,
    );

    expect(card.querySelector('img')).toBeNull();
    expect(part('extract')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('shows the disambiguation notice with the wiki link', () => {
    renderCard(
      card,
      'POC',
      {
        kind: 'result',
        result: {
          status: 'found',
          title: 'POC',
          extract: '여러 뜻',
          url: 'https://ko.wikipedia.org/wiki/POC',
          isDisambiguation: true,
        },
      },
      handlers,
    );

    expect(part('body')?.textContent).toContain('뜻이 여러 개인 단어입니다');
    expect(part('extract')).toBeNull();
    expect(part('wiki-link')).not.toBeNull();
  });

  it.each([
    ['not_found', '네이버 백과와 위키백과에 결과가 없습니다'],
    ['rate_limited', '요청이 많아 잠시 막혔습니다. 잠시 후 다시 시도해 주세요'],
  ] as const)('shows the %s message with search buttons', (status, message) => {
    renderCard(card, '갓생', { kind: 'result', result: { status } }, handlers);

    expect(part('body')?.textContent).toBe(message);
    expect(part('google')).not.toBeNull();
    expect(part('naver')).not.toBeNull();
  });

  it('offers a retry button on network errors', () => {
    renderCard(card, '온보딩', { kind: 'result', result: { status: 'network_error' } }, handlers);

    expect(part('body')?.textContent).toContain('연결에 실패했습니다');
    part('retry')?.click();
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the too-long notice without search buttons', () => {
    renderCard(card, '', { kind: 'too_long' }, handlers);

    expect(part('body')?.textContent).toBe('선택이 너무 깁니다 (50자 이하)');
    expect(part('google')).toBeNull();
    expect(part('naver')).toBeNull();
  });

  it('calls onClose from the close button', () => {
    renderCard(card, '온보딩', { kind: 'loading' }, handlers);

    part('close')?.click();

    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('replaces the previous content on re-render', () => {
    renderCard(card, '온보딩', { kind: 'loading' }, handlers);
    renderCard(card, '온보딩', { kind: 'result', result: { status: 'not_found' } }, handlers);

    expect(card.querySelectorAll('[data-role="body"]')).toHaveLength(1);
  });
});

describe('disambiguation card', () => {
  it('shows the suggestion first and opens it on click', () => {
    renderCard(card, '트리거', disambiguation({ suggestion: DATABASE }), handlers);

    expect(card.textContent).toContain('이 글에서는 아마');
    expect(part('suggestion')?.textContent).toBe('데이터베이스 트리거');
    expect(part('suggestion-extract')?.textContent).toBe('테이블에 행이 추가되면 실행');
    part('suggestion')?.click();
    expect(handlers.onSelectMeaning).toHaveBeenCalledWith('데이터베이스 트리거');
  });

  it('leaves the suggested sense out of the other meanings', () => {
    renderCard(card, '트리거', disambiguation({ suggestion: DATABASE }), handlers);

    const labels = [...card.querySelectorAll('[data-role="meaning"]')].map((b) => b.textContent);
    expect(labels).toEqual(['트리거 (애니메이션 제작사)']);
  });

  it('shows basic meanings and other meanings without a suggestion', () => {
    renderCard(card, '트리거', disambiguation(), handlers);

    expect(card.textContent).not.toContain('이 글에서는 아마');
    expect(card.textContent).toContain('기본 뜻');
    expect(card.textContent).toContain('다른 뜻');
    expect(card.querySelectorAll('[data-role="basic"]')).toHaveLength(1);
    expect(card.querySelectorAll('[data-role="meaning"]')).toHaveLength(2);
    expect(part('meaning-text')?.textContent).toBe('트리거 전략');
    expect(part('wiki-link')).not.toBeNull();
  });

  it('opens a meaning by its article title, not its label', () => {
    const state = disambiguation({
      disambiguation: {
        basic: [],
        meanings: [{ label: '데이터 모델', title: '데이터 모델 (전산)' }],
        candidates: [],
      },
    });
    renderCard(card, '모델', state, handlers);

    part('meaning')?.click();

    expect(part('meaning')?.textContent).toBe('데이터 모델');
    expect(handlers.onSelectMeaning).toHaveBeenCalledWith('데이터 모델 (전산)');
  });

  it('shows at most eight meanings and counts the rest', () => {
    const meanings = Array.from({ length: 10 }, (_, i) => ({ label: `뜻 ${i}`, title: `뜻 ${i}` }));
    renderCard(
      card,
      '모델',
      disambiguation({ disambiguation: { basic: [], meanings, candidates: [] } }),
      handlers,
    );

    expect(card.querySelectorAll('[data-role="meaning"]')).toHaveLength(8);
    expect(part('more-meanings')?.textContent).toBe('외 2개');
  });

  it('shortens labels longer than forty characters', () => {
    const label = '가'.repeat(41);
    renderCard(
      card,
      '모델',
      disambiguation({
        disambiguation: { basic: [], meanings: [{ label, title: null }], candidates: [] },
      }),
      handlers,
    );

    expect(part('meaning-text')?.textContent).toBe(`${'가'.repeat(40)}…`);
  });

  it('never turns meaning text into HTML', () => {
    renderCard(
      card,
      '모델',
      disambiguation({
        disambiguation: {
          basic: ['<img src=x onerror=alert(1)>'],
          meanings: [{ label: '<b>x</b>', title: null }],
          candidates: [],
        },
      }),
      handlers,
    );

    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('b')).toBeNull();
  });

  it('keeps the old notice when the extra information is missing', () => {
    renderCard(card, '트리거', disambiguation({ disambiguation: undefined }), handlers);

    expect(part('body')?.textContent).toContain('뜻이 여러 개인 단어입니다');
  });
});

describe('design details', () => {
  it('shows the "뜻 여러 개" badge only for disambiguation results', () => {
    renderCard(card, '트리거', disambiguation(), handlers);
    expect(part('badge')?.textContent).toBe('뜻 여러 개');

    renderCard(card, '온보딩', { kind: 'loading' }, handlers);
    expect(part('badge')).toBeNull();

    renderCard(
      card,
      'SaaS',
      {
        kind: 'result',
        result: {
          status: 'found',
          title: 'SaaS',
          extract: '설명',
          url: 'https://ko.wikipedia.org/wiki/x',
          isDisambiguation: false,
        },
      },
      handlers,
    );
    expect(part('badge')).toBeNull();
  });

  it('keeps the title text unchanged next to the badge', () => {
    renderCard(card, '트리거', disambiguation(), handlers);

    expect(part('title')?.textContent).toBe('트리거');
  });

  it('puts the suggestion inside its own box', () => {
    renderCard(card, '트리거', disambiguation({ suggestion: DATABASE }), handlers);

    const box = part('suggestion-box');
    expect(box?.textContent).toContain('이 글에서는 아마');
    expect(box?.querySelector('[data-role="suggestion"]')).not.toBeNull();
    expect(box?.querySelector('[data-role="suggestion-extract"]')).not.toBeNull();
  });

  describe('search row', () => {
    const typeInto = (value: string) => {
      const input = part('search-input') as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const enter = (init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        composed: true,
        cancelable: true,
        ...init,
      });
      part('search-input')!.dispatchEvent(event);
      return event;
    };
    const withEngine = (engine: SearchEngine) => {
      handlers = { ...handlers, getSearchEngine: () => engine };
    };

    it('shows search buttons as plain names without logo marks', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);

      expect(part('google')?.textContent).toBe('구글');
      expect(part('naver')?.textContent).toBe('네이버');
      expect(part('google')?.getAttribute('aria-label')).toBe('구글 검색');
      expect(part('naver')?.getAttribute('aria-label')).toBe('네이버 검색');
      expect(part('google')?.getAttribute('title')).toBe('구글 검색');
      expect(part('naver')?.getAttribute('title')).toBe('네이버 검색');
      expect(card.querySelector('.card-action-mark')).toBeNull();
    });

    it('fills the search input with the query', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);

      expect((part('search-input') as HTMLInputElement).value).toBe('온보딩');
      expect(part('search-input')?.getAttribute('aria-label')).toBe('검색어');
    });

    it('updates both links when the search input changes', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      typeInto('챗GPT 뜻');

      expect(part('google')?.getAttribute('href')).toBe(searchUrl('google', '챗GPT 뜻'));
      expect(part('naver')?.getAttribute('href')).toBe(searchUrl('naver', '챗GPT 뜻'));
    });

    it('trims spaces in the search input', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      typeInto('  챗GPT  ');

      expect(part('naver')?.getAttribute('href')).toBe(searchUrl('naver', '챗GPT'));
    });

    it('disables links when the search input is blank', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      typeInto('   ');

      for (const role of ['google', 'naver']) {
        expect(part(role)?.hasAttribute('href')).toBe(false);
        expect(part(role)?.getAttribute('aria-disabled')).toBe('true');
        expect(part(role)?.getAttribute('role')).toBe('link');
      }
      typeInto('a');
      for (const role of ['google', 'naver']) {
        expect(part(role)?.hasAttribute('href')).toBe(true);
        expect(part(role)?.hasAttribute('aria-disabled')).toBe(false);
        expect(part(role)?.hasAttribute('role')).toBe(false);
      }
    });

    it('opens the chosen engine on Enter', () => {
      withEngine('google');
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      const google = vi.spyOn(part('google')!, 'click');
      const naver = vi.spyOn(part('naver')!, 'click');

      const event = enter();

      expect(google).toHaveBeenCalledTimes(1);
      expect(naver).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    });

    it('ignores Enter while composing Korean', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      const naver = vi.spyOn(part('naver')!, 'click');

      enter({ isComposing: true });
      const legacy = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      Object.defineProperty(legacy, 'keyCode', { value: 229 });
      part('search-input')!.dispatchEvent(legacy);

      expect(naver).not.toHaveBeenCalled();
    });

    it('does nothing on Enter when the search input is blank', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      const naver = vi.spyOn(part('naver')!, 'click');
      typeInto('');

      enter();

      expect(naver).not.toHaveBeenCalled();
    });

    it('keeps key events inside the search input', () => {
      document.body.append(card);
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      const listener = vi.fn();
      for (const type of ['keydown', 'keyup', 'keypress']) {
        document.addEventListener(type, listener);
      }

      for (const type of ['keydown', 'keyup', 'keypress']) {
        part('search-input')!.dispatchEvent(
          new KeyboardEvent(type, { key: 'k', bubbles: true, composed: true }),
        );
      }

      for (const type of ['keydown', 'keyup', 'keypress']) {
        document.removeEventListener(type, listener);
      }
      card.remove();
      expect(listener).not.toHaveBeenCalled();
    });

    it('keeps an edited value and caret when the same query is redrawn', () => {
      document.body.append(card);
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      const oldInput = part('search-input') as HTMLInputElement;
      typeInto('온보딩 뜻');
      oldInput.focus();
      oldInput.setSelectionRange(2, 2);

      renderCard(card, '온보딩', { kind: 'result', result: { status: 'not_found' } }, handlers);

      const input = part('search-input') as HTMLInputElement;
      expect(input).toBe(oldInput);
      expect(input.value).toBe('온보딩 뜻');
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(2);
      expect(part('naver')?.getAttribute('href')).toBe(searchUrl('naver', '온보딩 뜻'));
      card.remove();
    });

    it('turns off spellcheck and autocomplete on the search input', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);

      const input = part('search-input')!;
      expect(input.getAttribute('spellcheck')).toBe('false');
      expect(input.getAttribute('autocomplete')).toBe('off');
      expect(input.getAttribute('enterkeyhint')).toBe('search');
    });

    it('resets the search input when the query changes', () => {
      renderCard(card, '트리거', { kind: 'loading' }, handlers);
      typeInto('트리거 뜻');

      renderCard(card, '데이터베이스 트리거', { kind: 'loading' }, handlers);

      expect((part('search-input') as HTMLInputElement).value).toBe('데이터베이스 트리거');
    });

    it('does not focus the search input on first render', () => {
      document.body.append(card);
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);

      expect(document.activeElement).not.toBe(part('search-input'));
      card.remove();
    });
  });

  describe('Wikipedia attribution', () => {
    const attributionTextOf = () => part('attribution')?.textContent;

    it('shows the source line with a license link for a normal article', () => {
      renderCard(
        card,
        'SaaS',
        {
          kind: 'result',
          result: { status: 'found', title: 'SaaS', extract: '설명', url, isDisambiguation: false },
        },
        handlers,
      );

      expect(attributionTextOf()).toBe('출처: 위키백과 (CC BY-SA 4.0)');
      const license = part('attribution')?.querySelector('a');
      expect(license?.textContent).toBe('CC BY-SA 4.0');
      expect(license?.getAttribute('href')).toBe(
        'https://creativecommons.org/licenses/by-sa/4.0/deed.ko',
      );
      expect(license?.getAttribute('target')).toBe('_blank');
      expect(license?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('shows the source line on disambiguation results', () => {
      renderCard(card, '트리거', disambiguation(), handlers);

      expect(attributionTextOf()).toBe('출처: 위키백과 (CC BY-SA 4.0)');
    });

    it('shows the source line on the notice without extra information', () => {
      renderCard(card, '트리거', disambiguation({ disambiguation: undefined }), handlers);

      expect(attributionTextOf()).toBe('출처: 위키백과 (CC BY-SA 4.0)');
    });

    it('is absent when nothing from Wikipedia is shown', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      expect(part('attribution')).toBeNull();

      renderCard(card, 'x', { kind: 'result', result: { status: 'not_found' } }, handlers);
      expect(part('attribution')).toBeNull();

      renderCard(card, 'x', { kind: 'result', result: { status: 'rate_limited' } }, handlers);
      expect(part('attribution')).toBeNull();

      renderCard(card, 'x', { kind: 'result', result: { status: 'network_error' } }, handlers);
      expect(part('attribution')).toBeNull();

      renderCard(card, 'x', { kind: 'too_long' }, handlers);
      expect(part('attribution')).toBeNull();
    });
  });
});
