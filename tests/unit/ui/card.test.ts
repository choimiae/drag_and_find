import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderCard, type CardHandlers, type CardState } from '../../../lib/ui/card';
import type { FoundResult } from '../../../lib/lookup/types';

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
  handlers = { onClose: vi.fn(), onRetry: vi.fn(), onSelectMeaning: vi.fn() };
});

describe('renderCard', () => {
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
    ['not_found', '위키백과에 문서가 없습니다'],
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

  it('marks search links with G and N but keeps readable names', () => {
    renderCard(card, '온보딩', { kind: 'loading' }, handlers);

    expect(part('google')?.querySelector('.card-action-mark')?.textContent).toBe('G');
    expect(part('naver')?.querySelector('.card-action-mark')?.textContent).toBe('N');
    expect(part('google')?.getAttribute('aria-label')).toBe('구글 검색');
    expect(part('naver')?.getAttribute('aria-label')).toBe('네이버 검색');
  });
});
