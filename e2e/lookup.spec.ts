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

test('조회 중 점 로딩을 보여 주고 응답이 오면 설명으로 바꾼다', async ({ page, context }) => {
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await context.route('https://lookup.example.test/lookup**', async (route) => {
    await pendingResponse;
    await route.fallback();
  });

  await openArticleAndLookUp(page, 'known');
  await expect(role(page, 'loading')).toHaveAttribute('role', 'status');
  await expect(role(page, 'loading')).toHaveText('뜻을 찾고 있어요');
  await expect(role(page, 'loading-dots').locator('span')).toHaveCount(3);

  releaseResponse();
  await expect(role(page, 'extract')).toContainText('신입 직원');
  await expect(role(page, 'loading')).toHaveCount(0);
});

test('Worker 요청 제한 시 위키백과를 직접 조회해 카드를 보여 준다', async ({ page, context }) => {
  let workerRequests = 0;
  let wikipediaRequests = 0;
  await context.route('https://lookup.example.test/lookup**', (route) => {
    workerRequests += 1;
    return route.fulfill({ status: 429, json: { status: 'rate_limited' } });
  });
  await context.route('https://ko.wikipedia.org/**', (route) => {
    wikipediaRequests += 1;
    return route.fulfill({
      json: {
        type: 'standard',
        title: '온보딩',
        extract: '온보딩은 신입 직원이 조직에 적응하도록 돕는 과정이다.',
        content_urls: {
          desktop: { page: 'https://ko.wikipedia.org/wiki/%EC%98%A8%EB%B3%B4%EB%94%A9' },
        },
      },
    });
  });

  await openArticleAndLookUp(page, 'known');

  await expect(role(page, 'title')).toHaveText('온보딩');
  await expect(role(page, 'extract')).toContainText('신입 직원');
  expect(workerRequests).toBe(1);
  expect(wikipediaRequests).toBe(1);
});

test('네이버 백과 결과는 네이버 출처와 원문 링크를 보여 준다', async ({ page }) => {
  await openArticleAndLookUp(page, 'naver-known');
  await expect(role(page, 'extract')).toContainText('학습과 추론');
  await expect(role(page, 'source-links').locator('a')).toHaveText(['네이버 백과 ↗', '위키백과 ↗']);
  await expect(role(page, 'source-link')).toHaveAttribute(
    'href',
    'https://terms.naver.com/entry.naver?docId=1',
  );
  await expect(role(page, 'attribution')).toContainText('네이버 백과');
});

test('뜻 상세에서 원래 뜻 목록과 스크롤 위치로 돌아간다', async ({ page }) => {
  await openArticleAndLookUp(page, 'many');
  await expect(role(page, 'meaning')).toHaveCount(10);
  const bodyScroll = await role(page, 'body').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  expect(bodyScroll).toBeGreaterThan(0);

  await role(page, 'meaning').last().click();
  await expect(role(page, 'title')).toHaveText('뜻 10');
  await expect(role(page, 'back-to-meanings')).toBeVisible();
  await role(page, 'back-to-meanings').click();

  await expect(role(page, 'title')).toHaveText('다의어');
  await expect(role(page, 'meaning')).toHaveCount(10);
  expect(await role(page, 'body').evaluate((element) => element.scrollTop)).toBe(bodyScroll);
  await expect(role(page, 'meaning').last()).toBeFocused();
});

test('위키백과에 없는 단어는 안내 문구와 직접 찾기 탭을 보여 준다', async ({ page }) => {
  await openArticleAndLookUp(page, 'unknown');

  await expect(role(page, 'body')).toHaveText('네이버 백과와 위키백과에 결과가 없습니다');
  await expect(role(page, 'manual-tab')).toBeVisible();
  await role(page, 'manual-tab').click();
  await expect(role(page, 'google')).toBeVisible();
  await expect(role(page, 'naver')).toBeVisible();
});

