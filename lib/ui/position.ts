export const CARD_GAP = 8;
export const VIEWPORT_MARGIN = 8;
export const MIN_CARD_HEIGHT = 200;
export const ICON_SIZE = 28;
export const ICON_GAP = 4;

/** 화면(뷰포트) 기준 사각형. */
export interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface Viewport {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

export interface CardSize {
  width: number;
  height: number;
}

/** 문서 기준 좌표. 문서 좌표로 두면 스크롤해도 선택한 단어를 따라간다. */
export interface CardPlacement {
  top: number;
  left: number;
  maxHeight: number;
  placement: 'below' | 'above';
}

/** 카드를 선택 아래에 두되, 공간이 부족하면 위로 뒤집고 좌우·높이를 화면 안으로 맞춘다. */
export function computeCardPlacement(
  anchor: Rect,
  card: CardSize,
  viewport: Viewport,
): CardPlacement {
  const spaceBelow = viewport.height - anchor.bottom - CARD_GAP - VIEWPORT_MARGIN;
  const spaceAbove = anchor.top - CARD_GAP - VIEWPORT_MARGIN;
  const placeBelow = card.height <= spaceBelow || spaceBelow >= spaceAbove;
  const available = placeBelow ? spaceBelow : spaceAbove;
  const height = Math.min(card.height, Math.max(available, MIN_CARD_HEIGHT));
  const top = placeBelow ? anchor.bottom + CARD_GAP : anchor.top - CARD_GAP - height;
  const left = clamp(anchor.left, VIEWPORT_MARGIN, viewport.width - VIEWPORT_MARGIN - card.width);
  return {
    top: top + viewport.scrollY,
    left: left + viewport.scrollX,
    maxHeight: height,
    placement: placeBelow ? 'below' : 'above',
  };
}

/** 아이콘을 선택 끝의 오른쪽 위에 두고, 위쪽이 막히면 아래로 내린다. */
export function computeIconPosition(
  anchor: Rect,
  viewport: Viewport,
): { top: number; left: number } {
  const aboveTop = anchor.top - ICON_SIZE - ICON_GAP;
  const top = aboveTop >= 0 ? aboveTop : anchor.bottom + ICON_GAP;
  const left = Math.min(anchor.right + ICON_GAP, viewport.width - VIEWPORT_MARGIN - ICON_SIZE);
  return { top: top + viewport.scrollY, left: left + viewport.scrollX };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
