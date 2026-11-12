import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('관리자 초기 로딩', () => {
  it('통계를 가져오는 동안 카드와 같은 세 점과 상태 문구를 보여 준다', () => {
    const html = readFileSync(resolve('admin/index.html'), 'utf8');
    const page = new DOMParser().parseFromString(
      html.replace(/<link rel="stylesheet"[^>]*>/, ''),
      'text/html',
    );
    const loading = page.querySelector('#app [role="status"]');

    expect(loading).not.toBeNull();
    expect(loading?.querySelector('[aria-hidden="true"]')?.children).toHaveLength(3);
    expect(loading?.textContent).toContain('통계를 불러오고 있어요');
    expect(page.querySelector('#app')?.textContent).not.toContain('통계를 불러오는 중입니다.');
  });
});
