// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { handleTelemetry } from '../../../worker/telemetry';
import { createWorkerHandler } from '../../../worker/index';
import { sqliteUsageDb } from '../sqlite-d1';
import { getLiveUsage } from '../../../worker/usage-db';

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

  it('유효한 조회를 D1에 기록하고 GA4에도 전달한다', async () => {
    const { db } = sqliteUsageDb();
    const response = await handleTelemetry(
      new Request('https://lookup.example.test/telemetry', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      { ...env, USAGE_DB: db },
      vi.fn(async () => new Response(null, { status: 204 })),
    );

    expect(response.status).toBe(204);
    expect((await getLiveUsage(db, 1)).completed).toBe(1);
  });

  it('GA4 전송이 실패해도 D1 실시간 건수는 기록한다', async () => {
    const { db } = sqliteUsageDb();
    const response = await handleTelemetry(
      new Request('https://lookup.example.test/telemetry', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      { ...env, USAGE_DB: db },
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    expect(response.status).toBe(502);
    expect((await getLiveUsage(db, 1)).completed).toBe(1);
  });

  it('GA4 설정이 누락되어도 D1 실시간 건수는 기록한다', async () => {
    const { db } = sqliteUsageDb();
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    const response = await handleTelemetry(
      new Request('https://lookup.example.test/telemetry', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      { RATE_LIMITER: env.RATE_LIMITER, USAGE_DB: db },
      fetchFn,
    );

    expect(response.status).toBe(502);
    expect((await getLiveUsage(db, 1)).completed).toBe(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('D1 쓰기가 실패해도 GA4 전송을 시도한다', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    const response = await handleTelemetry(
      new Request('https://lookup.example.test/telemetry', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      {
        ...env,
        USAGE_DB: {
          prepare() {
            throw new Error('D1 unavailable');
          },
          async batch() {},
        },
      },
      fetchFn,
    );

    expect(response.status).toBe(502);
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

  it('본문을 읽기 전에 요청 제한을 적용한다', async () => {
    let readCount = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          readCount += 1;
          controller.enqueue(new TextEncoder().encode(JSON.stringify(payload)));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const request = new Request('https://lookup.example.test/telemetry', {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    const limited = { ...env, RATE_LIMITER: { limit: async () => ({ success: false }) } };

    const response = await handleTelemetry(request, limited);

    expect(response.status).toBe(429);
    expect(readCount).toBe(0);
  });

  it('본문이 500바이트를 넘으면 스트림 읽기를 중단한다', async () => {
    let canceled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        start(controller) {
          controller.enqueue(new TextEncoder().encode('x'.repeat(501)));
        },
        cancel() {
          canceled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const request = new Request('https://lookup.example.test/telemetry', {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    const response = await handleTelemetry(request, env);

    expect(response.status).toBe(400);
    expect(canceled).toBe(true);
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
