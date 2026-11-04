import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function runCheck(status: number, body: unknown) {
  const server = createServer((request, response) => {
    expect(request.url).toBe('/lookup?query=%EC%98%A8%EB%B3%B4%EB%94%A9');
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('테스트 서버 주소를 확인할 수 없습니다.');

  const child = spawn(process.execPath, ['scripts/check-worker.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, WXT_LOOKUP_API_URL: `http://127.0.0.1:${address.port}` },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
  const [exitCode] = (await once(child, 'close')) as [number];
  return { exitCode, stdout, stderr };
}

describe('배포 Worker 확인 명령', () => {
  it('정상 조회 결과와 걸린 시간을 출력한다', async () => {
    const result = await runCheck(200, {
      status: 'found',
      source: 'wikipedia',
      title: '온보딩',
      extract: '신입 직원이 조직에 적응하도록 돕는 과정',
      url: 'https://ko.wikipedia.org/wiki/온보딩',
      isDisambiguation: false,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('온보딩');
    expect(result.stdout).toContain('wikipedia');
    expect(result.stdout).toMatch(/\d+ms/);
  });

  it('HTTP 오류를 실패로 보고한다', async () => {
    const result = await runCheck(503, { status: 'network_error' });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('503');
  });

  it('성공 코드여도 조회 결과 형식이 틀리면 실패한다', async () => {
    const result = await runCheck(200, { status: 'found', title: '온보딩' });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('응답 형식');
  });
});