test('구글·네이버 링크는 직접 입력한 단어로 검색한 새 탭을 연다', async ({ page, context }) => {
  await openArticleAndLookUp(page, 'known');
  await role(page, 'manual-tab').click();
  await role(page, 'search-input').fill('챗GPT 뜻');

  const [google] = await Promise.all([context.waitForEvent('page'), role(page, 'google').click()]);
  await expect(google).toHaveURL('https://www.google.com/search?q=%EC%B1%97GPT%20%EB%9C%BB');

  const [naver] = await Promise.all([context.waitForEvent('page'), role(page, 'naver').click()]);
  await expect(naver).toHaveURL(
    'https://search.naver.com/search.naver?query=%EC%B1%97GPT%20%EB%9C%BB',
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

test('Task의 같은 이름을 가진 뜻들을 설명으로 구분해 보여 준다', async ({ page }) => {
  await openArticleAndLookUp(page, 'task');

  await expect(role(page, 'meaning')).toHaveCount(2);
  await expect(role(page, 'meaning-description')).toHaveText([
    '컴퓨팅에서의 명령 실행 문맥',
    '미국 드라마',
  ]);
});

test('이름이 같은 위키데이터 뜻은 각자의 원문을 연다', async ({ page, context }) => {
  await openArticleAndLookUp(page, 'poc');

  const links = role(page, 'meaning-source-link');
  await expect(links).toHaveCount(2);
  await expect(role(page, 'meaning-description')).toHaveText(['개념 증명', '다른 분야의 약어']);

  const [first] = await Promise.all([context.waitForEvent('page'), links.nth(0).click()]);
  await expect(first).toHaveURL('https://www.wikidata.org/wiki/Q101');

  await page.bringToFront();
  const [second] = await Promise.all([context.waitForEvent('page'), links.nth(1).click()]);
  await expect(second).toHaveURL('https://www.wikidata.org/wiki/Q202');
});

test('긴 뜻 목록은 본문 한 곳에서만 스크롤하고 출처와 헤더 탭은 보인다', async ({ page }) => {
  await openArticleAndLookUp(page, 'many');

  const list = role(page, 'meanings');
  await expect(role(page, 'meaning')).toHaveCount(10);
  expect(
    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    }),
  ).toBe(0);
  const body = role(page, 'body');
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(role(page, 'meaning').last()).toBeVisible();
  await expect(role(page, 'title')).toHaveText('다의어');
  await expect(role(page, 'wiki-link')).toBeVisible();
  await expect(role(page, 'attribution')).toContainText('위키백과 설명 일부');
  await expect(role(page, 'manual-tab')).toBeVisible();

  await role(page, 'meaning').last().click();
  await expect(role(page, 'title')).toHaveText('뜻 10');
  await expect(role(page, 'extract')).toContainText('열 번째 뜻');
});

test('좁은 화면에서도 출처와 헤더 탭은 카드에 보인다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 320 });
  await openArticleAndLookUp(page, 'many');

  await expect(role(page, 'meaning')).toHaveCount(10);
  await expect(role(page, 'wiki-link')).toBeInViewport();
  await expect(role(page, 'attribution')).toBeInViewport();
  await expect(role(page, 'manual-tab')).toBeInViewport();
});

test('좁은 화면에서 직접 찾기로 전환해도 조회 버튼이 보인다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 320 });
  await openArticleAndLookUp(page, 'known');
  await role(page, 'manual-tab').click();

  await expect(role(page, 'search-input')).toBeInViewport();
  await expect(role(page, 'lookup-action')).toBeInViewport();
  await expect(role(page, 'google')).toBeInViewport();
  await expect(role(page, 'naver')).toBeInViewport();
});

test('짧은 결과에서 직접 찾기로 전환해도 하단 검색 링크가 잘리지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 320 });
  await openArticleAndLookUp(page, 'unknown');
  await role(page, 'manual-tab').click();

  await expect(role(page, 'lookup-action')).toBeInViewport();
  await expect(role(page, 'google')).toBeInViewport();
  await expect(role(page, 'naver')).toBeInViewport();
});

test('직접 찾기 입력 오류가 나타나도 하단 검색 링크가 잘리지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 320 });
  await openArticleAndLookUp(page, 'unknown');
  await role(page, 'manual-tab').click();
  await role(page, 'search-input').fill('가'.repeat(51));
  await role(page, 'lookup-action').click();

  await expect(role(page, 'search-error')).toContainText('50자');
  await expect(role(page, 'google')).toBeInViewport();
  await expect(role(page, 'naver')).toBeInViewport();
});

test('문맥상 뜻을 누르면 그 뜻의 요약으로 카드가 바뀐다', async ({ page }) => {
  await openArticleAndLookUp(page, 'ambiguous');
  await expect(role(page, 'suggestion')).toBeVisible();

  await role(page, 'suggestion').click();

  await expect(role(page, 'title')).toHaveText('데이터베이스 트리거');
  await expect(role(page, 'extract')).toContainText('자동으로 실행되는 절차');
});

