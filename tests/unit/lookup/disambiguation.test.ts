import { describe, it, expect } from 'vitest';
import { buildMeanings, parseDisambiguationText } from '../../../lib/lookup/disambiguation';
import { linkedResponse, pageText } from '../fixtures/disambiguation/load';

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
