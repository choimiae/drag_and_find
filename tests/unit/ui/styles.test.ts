import { describe, it, expect } from 'vitest';
import { OVERLAY_CSS } from '../../../lib/ui/styles';

describe('OVERLAY_CSS', () => {
  it('키보드 포커스 윤곽선을 지우지 않는다', () => {
    expect(OVERLAY_CSS).not.toContain('outline: none');
  });

  it('카드 안 버튼과 링크에 공통 포커스 윤곽선이 있다', () => {
    expect(OVERLAY_CSS).toContain('.card button:focus-visible');
  });

  it('카드 본문만 스크롤되고 머리글·버튼 줄은 고정된다', () => {
    expect(OVERLAY_CSS).toMatch(/\.card-body \{[^}]*overflow: auto/);
    expect(OVERLAY_CSS).toMatch(/\.card \{[^}]*flex-direction: column/);
    expect(OVERLAY_CSS).toMatch(/\.card \{[^}]*overflow: hidden/);
  });

  it('본문 스크롤바를 얇게 늘 보이도록 꾸민다', () => {
    expect(OVERLAY_CSS).toContain('.card-body::-webkit-scrollbar');
    expect(OVERLAY_CSS).toContain('--dnf-scrollbar: #c4cad2');
    expect(OVERLAY_CSS).toContain('--dnf-scrollbar: #4a5360');
  });

  it('표준 스크롤바 속성은 쓰지 않는다 (웹킷 꾸밈을 덮어쓰기 때문)', () => {
    expect(OVERLAY_CSS).not.toContain('scrollbar-color');
    expect(OVERLAY_CSS).not.toContain('scrollbar-width');
  });
});
