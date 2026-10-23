import { renderCard, type CardHandlers, type CardState } from './card';
import { computeCardPlacement, computeIconPosition, type Rect, type Viewport } from './position';
import { OVERLAY_CSS } from './styles';

export const HOST_TAG = 'drag-and-find-root';
const TOP_LAYER_Z_INDEX = '2147483647';

export interface Overlay {
  showIcon(anchor: Rect, onActivate: () => void): void;
  hideIcon(): void;
  showCard(anchor: Rect, query: string, state: CardState, handlers: CardHandlers): void;
  hideCard(): void;
  contains(event: Event): boolean;
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
      button.textContent = '🔍';
      button.addEventListener('click', onActivate);
      const position = computeIconPosition(anchor, viewport());
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
      const placement = computeCardPlacement(anchor, size, viewport());
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
  };
}
