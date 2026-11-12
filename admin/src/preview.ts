import type { DashboardResponse } from './types';

const updatedAt = new Date().toISOString();

export function previewDashboard(days: 1 | 7 | 30): DashboardResponse {
  const count = days === 1 ? 1 : days;
  const daily = Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - count + index + 1);
    return {
      date: date.toISOString().slice(0, 10),
      completed: 14 + ((index * 7) % 19),
      failed: index % 5 === 0 ? 2 : 1,
    };
  });
  return {
    days,
    usage: {
      status: 'ready',
      updatedAt,
      data: {
        activeInstalls: 128,
        completed: daily.reduce((sum, day) => sum + day.completed, 0),
        failed: daily.reduce((sum, day) => sum + day.failed, 0),
        daily,
      },
    },
    store: {
      status: 'ready',
      updatedAt,
      data: { installs: 76, uninstalls: 9, users: 412, impressions: 3100, pageViews: 2430 },
    },
    health: { status: 'ready', updatedAt, data: { httpStatus: 200, latencyMs: 420 } },
  };
}
