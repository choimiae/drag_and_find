import { describe, expect, it, vi } from 'vitest';
import { handleAdminRequest } from '../../../admin/src/api';

describe('관리자 API', () => {
  it('기간을 제한하고 연결되지 않은 출처를 구분한다', async () => {
    const response = await handleAdminRequest(
      new Request('https://admin.example.test/api/dashboard?days=7'),
      { ASSETS: { fetch: vi.fn() } },
    );
    const body = (await response.json()) as {
      days: number;
      store: { status: string };
      worker: { status: string };
      usage: { status: string };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body.days).toBe(7);
    expect(body.store.status).toBe('connection_required');
    expect(body.worker.status).toBe('connection_required');
    expect(body.usage.status).toBe('connection_required');
  });

  it('허용되지 않은 기간을 거부한다', async () => {
    const response = await handleAdminRequest(
      new Request('https://admin.example.test/api/dashboard?days=365'),
      { ASSETS: { fetch: vi.fn() } },
    );

    expect(response.status).toBe(400);
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
