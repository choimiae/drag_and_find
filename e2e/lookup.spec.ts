import type { Page } from '@playwright/test';
import { ARTICLE_URL, FRAME_HOST_URL, expect, test } from './fixtures';

const role = (page: Page, name: string) => page.locator(`[data-role="${name}"]`);

async function openArticleAndLookUp(page: Page, wordId: string): Promise<void> {
  await page.goto(ARTICLE_URL);
  await page.locator(`#${wordId}`).dblclick();
  await role(page, 'icon').click();
}

test('드래그 후 아이콘을 누르면 위키백과 요약 카드가 뜬다', async ({ page }) => {
  await openArticleAndLookUp(page, 'known');

  await expect(role(page, 'title')).toHaveText('온보딩');
  await expect(role(page, 'extract')).toContainText('신입 직원');
  await expect(role(page, 'wiki-link')).toHaveAttribute(
    'href',
    'https://ko.wikipedia.org/wiki/%EC%98%A8%EB%B3%B4%EB%94%A9',
  );
});

test('위키백과에 없는 단어는 안내 문구와 검색 버튼을 보여 준다', async ({ page }) => {
  await openArticleAndLookUp(page, 'unknown');

  await expect(role(page, 'body')).toHaveText('위키백과에 문서가 없습니다');
  await expect(role(page, 'google')).toBeVisible();
  await expect(role(page, 'naver')).toBeVisible();
});

test('구글·네이버 버튼은 선택한 단어로 검색한 새 탭을 연다', async ({ page, context }) => {
  await openArticleAndLookUp(page, 'known');

  const [google] = await Promise.all([context.waitForEvent('page'), role(page, 'google').click()]);
  await expect(google).toHaveURL('https://www.google.com/search?q=%EC%98%A8%EB%B3%B4%EB%94%A9');

  const [naver] = await Promise.all([context.waitForEvent('page'), role(page, 'naver').click()]);
  await expect(naver).toHaveURL(
    'https://search.naver.com/search.naver?query=%EC%98%A8%EB%B3%B4%EB%94%A9',
  );
});

test('Esc와 바깥 클릭으로 카드가 닫힌다', async ({ page }) => {
  await openArticleAndLookUp(page, 'known');
  await expect(role(page, 'card')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(role(page, 'card')).toHaveCount(0);

  await page.locator('#known').dblclick();
  await role(page, 'icon').click();
  await expect(role(page, 'card')).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(role(page, 'card')).toHaveCount(0);
});

test('단축키 알림을 받으면 현재 선택으로 찾는다', async ({ page, serviceWorker }) => {
  await page.goto(ARTICLE_URL);
  await page.locator('#known').dblclick();

  await serviceWorker.evaluate(
    `chrome.tabs.query({}).then((tabs) => Promise.allSettled(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: 'trigger-from-shortcut' }))))`,
  );

  await expect(role(page, 'title')).toHaveText('온보딩');
});

test('설정 화면에 단축키가 표시되고, 아이콘을 끄면 드래그해도 아이콘이 뜨지 않는다', async ({
  page,
  extensionId,
  serviceWorker,
}) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.locator('#shortcut')).toHaveText(/F$/);
  await page.locator('#show-icon').uncheck();
  await expect
    .poll(() =>
      serviceWorker.evaluate(
        `chrome.storage.local.get('settings').then((stored) => stored.settings?.showIcon)`,
      ),
    )
    .toBe(false);

  await page.goto(ARTICLE_URL);
  await page.locator('#known').dblclick();
  // 아이콘이 "안 뜬다"를 확인하려면 판정(설정 읽기 포함)이 끝날 시간을 줘야 한다.
  await page.waitForTimeout(500);

  await expect(role(page, 'icon')).toHaveCount(0);
});

test('글이 내부 프레임에 있어도 드래그 후 아이콘을 누르면 카드가 뜬다', async ({ page }) => {
  await page.goto(FRAME_HOST_URL);
  const frame = page.frameLocator('iframe');

  await frame.locator('#known').dblclick();
  await frame.locator('[data-role="icon"]').click();

  await expect(frame.locator('[data-role="title"]')).toHaveText('온보딩');
});

test('뜻이 여러 개인 단어는 문맥상 뜻과 다른 뜻 목록을 보여 준다', async ({ page }) => {
  await openArticleAndLookUp(page, 'ambiguous');

  await expect(role(page, 'title')).toHaveText('트리거');
  await expect(role(page, 'suggestion')).toHaveText('데이터베이스 트리거');
  await expect(role(page, 'basic')).toContainText('총의 방아쇠');
  await expect(role(page, 'meanings')).toContainText('트리거 (애니메이션 제작사)');
});

test('문맥상 뜻을 누르면 그 뜻의 요약으로 카드가 바뀐다', async ({ page }) => {
  await openArticleAndLookUp(page, 'ambiguous');
  await expect(role(page, 'suggestion')).toBeVisible();

  await role(page, 'suggestion').click();

  await expect(role(page, 'title')).toHaveText('데이터베이스 트리거');
  await expect(role(page, 'extract')).toContainText('자동으로 실행되는 절차');
});
