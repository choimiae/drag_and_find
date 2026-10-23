import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HOST_TAG, createOverlay } from '../../../lib/ui/overlay';

const ANCHOR = { top: 100, bottom: 120, left: 50, right: 110 };
const handlers = () => ({ onClose: vi.fn(), onRetry: vi.fn() });

beforeEach(() => {
  document.querySelectorAll(HOST_TAG).forEach((host) => host.remove());
});

const host = () => document.querySelector(HOST_TAG) as HTMLElement | null;
const inShadow = (role: string) =>
  host()?.shadowRoot?.querySelector<HTMLElement>(`[data-role="${role}"]`) ?? null;

describe('createOverlay', () => {
  it('mounts a single shadow host on the html element at the top layer', () => {
    const overlay = createOverlay(document, window);

    overlay.showIcon(ANCHOR, vi.fn());
    overlay.showCard(ANCHOR, '온보딩', { kind: 'loading' }, handlers());

    expect(document.querySelectorAll(HOST_TAG)).toHaveLength(1);
    expect(host()?.parentElement).toBe(document.documentElement);
    expect(host()?.shadowRoot).not.toBeNull();
    expect(host()?.style.zIndex).toBe('2147483647');
  });

  it('shows an icon at document coordinates that runs the callback when clicked', () => {
    const overlay = createOverlay(document, window);
    const onActivate = vi.fn();

    overlay.showIcon(ANCHOR, onActivate);
    const icon = inShadow('icon');

    expect(icon?.style.top).toBe('68px');
    expect(icon?.style.left).toBe('114px');
    icon?.click();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('keeps only one icon', () => {
    const overlay = createOverlay(document, window);

    overlay.showIcon(ANCHOR, vi.fn());
    overlay.showIcon(ANCHOR, vi.fn());

    expect(host()?.shadowRoot?.querySelectorAll('[data-role="icon"]')).toHaveLength(1);
  });

  it('removes the icon', () => {
    const overlay = createOverlay(document, window);

    overlay.showIcon(ANCHOR, vi.fn());
    overlay.hideIcon();

    expect(inShadow('icon')).toBeNull();
  });

  it('places the card below the selection and reuses it on update', () => {
    const overlay = createOverlay(document, window);

    overlay.showCard(ANCHOR, '온보딩', { kind: 'loading' }, handlers());
    overlay.showCard(
      ANCHOR,
      '온보딩',
      { kind: 'result', result: { status: 'not_found' } },
      handlers(),
    );

    const cards = host()?.shadowRoot?.querySelectorAll('[data-role="card"]');
    expect(cards).toHaveLength(1);
    expect(inShadow('card')?.style.top).toBe('128px');
    expect(inShadow('card')?.style.left).toBe('50px');
    expect(inShadow('body')?.textContent).toBe('위키백과에 문서가 없습니다');
  });

  it('removes the card', () => {
    const overlay = createOverlay(document, window);

    overlay.showCard(ANCHOR, '온보딩', { kind: 'loading' }, handlers());
    overlay.hideCard();

    expect(inShadow('card')).toBeNull();
  });

  it('tells whether an event happened inside the overlay', () => {
    const overlay = createOverlay(document, window);
    overlay.showIcon(ANCHOR, vi.fn());
    const seen: boolean[] = [];
    document.addEventListener('mousedown', (event) => seen.push(overlay.contains(event)), {
      capture: true,
      once: true,
    });

    inShadow('icon')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(seen).toEqual([true]);
    expect(overlay.contains(new MouseEvent('mousedown'))).toBe(false);
  });
});
