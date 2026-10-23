import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderCard, type CardHandlers } from '../../../lib/ui/card';

let card: HTMLElement;
let handlers: CardHandlers;

const part = (role: string) => card.querySelector<HTMLElement>(`[data-role="${role}"]`);

beforeEach(() => {
  card = document.createElement('section');
  handlers = { onClose: vi.fn(), onRetry: vi.fn() };
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
