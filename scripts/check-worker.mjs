// 배포된 Worker에 실제 요청을 보내 기본 조회 경로와 응답 형식을 확인한다.
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { URL } from 'node:url';

const workerAddress = process.env.WXT_LOOKUP_API_URL;
const startedAt = performance.now();

try {
  if (!workerAddress) throw new Error('WXT_LOOKUP_API_URL에 Worker 주소를 지정하세요.');

  const baseUrl = new URL(workerAddress);
  if (!['http:', 'https:'].includes(baseUrl.protocol))
    throw new Error('Worker 주소는 HTTP 또는 HTTPS 주소여야 합니다.');

  const lookupUrl = new URL('/lookup', baseUrl);
  lookupUrl.searchParams.set('query', '온보딩');

  const response = await globalThis.fetch(lookupUrl, {
    signal: globalThis.AbortSignal.timeout(20_000),
  });
  if (response.status !== 200) throw new Error(`HTTP ${response.status} 응답을 받았습니다.`);

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('응답 형식이 JSON이 아닙니다.');
  }

  if (
    result?.status !== 'found' ||
    !['naver', 'wikipedia', 'wikidata'].includes(result.source) ||
    typeof result.title !== 'string' ||
    !result.title.trim() ||
    typeof result.extract !== 'string' ||
    !result.extract.trim() ||
    typeof result.url !== 'string' ||
    !URL.canParse(result.url) ||
    typeof result.isDisambiguation !== 'boolean'
  )
    throw new Error('응답 형식이 예상한 조회 결과와 다릅니다.');

  globalThis.console.log(
    `Worker 확인 성공: HTTP 200, ${result.source}, ${result.title}, ${Math.round(performance.now() - startedAt)}ms`,
  );
} catch (error) {
  globalThis.console.error(
    `Worker 확인 실패 (${Math.round(performance.now() - startedAt)}ms): ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
