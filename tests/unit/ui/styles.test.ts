import { describe, it, expect } from 'vitest';
import { OVERLAY_CSS } from '../../../lib/ui/styles';

describe('OVERLAY_CSS', () => {
  it('키보드 포커스 윤곽선을 지우지 않는다', () => {
    expect(OVERLAY_CSS).not.toContain('outline: none');
  });

  it('카드 안 버튼과 링크에 공통 포커스 윤곽선이 있다', () => {
    expect(OVERLAY_CSS).toContain('.card button:focus-visible');
  });
});
