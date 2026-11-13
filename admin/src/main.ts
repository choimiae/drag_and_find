import type { DashboardResponse, Section, UsageMetrics } from './types';

function sectionValue<T>(section: Section<T>, value: (data: T) => number): string {
  if (section.status === 'ready') return value(section.data).toLocaleString('ko-KR');
  return section.status === 'connection_required' ? '연결 필요' : '확인 불가';
}

function detail(label: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'detail-row';
  const name = document.createElement('span');
  name.textContent = label;
  const result = document.createElement('strong');
  result.textContent = value;
  row.append(name, result);
  return row;
}

function showSection<T>(
  parent: HTMLElement,
  title: string,
  section: Section<T>,
  values: Array<[string, (data: T) => number]>,
): void {
  const card = document.createElement('section');
  card.className = 'detail-card';
  const header = document.createElement('div');
  header.className = 'detail-head';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const badge = document.createElement('span');
  badge.className = `badge badge-${section.status}`;
  badge.textContent =
    section.status === 'ready' ? '연결됨' : section.status === 'error' ? '오류' : '연결 필요';
  header.append(heading, badge);
  card.append(header);
  if (section.status === 'ready') {
    for (const [label, getValue] of values)
      card.append(detail(label, getValue(section.data).toLocaleString('ko-KR')));
  } else {
    const message = document.createElement('p');
    message.className = 'section-message';
    message.textContent =
      section.message ??
      (section.status === 'connection_required'
        ? '계정 연결 후 표시됩니다.'
        : '통계를 가져오지 못했습니다.');
    card.append(message);
  }
  parent.append(card);
}

export function renderDashboard(root: HTMLElement, dashboard: DashboardResponse): void {
  root.innerHTML = `
    <div class="dashboard">
      <header class="dashboard-header">
        <div class="dashboard-header-inner">
          <div class="brand"><svg class="brand-icon" viewBox="0 0 128 128" aria-hidden="true"><defs><linearGradient id="brand-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#03c75a"/><stop offset="1" stop-color="#1a73e8"/></linearGradient></defs><circle cx="64" cy="64" r="64" fill="url(#brand-gradient)"/><g transform="translate(31 31) scale(2.75)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></g></svg><div><h1>Drag and Find <span class="badge">관리자</span></h1><p>설치·사용·Worker 상태를 한눈에</p></div></div>
          <div class="toolbar"><label>기간 <select id="period"><option value="1">오늘</option><option value="7">최근 7일</option><option value="30">최근 30일</option></select></label><button id="refresh" type="button">새로고침</button></div>
        </div>
      </header>
      <main>
        <div class="section-heading"><h2>현황</h2><p>조회 사용 설치 수는 사람 수와 다를 수 있습니다</p></div>
        <div class="usage-control"><label for="include-my-usage"><input id="include-my-usage" type="checkbox" disabled />이 브라우저의 내 조회 포함</label><span id="usage-control-status" role="status">확장 연결 확인 중</span></div>
        <div class="metrics">
          <section class="metric metric-highlight"><span>조회 사용 설치 수</span><strong id="active-installs"></strong><small>실시간 · D1</small></section>
          <section class="metric"><span>단어 조회 건수</span><strong id="lookups"></strong><small>실시간 · D1</small></section>
          <section class="metric"><span>웹스토어 설치</span><strong id="installs"></strong><small>Chrome Web Store</small></section>
          <section class="metric"><span>조회 실패</span><strong id="lookup-failures"></strong><small>실시간 · D1</small></section>
        </div>
        <div class="middle">
          <section class="panel chart-panel"><h2>일별 조회 추이</h2><p class="chart-description">조회 완료 건수</p><div id="chart" class="chart"></div></section>
          <section class="panel health-panel"><div class="detail-head"><h2>Worker 현재 상태</h2><span id="health-badge" class="badge"></span></div><strong id="latency" class="latency"></strong><p>실제 단어 조회 응답 시간</p><div id="health-details"></div></section>
        </div>
        <h2 class="details-heading">출처별 상세</h2><div id="details" class="details"><div id="live-details"></div><div id="ga4-details"></div><div id="store-details"></div></div>
        <footer class="dashboard-footer" id="last-checked"></footer>
      </main>
    </div>`;

  const set = (id: string, value: string) => {
    const target = root.querySelector<HTMLElement>(`#${id}`);
    if (target) target.textContent = value;
  };
  set(
    'installs',
    sectionValue(dashboard.store, (data) => data.installs),
  );
  set(
    'latency',
    dashboard.health.status === 'ready' ? `${dashboard.health.data.latencyMs} ms` : '확인 불가',
  );
  set(
    'health-badge',
    dashboard.health.status === 'ready' && dashboard.health.data.httpStatus === 200
      ? '정상'
      : '확인 필요',
  );
  set('last-checked', `마지막 확인 ${new Date().toLocaleString('ko-KR')}`);
  const period = root.querySelector<HTMLSelectElement>('#period');
  if (period) period.value = String(dashboard.days);

  const healthDetails = root.querySelector<HTMLElement>('#health-details');
  if (healthDetails && dashboard.health.status === 'ready') {
    healthDetails.append(detail('HTTP 상태', String(dashboard.health.data.httpStatus)));
  }
  renderLiveUsage(root, dashboard.liveUsage);
  const ga4Details = root.querySelector<HTMLElement>('#ga4-details');
  const storeDetails = root.querySelector<HTMLElement>('#store-details');
  if (ga4Details)
    showSection(ga4Details, 'GA4 · 지연 통계', dashboard.usage, [
      ['조회 완료', (data) => data.completed],
      ['조회 실패', (data) => data.failed],
      ['사용한 설치 수', (data) => data.activeInstalls],
    ]);
  if (storeDetails)
    showSection(storeDetails, 'Chrome Web Store · 일별 통계', dashboard.store, [
      ['설치', (data) => data.installs],
      ['삭제', (data) => data.uninstalls],
      ['페이지 조회', (data) => data.pageViews],
      ['노출', (data) => data.impressions],
      ['스토어 일일 이용자', (data) => data.users],
    ]);
}

