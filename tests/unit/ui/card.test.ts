import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderCard, type CardHandlers, type CardState } from '../../../lib/ui/card';
import type { FoundResult } from '../../../lib/lookup/types';
import { searchUrl } from '../../../lib/search-urls';

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
    onLookup: vi.fn(),
  };
});

describe('renderCard', () => {
  it('does not show an unrelated Naver link beside a Wikipedia meaning list', () => {
    const state = disambiguation({
      alternatives: [
        {
          source: 'naver',
          title: 'POC',
          extract: '여행지에서 필요한 의료 서비스',
          url: 'https://terms.naver.com/entry.naver?docId=1',
          isDisambiguation: false,
        },
      ],
    });

    renderCard(card, 'POC', state, handlers);

    expect(part('meanings')).not.toBeNull();
    expect(part('alternative-link')).toBeNull();
  });
  it('shows Wikidata as the source for a fallback definition', () => {
    renderCard(
      card,
      '모노레포',
      {
        kind: 'result',
        result: {
          status: 'found',
          source: 'wikidata',
          title: '모노리포',
          extract: '여러 프로젝트를 하나의 저장소에서 관리하는 방식',
          url: 'https://www.wikidata.org/wiki/Q1',
          isDisambiguation: false,
        },
      },
      handlers,
    );

    expect(part('extract')?.textContent).toContain('여러 프로젝트');
    expect(part('source-link')?.textContent).toContain('위키데이터');
    expect(part('attribution')?.textContent).toContain('CC0');
  });
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
    expect(part('source-link')?.textContent).toBe('네이버 백과 ↗');
    expect(part('source-link')?.getAttribute('href')).toBe(
      'https://terms.naver.com/entry.naver?docId=123',
    );
    expect(part('attribution')?.textContent).toContain('네이버 백과');
    expect(part('license-link')).toBeNull();
  });

  it('does not make an unexpected Naver host clickable as an original source', () => {
    renderCard(
      card,
      '온보딩',
      {
        kind: 'result',
        result: {
          status: 'found',
          source: 'naver',
          title: '온보딩',
          extract: '설명',
          url: 'https://terms.naver.com.attacker.test/entry.naver?docId=1',
          isDisambiguation: false,
        },
      },
      handlers,
    );

    expect(part('source-links')?.querySelectorAll('a')).toHaveLength(0);
  });

  it('does not make a script URL clickable as a Wikipedia source', () => {
    renderCard(
      card,
      '온보딩',
      {
        kind: 'result',
        result: {
          status: 'found',
          source: 'wikipedia',
          title: '온보딩',
          extract: '설명',
          url: 'javascript:alert(1)',
          isDisambiguation: false,
        },
      },
      handlers,
    );

    expect(part('source-links')?.querySelectorAll('a')).toHaveLength(0);
  });

  it('omits a related result link outside the source host', () => {
    renderCard(
      card,
      '온보딩',
      {
        kind: 'result',
        result: {
          status: 'not_found',
          related: {
            source: 'naver',
            title: '온보딩',
            extract: '설명',
            url: 'https://attacker.test/entry.naver?docId=1',
            isDisambiguation: false,
          },
        },
      },
      handlers,
    );

    expect(part('related-link')).toBeNull();
  });

  it('groups the Naver original and Wikipedia alternative into one compact source row', () => {
    renderCard(
      card,
      '인공지능',
      {
        kind: 'result',
        result: {
          status: 'found',
          source: 'naver',
          title: '인공지능',
          extract: '학습과 추론을 하는 기술',
          url: 'https://terms.naver.com/entry.naver?docId=1',
          isDisambiguation: false,
          alternatives: [
            {
              source: 'wikipedia',
              title: '인공지능',
              extract: '인공 지능에 관한 설명',
              url: 'https://ko.wikipedia.org/wiki/인공지능',
              isDisambiguation: false,
            },
          ],
        },
      },
      handlers,
    );

    const links = [...(part('source-links')?.querySelectorAll('a') ?? [])];
    expect(part('source-links')?.textContent).toContain('원문');
    expect(links.map((link) => link.textContent)).toEqual(['네이버 백과 ↗', '위키백과 ↗']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://terms.naver.com/entry.naver?docId=1',
      'https://ko.wikipedia.org/wiki/%EC%9D%B8%EA%B3%B5%EC%A7%80%EB%8A%A5',
    ]);
    expect(links.every((link) => link.target === '_blank')).toBe(true);
  });

  it('shows only one original link for a single-source result', () => {
    renderCard(
      card,
      '온보딩',
      {
        kind: 'result',
        result: {
          status: 'found',
          source: 'wikipedia',
          title: '온보딩',
          extract: '신입 직원의 적응 과정',
          url: 'https://ko.wikipedia.org/wiki/온보딩',
          isDisambiguation: false,
        },
      },
      handlers,
    );

    expect(part('source-links')?.querySelectorAll('a')).toHaveLength(1);
    expect(part('source-links')?.textContent).toContain('위키백과 ↗');
  });
  it('shows three decorative loading dots and an accessible status', () => {
    renderCard(card, '온보딩', { kind: 'loading' }, handlers);

    expect(part('title')?.textContent).toBe('온보딩');
    expect(part('body')?.textContent).toBe('뜻을 찾고 있어요');
    expect(part('loading')?.getAttribute('role')).toBe('status');
    expect(part('loading-dots')?.getAttribute('aria-hidden')).toBe('true');
    expect(part('loading-dots')?.children).toHaveLength(3);
    expect(part('google')?.getAttribute('href')).toBe(
      'https://www.google.com/search?q=%EC%98%A8%EB%B3%B4%EB%94%A9',
    );
    expect(part('naver')?.getAttribute('href')).toBe(
      'https://search.naver.com/search.naver?query=%EC%98%A8%EB%B3%B4%EB%94%A9',
    );
  });

  it('shows a back button and the detail title when viewing a meaning', () => {
    const onBackToMeanings = vi.fn();
    const detailHandlers = { ...handlers, onBackToMeanings };
    renderCard(
      card,
      '데이터베이스 트리거',
      {
        kind: 'result',
        result: {
          status: 'found',
          source: 'wikipedia',
          title: '데이터베이스 트리거',
          extract: '테이블 변경 시 실행되는 절차',
          url: 'https://ko.wikipedia.org/wiki/데이터베이스_트리거',
          isDisambiguation: false,
        },
      },
      detailHandlers,
    );

    expect(part('back-to-meanings')?.textContent).toBe('← 뜻 목록');
    expect(part('title')?.textContent).toBe('데이터베이스 트리거');
    expect(part('title')?.closest('.card-body')).not.toBeNull();
    part('back-to-meanings')?.click();
    expect(onBackToMeanings).toHaveBeenCalledTimes(1);
  });

  it('keeps the back button available while a meaning is loading', () => {
    renderCard(
      card,
      '데이터베이스 트리거',
      { kind: 'loading' },
      {
        ...handlers,
        onBackToMeanings: vi.fn(),
      },
    );

    expect(part('back-to-meanings')?.textContent).toBe('← 뜻 목록');
    expect(part('body')?.textContent).toContain('뜻을 찾고 있어요');
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
    expect(part('wiki-link')?.textContent).toBe('위키백과 ↗');
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
  it('links same-name Wikidata meanings to their separate original pages', () => {
    renderCard(
      card,
      'POC',
      disambiguation({
        source: 'wikidata',
        url: 'https://www.wikidata.org/w/index.php?search=POC',
        disambiguation: {
          basic: [],
          meanings: [
            {
              label: 'POC',
              description: '개념 증명',
              title: null,
              sourceUrl: 'https://www.wikidata.org/wiki/Q101',
            },
            {
              label: 'POC',
              description: '다른 분야의 약어',
              title: null,
              sourceUrl: 'https://www.wikidata.org/wiki/Q202',
            },
          ],
          candidates: [],
        },
      }),
      handlers,
    );

    const links = [
      ...card.querySelectorAll<HTMLAnchorElement>('[data-role="meaning-source-link"]'),
    ];
    expect(links.map((link) => link.href)).toEqual([
      'https://www.wikidata.org/wiki/Q101',
      'https://www.wikidata.org/wiki/Q202',
    ]);
    expect(links.map((link) => link.closest('li')?.textContent)).toEqual([
      'POC개념 증명원문 보기 →',
      'POC다른 분야의 약어원문 보기 →',
    ]);
    expect(
      links.every((link) => link.target === '_blank' && link.rel === 'noopener noreferrer'),
    ).toBe(true);
    expect(handlers.onSelectMeaning).not.toHaveBeenCalled();
  });

  it('links a suggested same-name Wikidata meaning to its own source without repeating it', () => {
    renderCard(
      card,
      'POC',
      disambiguation({
        source: 'wikidata',
        suggestion: {
          title: 'POC',
          extract: '개념 증명',
          url: 'https://www.wikidata.org/wiki/Q101',
        },
        disambiguation: {
          basic: [],
          meanings: [
            {
              label: 'POC',
              description: '개념 증명',
              title: null,
              sourceUrl: 'https://www.wikidata.org/wiki/Q101',
            },
            {
              label: 'POC',
              description: '다른 분야의 약어',
              title: null,
              sourceUrl: 'https://www.wikidata.org/wiki/Q202',
            },
          ],
          candidates: [],
        },
      }),
      handlers,
    );

    expect(part('suggestion')?.tagName).toBe('A');
    expect(part('suggestion')?.getAttribute('href')).toBe('https://www.wikidata.org/wiki/Q101');
    expect(part('suggestion')?.getAttribute('target')).toBe('_blank');
    expect(part('meaning-source-link')?.getAttribute('href')).toBe(
      'https://www.wikidata.org/wiki/Q202',
    );
    expect(card.querySelectorAll('[data-role="meaning-source-link"]')).toHaveLength(1);
    part('suggestion')?.click();
    expect(handlers.onSelectMeaning).not.toHaveBeenCalled();
  });

  it('does not turn an untrusted meaning URL into a link', () => {
    renderCard(
      card,
      'POC',
      disambiguation({
        disambiguation: {
          basic: [],
          meanings: [
            {
              label: 'POC',
              description: '개념 증명',
              title: null,
              sourceUrl: 'https://example.test/wiki/Q101',
            },
          ],
          candidates: [],
        },
      }),
      handlers,
    );

    expect(part('meaning-source-link')).toBeNull();
    expect(part('meaning-text')?.textContent).toContain('개념 증명');
  });

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

    const labels = [...card.querySelectorAll('[data-role="meaning"]')].map(
      (b) => b.querySelector('.card-meaning-label')?.textContent,
    );
    expect(labels).toEqual(['트리거 (애니메이션 제작사)']);
  });

  it('shows basic meanings and other meanings without a suggestion', () => {
    renderCard(card, '트리거', disambiguation(), handlers);

    expect(card.textContent).not.toContain('이 글에서는 아마');
    expect(card.textContent).toContain('기본 뜻');
    expect(card.textContent).toContain('다른 뜻');
    expect(card.querySelectorAll('[data-role="basic"]')).toHaveLength(1);
    expect(card.querySelectorAll('[data-role="meaning"]')).toHaveLength(2);
    expect(part('meaning-text')?.querySelector('.card-meaning-label')?.textContent).toBe(
      '트리거 전략',
    );
    expect(part('wiki-link')).not.toBeNull();
  });

  it('shows explanations that distinguish identical meaning labels', () => {
    const state = disambiguation();
    if (state.kind !== 'result' || state.result.status !== 'found') throw new Error('bad fixture');
    state.result.disambiguation = {
      basic: [],
      meanings: [
        { label: '태스크', description: '컴퓨팅에서의 명령 실행 문맥', title: '태스크' },
        { label: '태스크', description: '미국 드라마', title: '태스크 (드라마)' },
      ],
      candidates: [],
    };

    renderCard(card, 'Task', state, handlers);

    expect(card.querySelectorAll('[data-role="meaning"]')).toHaveLength(2);
    expect(card.querySelectorAll('[data-role="meaning-description"]')[0]?.textContent).toBe(
      '컴퓨팅에서의 명령 실행 문맥',
    );
    expect(card.querySelectorAll('[data-role="meaning-description"]')[1]?.textContent).toBe(
      '미국 드라마',
    );
  });

  it('keeps the actual source link and excerpt attribution after the meanings', () => {
    renderCard(card, '트리거', disambiguation(), handlers);

    const meanings = part('meanings');
    const source = part('wiki-link');
    const attribution = part('attribution');
    expect(meanings?.closest('.card-body')?.nextElementSibling).toBe(
      source?.parentElement?.parentElement,
    );
    expect(source?.parentElement?.nextElementSibling).toBe(attribution);
    expect(attribution?.textContent).toContain('위키백과 설명 일부');
    expect(part('license-link')?.textContent).toBe('CC BY-SA 4.0');
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

    expect(part('meaning')?.querySelector('.card-meaning-label')?.textContent).toBe('데이터 모델');
    expect(handlers.onSelectMeaning).toHaveBeenCalledWith('데이터 모델 (전산)');
  });

  it('shows every meaning without a more button', () => {
    const meanings = Array.from({ length: 10 }, (_, i) => ({ label: `뜻 ${i}`, title: `뜻 ${i}` }));
    renderCard(
      card,
      '모델',
      disambiguation({ disambiguation: { basic: [], meanings, candidates: [] } }),
      handlers,
    );

    expect(card.querySelectorAll('[data-role="meaning"]')).toHaveLength(10);
    expect(part('more-meanings')).toBeNull();
    expect(part('meanings')?.textContent).toContain('뜻 9');
  });

  it('opens a meaning when its description row is clicked', () => {
    renderCard(
      card,
      '모델',
      disambiguation({
        disambiguation: {
          basic: [],
          meanings: [
            {
              label: '데이터 모델',
              description: '데이터 구조를 설명',
              title: '데이터 모델 (전산)',
            },
          ],
          candidates: [],
        },
      }),
      handlers,
    );

    part('meaning-description')?.click();
    expect(handlers.onSelectMeaning).toHaveBeenCalledWith('데이터 모델 (전산)');
  });

  it('uses a Korean placeholder when a meaning has no description', () => {
    renderCard(card, '트리거', disambiguation(), handlers);

    const descriptions = card.querySelectorAll('[data-role="meaning-description"]');
    expect(descriptions).toHaveLength(3);
    expect(descriptions[0]?.textContent).toBe('간단한 설명이 없습니다.');
    expect(part('meaning-text')?.closest('button')).toBeNull();
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

    expect(part('meaning-text')?.querySelector('.card-meaning-label')?.textContent).toBe(
      `${'가'.repeat(40)}…`,
    );
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
    it('shows a compact lookup button beside the input and text-only external links', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);

      expect(part('lookup-action')?.textContent).toBe('뜻 찾기');
      expect(part('lookup-action')?.parentElement).toBe(part('search-input')?.parentElement);
      expect(part('google')?.textContent).toBe('구글에서 찾기 ↗');
      expect(part('naver')?.textContent).toBe('네이버에서 찾기 ↗');
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

    it('Enter와 버튼은 공백을 제거한 검색어를 카드에서 조회한다', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      part('manual-tab')!.click();
      typeInto('  데이터베이스  ');
      const google = vi.spyOn(part('google')!, 'click');
      expect(enter().defaultPrevented).toBe(true);
      expect(handlers.onLookup).toHaveBeenCalledWith('데이터베이스');
      expect(part('result-panel')!.hidden).toBe(false);
      expect(google).not.toHaveBeenCalled();
      part('manual-tab')!.click();
      part('lookup-action')!.click();
      expect(handlers.onLookup).toHaveBeenCalledTimes(2);
    });

    it('탭 전환은 입력과 뜻 보기 본문 스크롤을 보존하고 입력에 자동 포커스하지 않는다', () => {
      document.body.append(card);
      renderCard(card, '트리거', disambiguation(), handlers);
      const body = part('body')!;
      body.scrollTop = 80;
      expect(part('manual-panel')!.hidden).toBe(true);
      part('manual-tab')!.click();
      const input = part('search-input') as HTMLInputElement;
      expect(document.activeElement).not.toBe(input);
      typeInto('검색 엔진');
      input.setSelectionRange(2, 2);
      part('result-tab')!.click();
      part('manual-tab')!.click();
      expect(part('result-panel')!.hidden).toBe(true);
      expect(input.value).toBe('검색 엔진');
      expect(input.selectionStart).toBe(2);
      expect(body.scrollTop).toBe(80);
      card.remove();
    });

    it('방향키와 Home End로 탭을 이동하고 선택된 탭만 Tab 순서에 둔다', () => {
      document.body.append(card);
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      const result = part('result-tab')!;
      const manual = part('manual-tab')!;
      expect(result.tabIndex).toBe(0);
      expect(manual.tabIndex).toBe(-1);
      for (const [from, key, to] of [
        [result, 'ArrowRight', manual],
        [manual, 'Home', result],
        [result, 'End', manual],
        [manual, 'ArrowLeft', result],
      ] as const) {
        from.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        expect(document.activeElement).toBe(to);
        expect(to.getAttribute('aria-selected')).toBe('true');
        expect(to.tabIndex).toBe(0);
        expect(from.tabIndex).toBe(-1);
      }
      card.remove();
    });

    it('직접 조회로 검색어가 바뀌고 결과가 갱신되어도 뜻 보기 탭에 포커스를 둔다', () => {
      document.body.append(card);
      handlers.onLookup = (query) => renderCard(card, query, { kind: 'loading' }, handlers);
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      part('manual-tab')!.click();
      typeInto('데이터베이스');
      part('search-input')!.focus();
      enter();
      expect(document.activeElement).toBe(part('result-tab'));
      renderCard(
        card,
        '데이터베이스',
        { kind: 'result', result: { status: 'not_found' } },
        handlers,
      );
      expect(document.activeElement).toBe(part('result-tab'));
      card.remove();
    });

    it('Shadow DOM 안에서도 직접 조회 뒤 결과 탭의 포커스를 유지한다', () => {
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.append(card);
      document.body.append(host);
      handlers.onLookup = (query) => renderCard(card, query, { kind: 'loading' }, handlers);
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      part('manual-tab')!.click();
      typeInto('데이터베이스');
      part('search-input')!.focus();

      enter();

      expect(shadow.activeElement).toBe(part('result-tab'));
      host.remove();
    });

    it('빈 값과 51자는 오류를 표시하고 50자 유니코드 검색어는 조회한다', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      part('manual-tab')!.click();
      for (const value of ['', '가'.repeat(51)]) {
        typeInto(value);
        enter();
        expect(part('search-error')!.textContent).not.toBe('');
        expect(part('manual-panel')!.hidden).toBe(false);
      }
      expect(handlers.onLookup).not.toHaveBeenCalled();
      typeInto('😀'.repeat(50));
      enter();
      expect(handlers.onLookup).toHaveBeenCalledWith('😀'.repeat(50));
    });

    it('ignores Enter while composing Korean', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      const naver = vi.spyOn(part('naver')!, 'click');

      enter({ isComposing: true });
      const legacy = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      Object.defineProperty(legacy, 'keyCode', { value: 229 });
      part('search-input')!.dispatchEvent(legacy);

      expect(naver).not.toHaveBeenCalled();
      expect(handlers.onLookup).not.toHaveBeenCalled();
    });

    it('does nothing on Enter when the search input is blank', () => {
      renderCard(card, '온보딩', { kind: 'loading' }, handlers);
      const naver = vi.spyOn(part('naver')!, 'click');
      typeInto('');

      enter();

      expect(naver).not.toHaveBeenCalled();
      expect(handlers.onLookup).not.toHaveBeenCalled();
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

      expect(attributionTextOf()).toBe('출처: 위키백과 설명 일부 (CC BY-SA 4.0)');
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

      expect(attributionTextOf()).toBe('출처: 위키백과 설명 일부 (CC BY-SA 4.0)');
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

describe('source alternatives', () => {
  it('omits an unverified alternative beside a disambiguation result', () => {
    renderCard(
      card,
      'RAG',
      disambiguation({
        alternatives: [
          {
            source: 'naver',
            title: 'RAG',
            extract: '독일 석탄 기업',
            url: 'https://terms.naver.com/entry.naver?docId=1',
            isDisambiguation: false,
          },
        ],
      }),
      handlers,
    );
    expect(part('alternative-link')).toBeNull();
    expect(part('body')?.textContent).not.toContain('독일 석탄 기업');
  });
});