test('문장으로 쓰인 다른 뜻을 누르면 그 문서의 요약으로 바뀐다', async ({ page }) => {
  await openArticleAndLookUp(page, 'ambiguous');

  await role(page, 'meanings')
    .locator('[data-role="meaning"]', { hasText: '총의 방아쇠를 가리킨다' })
    .click();

  await expect(role(page, 'title')).toHaveText('방아쇠');
  await expect(role(page, 'extract')).toContainText('격발 장치');
});

test('기본 테마는 크롬 설정 따라가기다', async ({ page }) => {
  await page.goto(ARTICLE_URL);
  await page.locator('#known').dblclick();
  await expect(role(page, 'icon')).toBeVisible();

  await expect(page.locator('drag-and-find-root')).toHaveAttribute('data-theme', 'auto');
});

test('설정에서 어둡게를 고르면 이미 열린 탭의 카드도 바로 어두워진다', async ({
  page,
  context,
  extensionId,
  serviceWorker,
}) => {
  await page.goto(ARTICLE_URL);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);

  await options.locator('label[for="theme-dark"]').click();
  await expect
    .poll(() =>
      serviceWorker.evaluate(
        `chrome.storage.local.get('settings').then((stored) => stored.settings?.theme)`,
      ),
    )
    .toBe('dark');

  await page.bringToFront();
  await page.locator('#known').dblclick();
  await expect(role(page, 'icon')).toBeVisible();
  await expect(page.locator('drag-and-find-root')).toHaveAttribute('data-theme', 'dark');
});

test('직접 찾기에서 Enter를 누르면 고친 단어의 뜻을 카드에서 찾는다', async ({ page, context }) => {
  await openArticleAndLookUp(page, 'known');
  await role(page, 'manual-tab').click();

  await role(page, 'search-input').fill('인공지능');
  const before = context.pages().length;
  await role(page, 'search-input').press('Enter');

  await expect(role(page, 'title')).toHaveText('인공지능');
  await expect(role(page, 'extract')).toContainText('학습과 추론');
  await expect(role(page, 'result-tab')).toHaveAttribute('aria-selected', 'true');
  expect(context.pages()).toHaveLength(before);
});

test('옵션 화면에는 Enter 검색 사이트 설정이 없다', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.locator('#search-engine')).toHaveCount(0);
});

test('검색어 칸에 글자를 쳐도 페이지 단축키가 실행되지 않는다', async ({ page }) => {
  await openArticleAndLookUp(page, 'unknown');
  await role(page, 'manual-tab').click();

  await page.evaluate(() => {
    const counter = window as unknown as { keyCount: number };
    counter.keyCount = 0;
    document.addEventListener('keydown', () => counter.keyCount++);
  });
  const keyCount = () => page.evaluate(() => (window as unknown as { keyCount: number }).keyCount);
  // 리스너가 실제로 붙었는지 먼저 확인한다 (입력칸 밖에서는 센다).
  await page.locator('body').press('k');
  expect(await keyCount()).toBe(1);

  await role(page, 'search-input').press('k');
  expect(await keyCount()).toBe(1);

  await role(page, 'search-input').press('Escape');
  await expect(role(page, 'card')).toHaveCount(0);
});

test('검색어 칸 안에서 글을 끌어 선택해도 그 글로 아이콘이 뜨지 않는다', async ({ page }) => {
  await openArticleAndLookUp(page, 'unknown');
  await role(page, 'manual-tab').click();
  const box = await role(page, 'search-input').boundingBox();
  if (!box) throw new Error('검색어 칸을 찾지 못했습니다');

  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2, { steps: 5 });
  await page.mouse.move(5, 5, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  await expect(role(page, 'icon')).toHaveCount(0);
});

test('검색어 칸에서 글을 고른 채 단축키를 눌러도 새로 찾지 않는다', async ({
  page,
  serviceWorker,
}) => {
  await openArticleAndLookUp(page, 'unknown');
  await expect(role(page, 'title')).toHaveText('갓생');
  await role(page, 'manual-tab').click();
  await role(page, 'search-input').fill('다른 말');
  await role(page, 'search-input').selectText();

  await serviceWorker.evaluate(
    `chrome.tabs.query({}).then((tabs) => Promise.allSettled(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: 'trigger-from-shortcut' }))))`,
  );
  await page.waitForTimeout(500);

  await expect(role(page, 'title')).toHaveText('갓생');
});