export function renderLiveUsage(root: HTMLElement, usage: Section<UsageMetrics>): void {
  const set = (id: string, value: string) => {
    const target = root.querySelector<HTMLElement>(`#${id}`);
    if (target) target.textContent = value;
  };
  set(
    'active-installs',
    sectionValue(usage, (data) => data.activeInstalls),
  );
  set(
    'lookups',
    sectionValue(usage, (data) => data.completed + data.failed),
  );
  set(
    'lookup-failures',
    sectionValue(usage, (data) => data.failed),
  );
  const liveDetails = root.querySelector<HTMLElement>('#live-details');
  if (liveDetails) {
    liveDetails.replaceChildren();
    showSection(liveDetails, '실시간 조회 · D1', usage, [
      ['조회 완료', (data) => data.completed],
      ['조회 실패', (data) => data.failed],
      ['사용한 설치 수', (data) => data.activeInstalls],
    ]);
  }
  const chart = root.querySelector<HTMLElement>('#chart');
  if (chart) {
    chart.replaceChildren();
    chart.classList.remove('chart-empty');
    if (usage.status === 'ready' && usage.data.daily.length > 0) {
      const largest = Math.max(1, ...usage.data.daily.map((day) => day.completed));
      const magnitude = 10 ** Math.floor(Math.log10(largest));
      const maximum = [1, 2, 5, 10].find((step) => step * magnitude >= largest)! * magnitude;
      const axis = document.createElement('div');
      axis.className = 'chart-axis';
      for (const value of [maximum, maximum / 2, 0]) {
        const tick = document.createElement('span');
        tick.textContent = value.toLocaleString('ko-KR');
        axis.append(tick);
      }
      const plot = document.createElement('div');
      plot.className = 'chart-plot';
      const grid = document.createElement('div');
      grid.className = 'chart-grid';
      for (let index = 0; index < 3; index++) {
        const line = document.createElement('span');
        line.className = 'chart-gridline';
        grid.append(line);
      }
      const columns = document.createElement('div');
      columns.className = 'chart-columns';
      for (const day of usage.data.daily) {
        const column = document.createElement('div');
        column.className = 'chart-column';
        const barArea = document.createElement('div');
        barArea.className = 'chart-bar-area';
        barArea.style.setProperty('--bar-height', `${(day.completed / maximum) * 100}%`);
        const bar = document.createElement('span');
        bar.className = 'chart-bar';
        bar.style.height = `${(day.completed / maximum) * 100}%`;
        bar.title = `${day.date}: ${day.completed}건`;
        const value = document.createElement('span');
        value.className = 'chart-value';
        value.textContent = day.completed.toLocaleString('ko-KR');
        const label = document.createElement('small');
        label.textContent = day.date.slice(5);
        barArea.append(bar, value);
        column.append(barArea, label);
        columns.append(column);
      }
      columns.prepend(grid);
      plot.append(columns);
      chart.append(axis, plot);
    } else {
      chart.classList.add('chart-empty');
      chart.textContent =
        usage.status === 'connection_required'
          ? '확장 사용량 연결 후 표시됩니다.'
          : usage.status === 'error'
            ? (usage.message ?? '실시간 통계를 가져오지 못했습니다.')
            : '표시할 조회 데이터가 없습니다.';
    }
  }
}

let requestSequence = 0;
const usageControlCleanups = new WeakMap<HTMLElement, () => void>();
const latestDashboardRequest = new WeakMap<HTMLElement, number>();
const latestLiveRequest = new WeakMap<HTMLElement, number>();
const latestLiveResult = new WeakMap<
  HTMLElement,
  { days: string; sequence: number; usage: Section<UsageMetrics> }
>();

