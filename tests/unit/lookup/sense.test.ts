import { describe, it, expect } from 'vitest';
import { pickSense } from '../../../lib/lookup/sense';
import type { SenseCandidate } from '../../../lib/lookup/types';
import { linkedPages } from '../fixtures/disambiguation/load';

function candidatesOf(word: string): SenseCandidate[] {
  return linkedPages(word)
    .filter((page) => page.title !== word && page.title !== '위키낱말사전')
    .map((page) => ({
      ...page,
      url: `https://ko.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
    }));
}

// 사전 시험(2026-10-24) 13문장. 기대값은 측정 결과를 고정한 것이다: 맞힘 6, 틀림 1(#1), 고르지 않음 6.
// 규칙을 바꿔 결과가 달라지면 이 표를 근거와 함께 갱신한다.
const CASES: Array<[number, string, string, string | null]> = [
  [
    1,
    '모델',
    '이번 시즌 런웨이에 선 신인 모델은 데뷔 첫 해에 해외 패션위크 무대까지 밟았다.',
    '모델 (드라마)',
  ],
  [
    2,
    '모델',
    '구독형 수익 구조로 바꾼 뒤 이 스타트업의 모델은 투자자들 사이에서 안정적이라는 평가를 받았다.',
    null,
  ],
  [
    3,
    '트리거',
    '주문 테이블에 행이 추가될 때마다 재고를 줄이도록 트리거를 걸어 두었다.',
    '데이터베이스 트리거',
  ],
  [
    4,
    '트리거',
    '사격장 교관은 트리거에 손가락을 올리기 전에 반드시 총구 방향을 확인하라고 강조했다.',
    '방아쇠',
  ],
  [
    5,
    '버블',
    '부동산 가격이 실수요와 무관하게 치솟자 전문가들은 버블 붕괴를 경고하고 나섰다.',
    '거품 경제',
  ],
  [6, '버블', '타피오카 펄이 듬뿍 들어간 버블 한 잔이 요즘 대학가 카페의 인기 메뉴다.', '버블티'],
  [7, '플랫폼', '열차가 도착하자 플랫폼에 서 있던 승객들이 한꺼번에 몰려들었다.', '승강장'],
  [8, '플랫폼', '배달 앱 같은 플랫폼 기업이 수수료를 올리면서 입점 업체들의 부담이 커졌다.', null],
  [11, '커널', '리눅스 커널 최신 버전은 메모리 관리와 스케줄러 성능을 크게 개선했다.', null],
  [14, '마진', '원자재 가격이 오르면서 제조업체들의 마진이 지난 분기보다 크게 줄었다.', null],
  [15, '포트', '방화벽에서 웹 서버용 포트를 열어 주지 않으면 외부에서 접속할 수 없다.', null],
  [19, '터미널', '명절 연휴를 앞두고 고속버스 터미널은 귀성객들로 하루 종일 붐볐다.', null],
  [
    20,
    '스레드',
    '작업을 여러 스레드로 나누어 실행하자 멀티코어 CPU의 활용률이 높아졌다.',
    '스레드 (컴퓨팅)',
  ],
];

describe('pickSense on the recorded sample', () => {
  it.each(CASES)('case %i (%s)', (_id, word, context, expected) => {
    expect(pickSense(context, [word], candidatesOf(word))?.title ?? null).toBe(expected);
  });
});

describe('pickSense rules', () => {
  const url = 'https://ko.wikipedia.org/wiki/x';
  const database = {
    title: '데이터베이스 트리거',
    extract: '테이블에 행이 추가되면 자동으로 실행되는 절차',
    url,
  };
  const gun = { title: '방아쇠', extract: '총의 격발 장치', url };

  it('returns nothing without context', () => {
    expect(pickSense('', ['트리거'], [database, gun])).toBeNull();
    expect(pickSense('   ', ['트리거'], [database, gun])).toBeNull();
  });

  it('returns nothing without candidates', () => {
    expect(pickSense('테이블에 행이 추가될 때 트리거', ['트리거'], [])).toBeNull();
  });

  it('needs at least three shared two-letter pieces', () => {
    expect(pickSense('테이블 트리거', ['트리거'], [database, gun])).toBeNull();
  });

  it('needs a clear lead over the second candidate', () => {
    const twin = { ...database, title: '데이터베이스 트리거 2' };

    expect(pickSense('테이블에 행이 추가될 때 트리거', ['트리거'], [database, twin])).toBeNull();
  });

  it('ignores the looked-up word itself when comparing', () => {
    const echo = { title: '트리거 트리거', extract: '트리거 트리거 트리거', url };

    expect(pickSense('트리거 트리거 트리거', ['트리거'], [echo, gun])).toBeNull();
  });

  it('removes the word regardless of letter case', () => {
    const echo = { title: 'cpu', extract: 'CPU CPU CPU CPU', url };

    expect(pickSense('CPU CPU CPU', ['cpu'], [echo, gun])).toBeNull();
  });

  it('removes every given word', () => {
    const echo = { title: '다른 제목', extract: 'abcd abcd abcd', url };

    expect(pickSense('abcd abcd abcd', ['트리거', 'abcd'], [echo, gun])).toBeNull();
  });
});
