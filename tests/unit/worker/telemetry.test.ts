import { describe, expect, it, vi } from 'vitest';
import { handleTelemetry } from '../../../worker/telemetry';
import { createWorkerHandler } from '../../../worker/index';

const payload = {
  clientId: '123456789.987654321',
  event: 'lookup_completed',
  version: '1.0.4',
};
const env = {
  GA4_MEASUREMENT_ID: 'G-TEST1234',
  GA4_API_SECRET: 'secret',
  RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
};

describe('Worker 통계 이벤트', () => {
  it('허용한 세 필드만 GA4로 전달한다', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain('measurement_id=G-TEST1234');
      const body = JSON.parse(String(init?.body)) as {
        client_id: string;
        events: Array<{ name: string; params: { app_version: string } }>;
      };
      expect(body.client_id).toBe(payload.clientId);
      expect(body.events[0]?.name).toBe('lookup_completed');
      expect(body.events[0]?.params.app_version).toBe('1.0.4');
      return new Response(null, { status: 204 });
    });
    const request = new Request('https://lookup.example.test/telemetry', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = await handleTelemetry(request, env, fetchFn);

    expect(response.status).toBe(204);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('추가 필드에 검색어가 들어오면 거부한다', async () => {
    const request = new Request('https://lookup.example.test/telemetry', {
      method: 'POST',
      body: JSON.stringify({ ...payload, query: '비밀 단어' }),
    });
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await handleTelemetry(request, env, fetchFn);

    expect(response.status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('GA4 형식이 아닌 설치 식별자는 거부한다', async () => {
    const request = new Request('https://lookup.example.test/telemetry', {
      method: 'POST',
      body: JSON.stringify({ ...payload, clientId: '2c316d5b-1234-4bc5-a976-09587a318250' }),
    });
    const response = await handleTelemetry(
      request,
      env,
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    expect(response.status).toBe(400);
  });

  it('요청 제한을 넘으면 GA4에 전달하지 않는다', async () => {
    const request = new Request('https://lookup.example.test/telemetry', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    const limited = { ...env, RATE_LIMITER: { limit: vi.fn(async () => ({ success: false })) } };

    const response = await handleTelemetry(request, limited, fetchFn);

    expect(response.status).toBe(429);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('조회 Worker의 /telemetry 경로에서 처리한다', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    const handler = createWorkerHandler(
      { NAVER_CLIENT_ID: 'test', NAVER_CLIENT_SECRET: 'test', ...env },
      fetchFn,
    );

    const response = await handler(
      new Request('https://lookup.example.test/telemetry', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(204);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
