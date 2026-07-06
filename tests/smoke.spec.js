// 冒煙測試：每條路由渲染成功、每篇文章打得開、404 與轉址行為正確。
// 資料驅動 — 從 posts.json 讀 published 文章，新增文章不用改測試。

const { test, expect } = require("@playwright/test");
const posts = require("../content/posts.json")
  .posts.filter((p) => p.status === "published")
  .sort((a, b) => (b.date || "").localeCompare(a.date || "")); // 同站上順序：最新在前

test("首頁：hero 與所有 published 文章卡片", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero__title")).toHaveText("QA 筆記");
  await expect(page.locator(".post-card")).toHaveCount(posts.length);
});

for (const p of posts) {
  test(`靜態文章頁打得開：${p.slug}`, async ({ page }) => {
    await page.goto(`/posts/${p.slug}/`);
    await expect(page.locator(".post__title")).toHaveText(p.title);
    // 內文是預渲染的（不靠 JS），且增強功能有跑（讚按鈕由 JS 加上）
    await expect(page.locator(".prose > *").first()).toBeVisible();
    await expect(page.locator(".like-btn")).toBeVisible();
  });
}

test("靜態文章頁有 SEO meta（canonical / OG / JSON-LD）", async ({ page }) => {
  const p = posts[0];
  await page.goto(`/posts/${p.slug}/`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `https://tzutingchen99.github.io/lucy-qa/posts/${p.slug}/`
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    p.title
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
});

test("舊 #/posts/ 連結轉址到真實文章頁", async ({ page }) => {
  const p = posts[0];
  await page.goto(`/#/posts/${p.slug}`);
  await page.waitForURL(`**/posts/${p.slug}/`);
  await expect(page.locator(".post__title")).toHaveText(p.title);
});

test("舊 ?h= 深連結轉址後捲到該段落", async ({ page }) => {
  const p = posts[0];
  await page.goto(`/posts/${p.slug}/`);
  const id = await page.locator(".prose h2").first().getAttribute("id");
  test.skip(!id, "這篇沒有 h2");
  await page.goto(`/?h=${encodeURIComponent(id)}#/posts/${p.slug}`);
  await page.waitForURL(`**/posts/${p.slug}/*`);
  await expect(page.locator(".prose h2").first()).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("未知路由顯示 Page not found", async ({ page }) => {
  await page.goto("/#/no-such-route");
  await expect(page.locator(".post__title")).toHaveText(/Page not found/);
});

test("draft／不存在的 slug 顯示 not found", async ({ page }) => {
  await page.goto("/#/posts/no-such-post");
  await expect(page.locator(".post__title")).toHaveText(/Post not found/);
});

test("文章卡片標題是指向真實頁的連結", async ({ page }) => {
  await page.goto("/");
  const href = await page
    .locator(".post-card__title a")
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^posts\/.+\/$/);
});

test("文章頁的上一篇／下一篇指向真實頁", async ({ page }) => {
  test.skip(posts.length < 2, "只有一篇文章");
  // 最新的文章一定有「上一篇」
  await page.goto(`/posts/${posts[0].slug}/`);
  const href = await page
    .locator(".post-nav__item--prev a")
    .getAttribute("href");
  expect(href).toMatch(/^\.\.\/.+\/$/);
});

test("搜尋能過濾出文章", async ({ page }) => {
  await page.goto("/#/search");
  await page.locator(".search-input").fill(posts[0].title.slice(0, 4));
  const results = page.locator(".search-results .post-card");
  await expect(results.first()).toContainText(posts[0].title.slice(0, 4));
});

test("標籤頁：breadcrumb 與篇數正確", async ({ page }) => {
  const tag = posts[0].tag;
  const count = posts.filter((p) => p.tag === tag).length;
  await page.goto(`/#/tags/${encodeURIComponent(tag)}`);
  await expect(page.locator(".breadcrumb__item--current")).toHaveText(tag);
  await expect(page.locator(".post-card")).toHaveCount(count);
});
