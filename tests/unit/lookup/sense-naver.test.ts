import { describe, it, expect } from 'vitest';
import { pickNaverSense as pickSense } from '../../../lib/lookup/sense-naver';
import type { SenseCandidate } from '../../../lib/lookup/types';

const candidates: SenseCandidate[] = [
  {
    title: 'RAG',
    extract: '독일의 광산 및 석유생산 업체.',
    url: 'https://example.test/company',
  },
  {
    title: '검색 증강 생성',
    extract: '대규모 언어 모델(LLM)이 외부 데이터베이스나 문서를 검색하여 답변을 생성하는 기술.',
    url: 'https://example.test/ai',
  },
];

describe('네이버 백과 문맥 기반 의미 구분', () => {
  it('AI 문맥에서 검색 증강 생성을 선택한다', () => {
    const result = pickSense(
      'LLM의 환각을 줄이기 위해 RAG 아키텍처를 도입했다.',
      ['RAG'],
      candidates,
    );

    expect(result?.url).toBe('https://example.test/ai');
  });

  it('독일 기업 문맥에서 에너지 기업을 선택한다', () => {
    const result = pickSense('독일 에너지 기업 RAG는 석탄 산업을 운영한다.', ['RAG'], candidates);

    expect(result?.url).toBe('https://example.test/company');
  });
});

it('경제 문맥에서 디커플링을 구분한다', () => {
  const candidates: SenseCandidate[] = [
    {
      title: '디커플링',
      extract: '커플 관계와 관련된 표현.',
      url: 'https://example.test/couple',
    },
    {
      title: '디커플링',
      extract: '서로 연관된 국가의 경제 흐름이 다른 방향으로 움직이는 탈동조화 현상.',
      url: 'https://example.test/economy',
    },
  ];

  const result = pickSense(
    '미국과 중국의 경제 디커플링이 심화되고 있다.',
    ['디커플링'],
    candidates,
  );

  expect(result?.url).toBe('https://example.test/economy');
});

it('판단 근거가 부족하면 뜻을 선택하지 않는다', () => {
  const result = pickSense('RAG에 대한 내용을 확인했다.', ['RAG'], candidates);

  expect(result).toBeNull();
});

it('문맥의 단서가 부족하면 의미를 선택하지 않는다', () => {
  const result = pickSense('독일에서 RAG 관련 기사를 읽었다.', ['RAG'], candidates);

  expect(result).toBeNull();
});
