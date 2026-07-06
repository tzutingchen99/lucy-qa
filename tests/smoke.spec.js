// 冒煙測試：每條路由渲染成功、每篇文章打得開、404 行為正確。
// 資料驅動 — 從 posts.json 讀 published 文章，新增文章不用改測試。

const { test, expect } = require("@playwright/test");
const posts = require("../content/posts.json").posts.filter(
  (p) => p.status === "published"
);

test("首頁：hero 與所有 published 文章卡片", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero__title")).toHaveText("QA 筆記");
  await expect(page.locator(".post-card")).toHaveCount(posts.length);
});

for (const p of posts) {
  test(`文章打得開：${p.slug}`, async ({ page }) => {
    await page.goto(`/#/posts/${p.slug}`);
    await expect(page.locator(".post__title")).toHaveText(p.title);
    // 內文有實際渲染出來（不是空殼）
    await expect(page.locator(".prose > *").first()).toBeVisible();
  });
}

test("未知路由顯示 Page not found", async ({ page }) => {
  await page.goto("/#/no-such-route");
  await expect(page.locator(".post__title")).toHaveText(/Page not found/);
});

test("draft／不存在的 slug 顯示 not found", async ({ page }) => {
  await page.goto("/#/posts/no-such-post");
  await expect(page.locator(".post__title")).toHaveText(/Post not found/);
});

test("文章卡片標題是真的連結（鍵盤可用）", async ({ page }) => {
  await page.goto("/");
  const href = await page
    .locator(".post-card__title a")
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^#\/posts\//);
});

test("標題深連結 ?h= 會捲到該段落", async ({ page }) => {
  await page.goto(`/#/posts/${posts[0].slug}`);
  const heading = page.locator(".prose h2").first();
  const id = await heading.getAttribute("id");
  test.skip(!id, "這篇沒有 h2");
  await page.goto(`/?h=${encodeURIComponent(id)}#/posts/${posts[0].slug}`);
  await expect(page.locator(".prose h2").first()).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
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