export function connectUsageControl(root: HTMLElement): () => void {
  const checkbox = root.querySelector<HTMLInputElement>('#include-my-usage');
  const status = root.querySelector<HTMLElement>('#usage-control-status');
  if (!checkbox || !status) return () => {};

  let requestId = '';
  let timer: number | undefined;
  let savedValue: boolean | undefined;
  const send = (kind: 'get' | 'set', includeUsage?: boolean) => {
    requestId = crypto.randomUUID();
    checkbox.disabled = true;
    window.postMessage(
      { channel: 'drag-and-find-usage', kind, id: requestId, includeUsage },
      window.location.origin,
    );
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      checkbox.disabled = true;
      if (savedValue !== undefined) checkbox.checked = savedValue;
      status.textContent = '이 브라우저의 확장에 연결할 수 없습니다.';
    }, 2_000);
  };
  const onMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (typeof message !== 'object' || message === null || Array.isArray(message)) return;
    const { channel, kind, id, includeUsage } = message as Record<string, unknown>;
    if (channel !== 'drag-and-find-usage' || id !== requestId) return;
    if (kind !== 'state' && kind !== 'error') return;
    window.clearTimeout(timer);
    if (kind === 'state' && typeof includeUsage === 'boolean') {
      savedValue = includeUsage;
      checkbox.checked = includeUsage;
      checkbox.disabled = false;
      status.textContent = '변경하면 이후 조회부터 적용됩니다.';
    } else {
      if (savedValue !== undefined) checkbox.checked = savedValue;
      checkbox.disabled = savedValue === undefined;
      status.textContent = '설정을 저장하지 못했습니다.';
    }
  };
  const onChange = () => send('set', checkbox.checked);
  window.addEventListener('message', onMessage);
  checkbox.addEventListener('change', onChange);
  send('get');

  return () => {
    window.clearTimeout(timer);
    window.removeEventListener('message', onMessage);
    checkbox.removeEventListener('change', onChange);
  };
}

export async function loadDashboard(root: HTMLElement, days: 1 | 7 | 30): Promise<void> {
  const startedAt = ++requestSequence;
  latestDashboardRequest.set(root, startedAt);
  try {
    const response = await fetch(`/api/dashboard?days=${days}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as DashboardResponse;
    if (latestDashboardRequest.get(root) !== startedAt) return;
    usageControlCleanups.get(root)?.();
    renderDashboard(root, data);
    usageControlCleanups.set(root, connectUsageControl(root));
    const liveResult = latestLiveResult.get(root);
    if (liveResult?.days === String(days) && liveResult.sequence > startedAt)
      renderLiveUsage(root, liveResult.usage);
    root.querySelector<HTMLSelectElement>('#period')?.addEventListener('change', (event) => {
      void loadDashboard(root, Number((event.target as HTMLSelectElement).value) as 1 | 7 | 30);
    });
    root
      .querySelector<HTMLButtonElement>('#refresh')
      ?.addEventListener('click', () => void loadDashboard(root, days));
    void pollLiveUsage(root);
  } catch {
    if (latestDashboardRequest.get(root) !== startedAt) return;
    root.textContent = '통계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

export async function pollLiveUsage(root: HTMLElement): Promise<void> {
  const period = root.querySelector<HTMLSelectElement>('#period');
  if (!period || document.hidden) return;
  const days = period.value;
  const startedAt = ++requestSequence;
  latestLiveRequest.set(root, startedAt);
  try {
    const response = await fetch(`/api/live-usage?days=${days}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const usage = (await response.json()) as Section<UsageMetrics>;
    if (
      latestLiveRequest.get(root) === startedAt &&
      root.querySelector<HTMLSelectElement>('#period')?.value === days
    ) {
      latestLiveResult.set(root, { days, sequence: ++requestSequence, usage });
      renderLiveUsage(root, usage);
    }
  } catch {
    if (
      latestLiveRequest.get(root) === startedAt &&
      root.querySelector<HTMLSelectElement>('#period')?.value === days
    ) {
      const usage: Section<UsageMetrics> = {
        status: 'error',
        message: '실시간 통계를 가져오지 못했습니다.',
      };
      latestLiveResult.set(root, { days, sequence: ++requestSequence, usage });
      renderLiveUsage(root, usage);
    }
  }
}

export function startLiveUsagePolling(root: HTMLElement): () => void {
  const timer = window.setInterval(() => void pollLiveUsage(root), 15_000);
  return () => window.clearInterval(timer);
}

if (typeof document !== 'undefined') {
  const root = document.querySelector<HTMLElement>('#app');
  if (root) {
    if (import.meta.env.DEV) {
      void import('./preview').then(({ previewDashboard }) => {
        const showPreview = (days: 1 | 7 | 30) => {
          renderDashboard(root, previewDashboard(days));
          const banner = document.createElement('p');
          banner.className = 'preview-banner';
          banner.textContent = '미리보기 · 화면의 숫자는 예시 데이터입니다.';
          root.querySelector('.dashboard')?.prepend(banner);
          root.querySelector<HTMLSelectElement>('#period')?.addEventListener('change', (event) => {
            showPreview(Number((event.target as HTMLSelectElement).value) as 1 | 7 | 30);
          });
          root
            .querySelector<HTMLButtonElement>('#refresh')
            ?.addEventListener('click', () => showPreview(days));
        };
        showPreview(1);
      });
    } else {
      void loadDashboard(root, 1);
      startLiveUsagePolling(root);
    }
  }
}
