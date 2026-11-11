import { beforeEach, describe, expect, it } from 'vitest';
import { renderDashboard } from '../../../admin/src/main';
import type { DashboardResponse } from '../../../admin/src/types';

const dashboard: DashboardResponse = {
  days: 7,
  store: {
    status: 'ready',
    updatedAt: '2026-11-10T04:00:00.000Z',
    data: { installs: 76, uninstalls: 9, users: 412, impressions: 3100, pageViews: 2430 },
  },
  worker: {
    status: 'ready',
    updatedAt: '2026-11-10T04:00:00.000Z',
    data: { requests: 1318, errors: 3 },
  },
  health: {
    status: 'ready',
    updatedAt: '2026-11-10T04:00:00.000Z',
    data: { httpStatus: 200, latencyMs: 420 },
  },
  usage: { status: 'connection_required' },
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
  });

  it('스토어 이용자 수를 일일 수치로 표시하고 출처별 확인 시각을 보여 준다', () => {
    const root = document.querySelector<HTMLElement>('#app')!;

    renderDashboard(root, dashboard);

    expect(root.textContent).toContain('스토어 일일 이용자');
    expect(root.textContent).toContain('마지막 확인');
  });

  it('일별 조회를 값 눈금과 기준선이 있는 그래프로 표시한다', () => {
    const root = document.querySelector<HTMLElement>('#app')!;
    renderDashboard(root, {
      ...dashboard,
      usage: {
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
});
