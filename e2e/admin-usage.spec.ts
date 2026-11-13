import { expect, test } from './fixtures';

const ADMIN_URL = 'https://drag-and-find-admin.maestro001220.workers.dev/';

test('관리자 페이지에서 이 브라우저의 이후 조회 통계 포함 여부를 바꾼다', async ({
  page,
  context,
  serviceWorker,
}) => {
  await context.route(ADMIN_URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>관리자</title>' }),
  );
  await page.goto(ADMIN_URL);

  await page.evaluate(() =>
    window.postMessage(
      { channel: 'drag-and-find-usage', kind: 'set', id: 'test-off', includeUsage: false },
      location.origin,
    ),
  );
  await expect
    .poll(() =>
      serviceWorker.evaluate(
        `chrome.storage.local.get('includeUsage').then((saved) => saved.includeUsage)`,
      ),
    )
    .toBe(false);

  await page.evaluate(() =>
    window.postMessage(
      { channel: 'drag-and-find-usage', kind: 'set', id: 'test-on', includeUsage: true },
      location.origin,
    ),
  );
  await expect
    .poll(() =>
      serviceWorker.evaluate(
        `chrome.storage.local.get('includeUsage').then((saved) => saved.includeUsage)`,
      ),
    )
    .toBe(true);
});
