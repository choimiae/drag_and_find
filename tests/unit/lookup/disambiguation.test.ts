import { describe, it, expect } from 'vitest';
import {
  buildMeanings,
  parseDisambiguationHtml,
  parseDisambiguationText,
  type ParsedLink,
} from '../../../lib/lookup/disambiguation';
import { linkedResponse, pageText, parseHtml, parseLinks } from '../fixtures/disambiguation/load';

describe('parseDisambiguationText', () => {
  it('takes the basic-meaning section and drops see-also', () => {
    const { basic, lines } = parseDisambiguationText(pageText('트리거'));

    expect(basic).toHaveLength(2);
    expect(basic[0]).toContain('총의 방아쇠');
    expect(lines).toContain('데이터베이스 트리거');
    expect(lines.some((line) => line.includes('방아쇠 (동음이의)'))).toBe(false);
    expect(lines.some((line) => line.includes('모든 문서'))).toBe(false);
  });

  it('skips the intro sentence', () => {
    const { lines } = parseDisambiguationText(pageText('버블'));

    expect(lines[0]).toBe('거품');
    expect(lines).toHaveLength(10);
  });

  it('returns no basic meaning when there is no basic section', () => {
    expect(parseDisambiguationText(pageText('포트')).basic).toEqual([]);
  });

  it('uses only the first section whose name contains "기본"', () => {
    const text = '소개\n\n== 기본 의미 ==\n첫 뜻\n\n== 기본 아님 ==\n둘째 줄';

    expect(parseDisambiguationText(text)).toEqual({ basic: ['첫 뜻'], lines: ['둘째 줄'] });
  });

  it('handles empty text', () => {
    expect(parseDisambiguationText('')).toEqual({ basic: [], lines: [] });
  });
});

describe('buildMeanings', () => {
  it('uses the part before a colon as the label', () => {
    expect(buildMeanings(['데이터 모델: 데이터의 관계'], ['데이터 모델'])).toEqual([
      { label: '데이터 모델', title: '데이터 모델' },
    ]);
  });

  it('keeps the whole line as the label when there is no colon', () => {
    expect(buildMeanings(['승강장은 지하철의 승강장을 말한다.'], ['승강장'])).toEqual([
      { label: '승강장은 지하철의 승강장을 말한다.', title: '승강장' },
    ]);
  });

  it('picks the longest linked title the line starts with', () => {
    expect(buildMeanings(['버스 터미널: 버스 정류장'], ['버스', '버스 터미널'])[0]?.title).toBe(
      '버스 터미널',
    );
  });

  it('leaves the title empty when no linked title starts the line', () => {
    expect(buildMeanings(['트리거 전략: 게임 전략'], ['방아쇠'])[0]?.title).toBeNull();
  });

  it('makes redirect-linked meanings clickable on the real 모델 fixture', () => {
    const titles = Object.values(linkedResponse('모델').query?.pages ?? {}).flatMap((page) =>
      page.title &&
      page.missing === undefined &&
      page.title !== '모델' &&
      page.title !== '위키낱말사전'
        ? [page.title]
        : [],
    );
    const { lines } = parseDisambiguationText(pageText('모델'));

    const meanings = buildMeanings(lines, titles);

    expect(meanings.find((m) => m.label.startsWith('비즈니스 모델'))?.title).toBe('비즈니스 모델');
  });
});

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

  it.each(['버블', '커널', '터미널', '스레드'])(
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

  it('drops empty items', () => {
    expect(parse('<ul><li></li><li>  </li><li>a</li></ul>').meanings).toHaveLength(1);
  });

  it('handles empty html', () => {
    expect(parseDisambiguationHtml('', [])).toEqual({ basic: [], meanings: [] });
  });
});
