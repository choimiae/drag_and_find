import { describe, it, expect } from 'vitest';
import { parseDisambiguationHtml, type ParsedLink } from '../../../lib/lookup/disambiguation';
import { parseHtml, parseLinks } from '../fixtures/disambiguation/load';

describe('parseDisambiguationHtml', () => {
  const parse = (html: string, links: ParsedLink[] = []) => parseDisambiguationHtml(html, links);
  const fixture = (word: string) => parseDisambiguationHtml(parseHtml(word), parseLinks(word));

  it('links every sentence-form item of 마진 to its first article link', () => {
    const { basic, meanings } = fixture('마진');

    expect(meanings.map((m) => m.title)).toEqual([
      '태봉',
      '홍역',
      '한계',
      '중간 이윤',
      '여백',
      null,
    ]);
    expect(meanings[0]?.label.startsWith('마진(摩震)은')).toBe(true);
    expect(basic).toEqual([]);
  });

  it('leaves an item alone when its first link is a missing page (플랫폼)', () => {
    const { meanings } = fixture('플랫폼');

    expect(meanings.find((m) => m.label.startsWith('플랫폼 (소설)'))?.title).toBeNull();
    expect(meanings.find((m) => m.label.startsWith('승강장은'))?.title).toBe('승강장');
  });

  it('keeps the basic section as text and stops at see-also (트리거)', () => {
    const { basic, meanings } = fixture('트리거');

    expect(basic).toHaveLength(2);
    expect(basic[0]).toContain('총의 방아쇠');
    expect(meanings.find((m) => m.label.startsWith('〈Trigger (EP)〉'))?.title).toBe(
      'Trigger (EP)',
    );
    expect(meanings.find((m) => m.label.includes('네이버웹툰'))?.title).toBeNull();
    for (const text of ['방아쇠 (동음이의)', '모든 문서', '동음이의어 문서']) {
      expect(meanings.some((m) => m.label.includes(text))).toBe(false);
    }
  });

  it('flattens nested sub-items without mixing them into the parent (포트)', () => {
    const { meanings } = fixture('포트');
    const startingWith = (prefix: string) => meanings.filter((m) => m.label.startsWith(prefix));

    expect(startingWith('마이크로컨트롤러 포트')).toHaveLength(1);
    expect(startingWith('마이크로컨트롤러 포트')[0]?.title).toBe('마이크로컨트롤러 포트');
    expect(startingWith('컴퓨터 하드웨어 포트')).toHaveLength(1);
    expect(startingWith('컴퓨터 하드웨어 포트')[0]?.title).toBe('컴퓨터 하드웨어 포트');
    expect(startingWith('포트(port)는')[0]?.title).toBe('항구');
  });

  it('recognises the basic section even when the heading holds an empty span (모델)', () => {
    const { basic, meanings } = fixture('모델');

    expect(basic).toHaveLength(2);
    expect(basic[1]?.startsWith('모형화')).toBe(true);
    expect(meanings.find((m) => m.label.startsWith('비즈니스 모델'))?.title).toBe('비즈니스 모델');
  });

  it.each(['버블', '커널', '터미널', '스레드', '원'])(
    'resolves only existing article links (%s)',
    (word) => {
      const links = parseLinks(word);
      const { meanings } = parseDisambiguationHtml(parseHtml(word), links);
      const titled = meanings.flatMap((m) => (m.title === null ? [] : [m.title]));

      expect(titled.length).toBeGreaterThan(0);
      for (const title of titled) {
        expect(links.some((l) => l.title === title && l.ns === 0 && l.exists)).toBe(true);
      }
    },
  );

  it('does not mistake <link> tags for list items', () => {
    const html =
      '<link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1"><ul><li><a href="/wiki/A">A</a>: 설명</li></ul>';

    expect(parse(html, [{ ns: 0, title: 'A', exists: true }]).meanings).toEqual([
      { label: 'A', title: 'A' },
    ]);
  });

  it('drops style content inside an item', () => {
    const html = '<ul><li><style>.x{color:red}</style><a href="/wiki/A">A</a>: 설명</li></ul>';

    expect(parse(html).meanings[0]?.label).toBe('A');
  });

  it('ignores list items inside tables', () => {
    const html =
      '<ul><li><a href="/wiki/A">A</a></li></ul><table><tr><td><ul><li>표 안</li></ul></td></tr></table>';

    expect(parse(html).meanings).toHaveLength(1);
  });

  it('decodes entities in item text', () => {
    expect(parse('<ul><li>A &amp; B&#160;C</li></ul>').meanings[0]?.label).toBe('A & B C');
  });

  it('skips non-article links and uses the first article link', () => {
    const html =
      '<ul><li><a href="/wiki/%ED%8C%8C%EC%9D%BC:X.svg">i</a><a href="/wiki/A">A</a></li></ul>';
    const links = [
      { ns: 6, title: '파일:X.svg', exists: true },
      { ns: 0, title: 'A', exists: true },
    ];

    expect(parse(html, links).meanings[0]?.title).toBe('A');
  });

  it('skips footnote and external links', () => {
    const html =
      '<ul><li><a href="#cite_note-1">[1]</a><a href="https://example.com/">x</a><a href="/wiki/A">A</a></li></ul>';

    expect(parse(html, [{ ns: 0, title: 'A', exists: true }]).meanings[0]?.title).toBe('A');
  });

  it('stops at a missing first link instead of moving to later links', () => {
    const html =
      '<ul><li><a href="/w/index.php?title=A&amp;action=edit&amp;redlink=1" class="new">A</a>은 <a href="/wiki/B">B</a>의 소설</li></ul>';
    const links = [
      { ns: 0, title: 'A', exists: false },
      { ns: 0, title: 'B', exists: true },
    ];

    expect(parse(html, links).meanings[0]?.title).toBeNull();
  });

  it('ignores links missing from the link list', () => {
    const html = '<ul><li><a href="/wiki/Z">Z</a> <a href="/wiki/A">A</a></li></ul>';

    expect(parse(html, [{ ns: 0, title: 'A', exists: true }]).meanings[0]?.title).toBe('A');
  });

  it('uses only the first section whose name contains 기본', () => {
    const html =
      '<h2><span id="x"></span>기본 용어</h2><ul><li>첫 뜻</li></ul><h2>기본 아님</h2><ul><li>둘째 줄</li></ul>';

    expect(parse(html)).toEqual({
      basic: ['첫 뜻'],
      meanings: [{ label: '둘째 줄', title: null }],
    });
  });

  it('an h3 after the basic section ends it', () => {
    const html =
      '<div class="mw-heading"><h2 id="a">기본 의미</h2></div><ul><li>a</li></ul><div class="mw-heading"><h3 id="b">소제목</h3></div><ul><li>b</li></ul>';
    const result = parse(html);

    expect(result.basic).toEqual(['a']);
    expect(result.meanings[0]?.label).toBe('b');
  });

  it('stops at see-also', () => {
    const html = '<ul><li>a</li></ul><h2>같이 보기</h2><ul><li>b</li></ul>';

    expect(parse(html).meanings).toHaveLength(1);
  });

  describe('footnotes', () => {
    const LINKS = [
      { ns: 0, title: 'A', exists: true },
      { ns: 0, title: 'B', exists: true },
    ];
    const headingThenList = (heading: string) =>
      `<ul><li><a href="/wiki/A">A</a></li></ul><div class="mw-heading mw-heading2"><h2 id="x">${heading}</h2></div><ul><li><a href="/wiki/B">B</a></li></ul><div class="mw-heading mw-heading2"><h2 id="같이_보기">같이 보기</h2></div>`;

    it('stops at a footnote heading before see-also', () => {
      const { meanings } = parse(headingThenList('각주'), LINKS);

      expect(meanings).toHaveLength(1);
      expect(meanings[0]?.title).toBe('A');
    });

    it.each(['출처', '참고 문헌', '외부 링크'])('stops at the %s heading', (heading) => {
      expect(parse(headingThenList(heading), LINKS).meanings).toHaveLength(1);
    });

    it('skips a references list that has no heading', () => {
      const html =
        '<ul><li><a href="/wiki/A">A</a></li></ul><div class="mw-references-wrap"><ol class="references"><li><a href="/wiki/B">B</a></li></ol></div>';
      const { meanings } = parse(html, LINKS);

      expect(meanings).toHaveLength(1);
      expect(meanings[0]?.title).toBe('A');
    });

    it('keeps reading after heading wrapper divs', () => {
      const html =
        '<div class="mw-heading mw-heading2"><h2 id="a">가</h2></div><ul><li>a</li></ul><div class="mw-heading mw-heading2"><h2 id="b">나</h2></div><ul><li>b</li></ul>';

      expect(parse(html).meanings).toHaveLength(2);
    });

    it('drops footnote markers from item text', () => {
      const html =
        '<ul><li><a href="/wiki/A">A (서울특별시)</a><sup id="cite_ref-1" class="reference"><a href="#cite_note-1">&#91;1&#93;</a></sup>: 설명</li></ul>';

      expect(parse(html, LINKS).meanings[0]?.label).toBe('A (서울특별시)');
    });

    it('ignores footnote lists and markers on a real page (원)', () => {
      const { meanings } = fixture('원');

      expect(meanings.length).toBeGreaterThan(0);
      for (const meaning of meanings) {
        expect(meaning.label).not.toContain('↑');
        expect(meaning.label).not.toMatch(/\[\d+\]/u);
        expect(meaning.title).not.toBe('국가디지털콘텐츠식별체계');
      }
    });
  });

  it('drops empty items', () => {
    expect(parse('<ul><li></li><li>  </li><li>a</li></ul>').meanings).toHaveLength(1);
  });

  it('handles empty html', () => {
    expect(parseDisambiguationHtml('', [])).toEqual({ basic: [], meanings: [] });
  });
});
