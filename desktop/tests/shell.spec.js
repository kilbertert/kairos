const { test, expect } = require('@playwright/test');

// The desktop shell is the web build with two differences: no service worker,
// and a real `/app` entry point (on the web that path is a server rewrite, or a
// service-worker navigation fallback that is gone once the worker is gone).
//
// These assertions load `/app`, not `/`, because `/app` is what the shell loads
// (manifest.json's start_url) and the path most likely to break. Everything else
// about the application is the web suite's job.

const ENTRY = '/app';
const APP_READY = '#app:not(.hidden)';

test.describe('桌面壳构建产物', () => {
  test.beforeEach(async ({ page }) => {
    const swRequests = [];
    page.on('request', req => {
      if (new URL(req.url()).pathname === '/sw.js') swRequests.push(req.url());
    });
    page.__swRequests = swRequests;
  });

  test('入口点 /app 能加载应用', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto(ENTRY);
    await page.waitForSelector(APP_READY, { timeout: 10000 });

    await expect(page.locator('#app')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('不注册 service worker，也不请求 sw.js', async ({ page }) => {
    await page.goto(ENTRY);
    await page.waitForSelector(APP_READY, { timeout: 10000 });

    const controller = await page.evaluate(() => globalThis.navigator.serviceWorker?.controller ?? null);
    expect(controller).toBeNull();

    const registrations = await page.evaluate(async () =>
      'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0
    );
    expect(registrations).toBe(0);
    expect(page.__swRequests).toEqual([]);
  });

  // Mirrors tests/local-storage.spec.js's persistence check, which already passes
  // against the dev server. The task title is asserted after the reload rather
  // than the project name: after a restart the app opens on the focus view, where
  // a task is offered by name but its project is not rendered.
  test('从 /app 创建的数据在刷新后仍然存在', async ({ page }) => {
    await page.goto(ENTRY);
    await page.waitForSelector(APP_READY, { timeout: 10000 });

    await page.getByRole('button', { name: '项目', exact: true }).click();
    await page.getByRole('button', { name: '新建项目', exact: true }).click();
    await page.getByRole('textbox', { name: '项目名称', exact: true }).fill('Desktop shell check');
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await page.getByRole('heading', { name: 'Desktop shell check', exact: true }).click();
    await page.getByRole('button', { name: '+ 添加任务', exact: true }).click();
    await page.getByRole('textbox', { name: '任务标题', exact: true }).fill('Survives a restart');
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Survives a restart', exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText('Survives a restart', { exact: true }).filter({ visible: true })).toBeVisible();
  });

  test('入口点引用的资源全部能取到', async ({ page }) => {
    // Guards the mistake this suite was written in response to: markup references
    // left relative resolve against the entry point's directory and 404 there.
    // The logos shipped broken until a request log happened to show it.
    const failed = [];
    page.on('response', res => {
      if (res.status() >= 400 && new URL(res.url()).pathname !== '/sw.js') failed.push(`${res.status()} ${res.url()}`);
    });

    await page.goto(ENTRY);
    await page.waitForSelector(APP_READY, { timeout: 10000 });
    await page.waitForLoadState('load');

    expect(failed).toEqual([]);
  });

  test('构建产物里没有 sw.js', async ({ request }) => {
    const response = await request.get('/sw.js');
    expect(response.status()).toBe(404);
  });
});
