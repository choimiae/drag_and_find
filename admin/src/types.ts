export type Section<T> =
  | { status: 'ready'; updatedAt: string; data: T }
  | { status: 'connection_required'; message?: string }
  | { status: 'error'; message: string; updatedAt?: string };

export interface StoreMetrics {
  installs: number;
  uninstalls: number;
  users: number;
  impressions: number;
  pageViews: number;
}

export interface HealthMetrics {
  httpStatus: number;
  latencyMs: number;
}

export interface UsageMetrics {
  activeInstalls: number;
  completed: number;
  failed: number;
  daily: Array<{ date: string; completed: number; failed: number }>;
}

export interface DashboardResponse {
  days: 1 | 7 | 30;
  store: Section<StoreMetrics>;
  health: Section<HealthMetrics>;
  usage: Section<UsageMetrics>;
  liveUsage: Section<UsageMetrics>;
}
