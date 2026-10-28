import { describe, it, expect } from 'vitest';
import { decodeEntities, stripTags, wikiTitleFromHref } from '../../../lib/lookup/html-text';

describe('decodeEntities', () => {
  it('decodes named and numeric quote-like entities', () => {
    expect(decodeEntities('A &amp; B &lt;C&gt; &quot;D&quot; &#39;E&#39; &apos;F&apos;')).toBe(
      "A & B <C> \"D\" 'E' 'F'",
    );
  });

  it('keeps a no-break space as U+00A0', () => {
    expect(decodeEntities('생산&#160;·&#32;소비')).toBe('생산 · 소비');
  });

  it('decodes hex entities and nbsp', () => {
    expect(decodeEntities('&#x41;&nbsp;B')).toBe('A B');
  });

  it('leaves unknown entities as they are', () => {
    expect(decodeEntities('&foo;')).toBe('&foo;');
  });

  it('leaves names that exist on Object.prototype as they are', () => {
    expect(decodeEntities('&constructor;')).toBe('&constructor;');
  });

  it('leaves out-of-range numeric entities as they are', () => {
    expect(decodeEntities('&#x110000;')).toBe('&#x110000;');
  });
});

describe('stripTags', () => {
  it('removes tags and keeps text', () => {
    expect(
      stripTags(
        '<b>트리거</b>(Trigger)는 총의 <a href="/wiki/x" title="방아쇠">방아쇠</a>를 뜻한다.',
      ),
    ).toBe('트리거(Trigger)는 총의 방아쇠를 뜻한다.');
  });

  it('collapses whitespace and trims', () => {
    expect(stripTags('  A\n  B  ')).toBe('A B');
  });

  it('treats a no-break space as whitespace', () => {
    expect(stripTags('A&nbsp;&#160;B')).toBe('A B');
  });

  it('drops style and script contents', () => {
    expect(stripTags('<style>.x{color:red}</style>A<script>1</script>B')).toBe('AB');
  });

  it('decodes entities', () => {
    expect(stripTags('A &amp; B')).toBe('A & B');
  });

  it('returns empty string for empty input', () => {
    expect(stripTags('')).toBe('');
  });
});

describe('wikiTitleFromHref', () => {
  it.each([
    ['/wiki/%ED%83%9C%EB%B4%89', '태봉'],
    ['/wiki/Trigger_(EP)', 'Trigger (EP)'],
    [
      '/wiki/%ED%8A%B8%EB%A6%AC%EA%B1%B0_(%EB%94%94%EC%A6%88%EB%8B%88%2B_%EB%93%9C%EB%9D%BC%EB%A7%88)',
      '트리거 (디즈니+ 드라마)',
    ],
    ['/wiki/A#B', 'A'],
    [
      '/w/index.php?title=%EB%A7%88%EC%A7%84_(1867%EB%85%84)&amp;action=edit&amp;redlink=1',
      '마진 (1867년)',
    ],
  ])('returns the title for %s', (href, expected) => {
    expect(wikiTitleFromHref(href)).toBe(expected);
  });

  it.each([
    '#cite_note-1',
    'https://ko.wiktionary.org/wiki/%EB%A7%88%EC%A7%84',
    '/w/index.php?title=A&action=history',
    '/wiki/',
    '/wiki/%E0%A4%A',
    'http://[redlink=1',
  ])('returns null for %s', (href) => {
    expect(wikiTitleFromHref(href)).toBeNull();
  });
});
