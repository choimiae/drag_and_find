import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('관리자 화면 시작', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.resetModules();
  });

  it('처음 열면 오늘 기간을 선택한다', async () => {
    await import('../../../admin/src/main');

    await vi.waitFor(() => {
      expect(document.querySelector<HTMLSelectElement>('#period')?.value).toBe('1');
      expect(document.querySelectorAll('.chart-column')).toHaveLength(1);
    });
  });
});
