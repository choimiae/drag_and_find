// 확장 아이콘 원본(assets/icon.svg)을 public/icon/<크기>.png로 찍는다.
// 아이콘을 바꿀 때만 돌린다: pnpm icons
import { readFile } from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SIZES = [16, 32, 48, 96, 128];
// 작은 크기에서는 돋보기 선이 뭉개지지 않도록 더 굵게 그린다.
const STROKE_BY_SIZE = { 16: '3.6', 32: '3.1' };
const DEFAULT_STROKE = '2.6';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('assets/icon.svg', root), 'utf8');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const size of SIZES) {
    const svg = source
      .replace('stroke-width="2.6"', `stroke-width="${STROKE_BY_SIZE[size] ?? DEFAULT_STROKE}"`)
      .replace('<svg ', `<svg width="${size}" height="${size}" `);
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg}</body></html>`,
    );
    await page.screenshot({
      path: fileURLToPath(new URL(`public/icon/${size}.png`, root)),
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}
