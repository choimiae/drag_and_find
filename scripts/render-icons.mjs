// 확장 아이콘 원본(assets/icon.svg)을 public/icon/<크기>.png로 찍는다.
// 아이콘을 바꿀 때만 돌린다: pnpm icons
import { readFile } from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SIZES = [16, 32, 48, 96, 128];
// 작은 크기에서는 돋보기 선이 뭉개지지 않도록 더 굵게 그린다.
const STROKE_BY_SIZE = { 16: '3.6', 32: '3.1' };
const DEFAULT_STROKE = '2.6';
// 웹스토어는 128px 아이콘에서 지름 약 112px 원 + 둘레 투명 여백을 요구한다.
const STORE_SIZE = 128;
const STORE_ARTWORK_SIZE = 112;
const STROKE_ATTRIBUTE = 'stroke-width="2.6"';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('assets/icon.svg', root), 'utf8');

if (!source.includes(STROKE_ATTRIBUTE)) {
  throw new Error(
    `assets/icon.svg에서 ${STROKE_ATTRIBUTE}를 찾지 못했습니다. 선 굵기 치환이 동작하지 않습니다.`,
  );
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const size of SIZES) {
    const artworkSize = size === STORE_SIZE ? STORE_ARTWORK_SIZE : size;
    const padding = (size - artworkSize) / 2;
    const svg = source
      .replace(STROKE_ATTRIBUTE, `stroke-width="${STROKE_BY_SIZE[size] ?? DEFAULT_STROKE}"`)
      .replace('<svg ', `<svg width="${artworkSize}" height="${artworkSize}" `);
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;padding:${padding}px;background:transparent">${svg}</body></html>`,
    );
    await page.screenshot({
      path: fileURLToPath(new URL(`public/icon/${size}.png`, root)),
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}
