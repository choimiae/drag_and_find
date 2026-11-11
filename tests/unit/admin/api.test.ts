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
});
