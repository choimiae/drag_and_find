import { renderCard, type CardHandlers, type CardState } from './card';
import { computeCardPlacement, computeIconPosition, type Rect, type Viewport } from './position';
import { DEFAULT_SETTINGS, type ThemeSetting } from '../settings';
import { OVERLAY_CSS } from './styles';

export const HOST_TAG = 'drag-and-find-root';
const SVG_NS = 'http://www.w3.org/2000/svg';
const TOP_LAYER_Z_INDEX = '2147483647';

/** 문서 기준 사각형(화면 좌표 + 스크롤). `Rect`(화면 기준)와 섞이지 않게 이름을 구분한다. */
export interface DocumentRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface Overlay {
  showIcon(anchor: DocumentRect, onActivate: () => void): void;
  hideIcon(): void;
  showCard(anchor: DocumentRect, query: string, state: CardState, handlers: CardHandlers): void;
  hideCard(): void;
  contains(event: Event): boolean;
  setTheme(theme: ThemeSetting): void;
}

/** 페이지 CSS와 격리된 Shadow DOM에 아이콘과 카드를 문서 좌표로 띄운다. */
export function createOverlay(doc: Document, win: Window): Overlay {
  const host = doc.createElement(HOST_TAG);
  Object.assign(host.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '0',
    height: '0',
    zIndex: TOP_LAYER_Z_INDEX,
  });
  host.dataset.theme = DEFAULT_SETTINGS.theme;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = OVERLAY_CSS;
  shadow.append(style);

  let icon: HTMLElement | null = null;
  let card: HTMLElement | null = null;

  const viewport = (): Viewport => ({
    width: win.innerWidth,
    height: win.innerHeight,
    scrollX: win.scrollX,
    scrollY: win.scrollY,
  });

  // 앵커는 문서 좌표로 받는다. 그 사이 스크롤됐어도 현재 스크롤을 빼 화면 좌표로 바꿔야 단어 옆에 놓인다.
  const toViewportRect = (anchor: DocumentRect): Rect => ({
    top: anchor.top - win.scrollY,
    bottom: anchor.bottom - win.scrollY,
    left: anchor.left - win.scrollX,
    right: anchor.right - win.scrollX,
  });

  const mount = () => {
    if (!host.isConnected) doc.documentElement.append(host);
  };

  const place = (target: HTMLElement, top: number, left: number) => {
    target.style.top = `${top}px`;
    target.style.left = `${left}px`;
  };

  return {
    showIcon(anchor, onActivate) {
      mount();
      icon?.remove();
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'icon';
      button.dataset.role = 'icon';
      button.setAttribute('aria-label', '선택한 단어 찾기');
      button.append(magnifierIcon(doc));
      button.addEventListener('click', onActivate);
      const position = computeIconPosition(toViewportRect(anchor), viewport());
      place(button, position.top, position.left);
      shadow.append(button);
      icon = button;
    },
    hideIcon() {
      icon?.remove();
      icon = null;
    },
    showCard(anchor, query, state, handlers) {
      mount();
      if (!card) {
        card = doc.createElement('section');
        card.className = 'card';
        card.dataset.role = 'card';
        shadow.append(card);
      }
      renderCard(card, query, state, handlers);
      card.style.maxHeight = '';
      const size = { width: card.offsetWidth, height: card.offsetHeight };
      const placement = computeCardPlacement(toViewportRect(anchor), size, viewport());
      place(card, placement.top, placement.left);
      card.style.maxHeight = `${placement.maxHeight}px`;
    },
    hideCard() {
      card?.remove();
      card = null;
    },
    contains(event) {
      return event.composedPath().includes(host);
    },
    setTheme(theme) {
      host.dataset.theme = theme;
    },
  };
}

/** 흰 돋보기 선 아이콘. 이모지는 운영체제마다 모양이 달라 SVG로 그린다. */
function magnifierIcon(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  setAttributes(svg, {
    width: '14',
    height: '14',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: '#ffffff',
    'stroke-width': '3',
    'stroke-linecap': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const lens = doc.createElementNS(SVG_NS, 'circle');
  setAttributes(lens, { cx: '10.5', cy: '10.5', r: '6.5' });
  const handle = doc.createElementNS(SVG_NS, 'path');
  setAttributes(handle, { d: 'M15.5 15.5 21 21' });
  svg.append(lens, handle);
  return svg;
}

function setAttributes(target: Element, attributes: Record<string, string>): void {
  for (const [name, value] of Object.entries(attributes)) target.setAttribute(name, value);
}
