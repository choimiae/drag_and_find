import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectUsageControl,
  pollLiveUsage,
  loadDashboard,
  renderDashboard,
  renderLiveUsage,
  startLiveUsagePolling,
} from '../../../admin/src/main';
import type { DashboardResponse } from '../../../admin/src/types';

const dashboard: DashboardResponse = {
  days: 7,
  store: {
    status: 'ready',
    updatedAt: '2026-11-10T04:00:00.000Z',
    data: { installs: 76, uninstalls: 9, users: 412, impressions: 3100, pageViews: 2430 },
  },
  health: {
    status: 'ready',
    updatedAt: '2026-11-10T04:00:00.000Z',
    data: { httpStatus: 200, latencyMs: 420 },
  },
  usage: { status: 'connection_required' },
  liveUsage: { status: 'connection_required' },
};

describe('관리자 대시보드', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('연결되지 않은 사용량에 예시 수치 대신 연결 필요를 표시한다', () => {
    const root = document.querySelector<HTMLElement>('#app')!;

    renderDashboard(root, dashboard);

    expect(root.textContent).toContain('조회 사용 설치 수');
    expect(root.textContent).toContain('연결 필요');
    expect(root.textContent).toContain('76');
    expect(root.textContent).toContain('Worker 현재 상태');
    expect(root.textContent).not.toContain('128');
    expect(root.querySelector<HTMLInputElement>('#include-my-usage')?.disabled).toBe(true);
  });

  it('관리자 체크박스가 확장의 현재 상태를 읽고 이후 조회 포함 여부를 전달한다', () => {
    const root = document.querySelector<HTMLElement>('#app')!;
    renderDashboard(root, dashboard);
    const checkbox = root.querySelector<HTMLInputElement>('#include-my-usage')!;
    const requests: Array<Record<string, unknown>> = [];
    const post = vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      requests.push(message as Record<string, unknown>);
    });
    const disconnect = connectUsageControl(root);

    const read = requests[0];
    expect(read).toMatchObject({ channel: 'drag-and-find-usage', kind: 'get' });
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        source: window,
        data: { channel: 'drag-and-find-usage', kind: 'state', id: read?.id, includeUsage: true },
      }),
    );
    expect(checkbox.disabled).toBe(false);
    expect(checkbox.checked).toBe(true);

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(requests[1]).toMatchObject({
      channel: 'drag-and-find-usage',
      kind: 'set',
      includeUsage: false,
    });

    disconnect();
    post.mockRestore();
  });

  it('스토어 이용자 수를 일일 수치로 표시하고 확인 시각은 하단 한 곳에 둔다', () => {
    const root = document.querySelector<HTMLElement>('#app')!;

    renderDashboard(root, {
      ...dashboard,
      usage: {
        status: 'ready',
        updatedAt: '2026-11-10T04:00:00.000Z',
        data: { activeInstalls: 12, completed: 8, failed: 2, daily: [] },
      },
    });

    expect(root.textContent).toContain('스토어 일일 이용자');
    expect(root.querySelector('main > footer')?.textContent).toContain('마지막 확인');
    expect(root.textContent?.match(/마지막 확인/g)).toHaveLength(1);
    expect(root.textContent).not.toContain('확인 시각');
  });

  it('관리자 상태 확인이 섞이는 Worker 합계 대신 확장 조회 실패를 표시한다', () => {
    const root = document.querySelector<HTMLElement>('#app')!;

    renderDashboard(root, {
      ...dashboard,
      liveUsage: {
        status: 'ready',
        updatedAt: '2026-11-10T04:00:00.000Z',
        data: { activeInstalls: 12, completed: 8, failed: 2, daily: [] },
      },
    });

    expect(root.querySelector('#lookup-failures')?.textContent).toBe('2');
    expect(root.textContent).not.toContain('Cloudflare Worker');
    expect(root.textContent).not.toContain('전체 요청');
    expect(root.textContent).toContain('Worker 현재 상태');
  });

  it('일별 조회를 값 눈금과 기준선이 있는 그래프로 표시한다', () => {
    const root = document.querySelector<HTMLElement>('#app')!;
    renderDashboard(root, {
      ...dashboard,
      liveUsage: {
        status: 'ready',
        updatedAt: '2026-11-10T04:00:00.000Z',
        data: {
          activeInstalls: 12,
          completed: 70,
          failed: 1,
          daily: [
            { date: '2026-11-09', completed: 30, failed: 0 },
            { date: '2026-11-10', completed: 40, failed: 1 },
          ],
        },
      },
    });

    expect([...root.querySelectorAll('.chart-axis span')].map((item) => item.textContent)).toEqual([
      '50',
      '25',
      '0',
    ]);
    expect(root.querySelectorAll('.chart-gridline')).toHaveLength(3);
    expect(
      [...root.querySelectorAll<HTMLElement>('.chart-bar')].map((bar) => bar.style.height),
    ).toEqual(['60%', '80%']);
    expect([...root.querySelectorAll('.chart-value')].map((value) => value.textContent)).toEqual([
      '30',
      '40',
    ]);
    expect(root.querySelector('#chart')?.textContent).toContain('11-09');
  });

  it('요약은 D1 실시간 수치를 쓰고 GA4 지연 수치를 따로 표시한다', () => {
    const root = document.querySelector<HTMLElement>('#app')!;
    renderDashboard(root, {
      ...dashboard,
      usage: {
        status: 'ready',
        updatedAt: '2026-11-10T04:00:00.000Z',
        data: { activeInstalls: 12, completed: 8, failed: 2, daily: [] },
      },
      liveUsage: {
        status: 'ready',
        updatedAt: '2026-11-12T12:00:00.000Z',
        data: { activeInstalls: 3, completed: 11, failed: 1, daily: [] },
      },
    });

    expect(root.querySelector('#active-installs')?.textContent).toBe('3');
    expect(root.querySelector('#lookups')?.textContent).toBe('12');
    expect(root.querySelector('#lookup-failures')?.textContent).toBe('1');
    expect(root.querySelector('#details')?.textContent).toContain('GA4 · 지연 통계');
    expect(root.querySelector('#details')?.textContent).toContain('실시간 조회 · D1');
  });

  it('새 D1 결과만 적용해 요약과 그래프를 갱신한다', () => {
    const root = document.querySelector<HTMLElement>('#app')!;
    renderDashboard(root, dashboard);

    renderLiveUsage(root, {
      status: 'ready',
      updatedAt: '2026-11-12T12:00:00.000Z',
      data: {
        activeInstalls: 2,
        completed: 5,
        failed: 0,
        daily: [{ date: '2026-11-12', completed: 5, failed: 0 }],
      },
    });

    expect(root.querySelector('#active-installs')?.textContent).toBe('2');
    expect(root.querySelector('#lookups')?.textContent).toBe('5');
    expect(root.querySelector('#chart')?.textContent).toContain('11-12');
    expect(root.querySelector('#installs')?.textContent).toBe('76');
  });

  it('D1 조회 오류를 데이터 없음과 구분한다', () => {
    const root = document.querySelector<HTMLElement>('#app')!;
    renderDashboard(root, dashboard);

    renderLiveUsage(root, { status: 'error', message: '실시간 통계를 가져오지 못했습니다.' });

    expect(root.querySelector('#active-installs')?.textContent).toBe('확인 불가');
    expect(root.querySelector('#chart')?.textContent).toBe('실시간 통계를 가져오지 못했습니다.');
    expect(root.querySelector('#live-details')?.textContent).toContain(
      '실시간 통계를 가져오지 못했습니다.',
    );
  });

  it('화면이 보일 때 선택 기간의 실시간 사용량만 가져온다', async () => {
    const root = document.querySelector<HTMLElement>('#app')!;
    renderDashboard(root, dashboard);
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        status: 'ready',
        updatedAt: '2026-11-12T12:00:00.000Z',
        data: { activeInstalls: 4, completed: 6, failed: 1, daily: [] },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      await pollLiveUsage(root);
      expect(fetchMock).toHaveBeenCalledWith('/api/live-usage?days=7', { cache: 'no-store' });
      expect(root.querySelector('#active-installs')?.textContent).toBe('4');
      expect(root.querySelector('#installs')?.textContent).toBe('76');

      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      await pollLiveUsage(root);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      vi.unstubAllGlobals();
    }
  });

  it('15초마다 다시 읽고 타이머를 정리할 수 있다', async () => {
    const root = document.querySelector<HTMLElement>('#app')!;
    renderDashboard(root, dashboard);
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'connection_required' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
    const stop = startLiveUsagePolling(root);
    try {
      await vi.advanceTimersByTimeAsync(14_999);
      expect(fetchMock).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      stop();
      await vi.advanceTimersByTimeAsync(15_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      stop();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('기간을 빠르게 바꿔도 늦은 이전 응답이 화면을 되돌리지 않는다', async () => {
    const root = document.querySelector<HTMLElement>('#app')!;
    renderDashboard(root, dashboard);
    let resolveSeven!: (response: Response) => void;
    let resolveThirty!: (response: Response) => void;
    const seven = new Promise<Response>((resolve) => (resolveSeven = resolve));
    const thirty = new Promise<Response>((resolve) => (resolveThirty = resolve));
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/dashboard?days=7') return seven;
        if (url === '/api/dashboard?days=30') return thirty;
        return Promise.resolve(Response.json({ status: 'connection_required' }));
      }),
    );
    try {
      const first = loadDashboard(root, 7);
      const second = loadDashboard(root, 30);
      resolveThirty(Response.json({ ...dashboard, days: 30 }));
      await second;
      resolveSeven(Response.json({ ...dashboard, days: 7 }));
      await first;
      expect(root.querySelector<HTMLSelectElement>('#period')?.value).toBe('30');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('전체 응답이 늦게 와도 그 사이 받은 최신 D1 수치를 유지한다', async () => {
    const root = document.querySelector<HTMLElement>('#app')!;
    renderDashboard(root, dashboard);
    let resolveDashboard!: (response: Response) => void;
    const pendingDashboard = new Promise<Response>((resolve) => (resolveDashboard = resolve));
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.startsWith('/api/dashboard')
          ? pendingDashboard
          : Promise.resolve(
              Response.json({
                status: 'ready',
                updatedAt: '2026-11-12T12:00:00.000Z',
                data: { activeInstalls: 5, completed: 9, failed: 0, daily: [] },
              }),
            ),
      ),
    );
    try {
      const loading = loadDashboard(root, 7);
      await pollLiveUsage(root);
      resolveDashboard(Response.json(dashboard));
      await loading;
      expect(root.querySelector('#active-installs')?.textContent).toBe('5');
      expect(root.querySelector('#lookups')?.textContent).toBe('9');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
