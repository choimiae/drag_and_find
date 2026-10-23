import { describe, it, expect } from 'vitest';
import { computeCardPlacement, computeIconPosition, type Viewport } from '../../../lib/ui/position';

const VIEWPORT: Viewport = { width: 1000, height: 800, scrollX: 0, scrollY: 0 };
const CARD = { width: 320, height: 200 };
const anchorAt = (top: number, left = 50) => ({ top, bottom: top + 20, left, right: left + 60 });

describe('computeCardPlacement', () => {
  it('places the card below the selection', () => {
    expect(computeCardPlacement(anchorAt(100), CARD, VIEWPORT)).toEqual({
      top: 128,
      left: 50,
      maxHeight: 200,
      placement: 'below',
    });
  });

  it('converts to document coordinates using the scroll offset', () => {
    const scrolled = { ...VIEWPORT, scrollX: 10, scrollY: 500 };

    expect(computeCardPlacement(anchorAt(100), CARD, scrolled)).toMatchObject({
      top: 628,
      left: 60,
    });
  });

  it('flips above when there is not enough room below', () => {
    expect(computeCardPlacement(anchorAt(700), CARD, VIEWPORT)).toEqual({
      top: 492,
      left: 50,
      maxHeight: 200,
      placement: 'above',
    });
  });

  it('pushes the card back inside the right edge', () => {
    expect(computeCardPlacement(anchorAt(100, 900), CARD, VIEWPORT).left).toBe(672);
  });

  it('pushes the card back inside the left edge', () => {
    expect(computeCardPlacement(anchorAt(100, -20), CARD, VIEWPORT).left).toBe(8);
  });

  it('shrinks the card when neither side has enough room', () => {
    const short = { ...VIEWPORT, height: 300 };

    expect(computeCardPlacement(anchorAt(140), CARD, short)).toEqual({
      top: 168,
      left: 50,
      maxHeight: 124,
      placement: 'below',
    });
  });

  it('never shrinks below the minimum height', () => {
    const tiny = { ...VIEWPORT, height: 150 };

    expect(computeCardPlacement(anchorAt(60), CARD, tiny).maxHeight).toBe(80);
  });
});

describe('computeIconPosition', () => {
  it('places the icon above and right of the selection end', () => {
    expect(computeIconPosition({ top: 100, bottom: 120, left: 50, right: 200 }, VIEWPORT)).toEqual({
      top: 68,
      left: 204,
    });
  });

  it('places the icon below when the selection is at the top edge', () => {
    expect(computeIconPosition({ top: 10, bottom: 30, left: 50, right: 200 }, VIEWPORT).top).toBe(
      34,
    );
  });

  it('keeps the icon inside the right edge', () => {
    expect(
      computeIconPosition({ top: 100, bottom: 120, left: 900, right: 990 }, VIEWPORT).left,
    ).toBe(964);
  });

  it('adds the scroll offset', () => {
    const scrolled = { ...VIEWPORT, scrollX: 5, scrollY: 300 };

    expect(computeIconPosition({ top: 100, bottom: 120, left: 50, right: 200 }, scrolled)).toEqual({
      top: 368,
      left: 209,
    });
  });
});
