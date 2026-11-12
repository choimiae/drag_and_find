// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { handleAdminRequest } from '../../../admin/src/api';
import { recordUsage } from '../../../worker/usage-db';
import { sqliteUsageDb } from '../sqlite-d1';

describe('관리자 API', () => {
  it('기간을 지정하지 않으면 오늘 통계를 반환한다', async () => {
    const response = await handleAdminRequest(
      new Request('https://admin.example.test/api/dashboard'),
      {
        ASSETS: { fetch: vi.fn() },
      },
    );
    const body = (await response.json()) as { days: number };

    expect(response.status).toBe(200);
    expect(body.days).toBe(1);
  });

  it('기간을 제한하고 연결되지 않은 출처를 구분한다', async () => {
    const response = await handleAdminRequest(
      new Request('https://admin.example.test/api/dashboard?days=7'),
      { ASSETS: { fetch: vi.fn() } },
    );
    const body = (await response.json()) as {
      days: number;
      store: { status: string };
      usage: { status: string };
      liveUsage: { status: string };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body.days).toBe(7);
    expect(body.store.status).toBe('connection_required');
    expect(body.usage.status).toBe('connection_required');
    expect(body.liveUsage.status).toBe('connection_required');
  });

  it('실시간 API는 D1의 완료·실패·사용 설치 수를 별도로 반환한다', async () => {
    const { db } = sqliteUsageDb();
    await recordUsage(db, '123.456', 'lookup_completed');
    const response = await handleAdminRequest(
      new Request('https://admin.example.test/api/live-usage?days=1'),
      { ASSETS: { fetch: vi.fn() }, USAGE_DB: db },
    );
    const body = (await response.json()) as {
      status: string;
      data: { activeInstalls: number; completed: number; failed: number };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toMatchObject({
      status: 'ready',
      data: { activeInstalls: 1, completed: 1, failed: 0 },
    });
  });

  it('기본 대시보드에도 D1 실시간 사용량을 포함한다', async () => {
    const { db } = sqliteUsageDb();
    await recordUsage(db, '123.456', 'lookup_failed');
    const response = await handleAdminRequest(
      new Request('https://admin.example.test/api/dashboard'),
      { ASSETS: { fetch: vi.fn() }, USAGE_DB: db },
    );
    const body = (await response.json()) as {
      liveUsage: { status: string; data: { failed: number } };
    };
    expect(body.liveUsage).toMatchObject({ status: 'ready', data: { failed: 1 } });
  });

  it('허용되지 않은 기간을 거부한다', async () => {
    const response = await handleAdminRequest(
      new Request('https://admin.example.test/api/dashboard?days=365'),
      { ASSETS: { fetch: vi.fn() } },
    );

    expect(response.status).toBe(400);
  });

  it('관리자 요청이 섞인 Cloudflare 호출 합계를 응답에 포함하지 않는다', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('외부 통계 호출 없음');
    });
    const env = {
      ASSETS: { fetch: vi.fn() },
      CF_ACCOUNT_ID: 'account-id',
      CF_API_TOKEN: 'test-token',
    };
    const response = await handleAdminRequest(
      new Request('https://admin.example.test/api/dashboard?days=7'),
      env,
      fetchFn,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(body).not.toHaveProperty('worker');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('같은 계정의 조회 Worker 상태는 서비스 바인딩으로 확인한다', async () => {
    const response = await handleAdminRequest(
      new Request('https://admin.example.test/api/dashboard?days=7'),
      {
        ASSETS: { fetch: vi.fn() },
        LOOKUP_WORKER_URL: 'https://lookup.example.test',
        LOOKUP_SERVICE: {
          fetch: vi.fn(async () =>
            Response.json({
              status: 'found',
              source: 'naver',
              title: '온보딩',
              extract: '설명',
              url: 'https://example.com/entry',
              isDisambiguation: false,
            }),
          ),
        },
      },
      vi.fn(async () => {
        throw new Error('같은 영역의 workers.dev 직접 호출 불가');
      }),
    );
    const body = (await response.json()) as { health: { status: string } };

    expect(body.health.status).toBe('ready');
  });
});
