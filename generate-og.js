#!/usr/bin/env node
// Run: node generate-og.js  (需要本機，會用 Playwright 的 Chromium 截圖)
// 產生 og/site.png（全站）+ og/{slug}.png（每篇文章），1200×630。
// CI 不跑這支 — 新文章 push 後會先用 og/site.png 當 fallback，
// 想要專屬圖就本地跑一次 `npm run og` 再 commit。

const fs = require("fs");
const { chromium } = require("@playwright/test");

const posts = JSON.parse(fs.readFileSync("content/posts.json", "utf8"))
  .posts.filter((p) => p.status === "published");

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 沿用 style.css 的 light theme tokens，讓分享圖跟站上視覺一致
function cardHtml({ kicker, title, footer }) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background: #f5f3ea; color: #2a2a2a;
    font-family: "Noto Sans TC", "Inter", sans-serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 72px 84px; border-top: 14px solid #2a2a2a;
  }
  .kicker {
    font-family: "JetBrains Mono", monospace; font-size: 26px;
    letter-spacing: 0.18em; text-transform: uppercase; color: #807d72;
  }
  .title {
    font-size: 76px; font-weight: 600; line-height: 1.22;
    letter-spacing: -0.01em; max-width: 1000px;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .foot {
    display: flex; justify-content: space-between; align-items: baseline;
    font-family: "JetBrains Mono", monospace; font-size: 24px; color: #807d72;
  }
  .brand { font-weight: 500; color: #2a2a2a; }
</style></head>
<body>
  <p class="kicker">${esc(kicker)}</p>
  <h1 class="title">${esc(title)}</h1>
  <div class="foot"><span class="brand">QA / Lucy</span><span>${esc(footer)}</span></div>
</body></html>`;
}

(async () => {
  fs.mkdirSync("og", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  const cards = [
    {
      file: "og/site.png",
      html: cardHtml({
        kicker: "Notes on QA",
        title: "QA 筆記",
        footer: "tzutingchen99.github.io/lucy-qa",
      }),
    },
    ...posts.map((p) => ({
      file: `og/${p.slug}.png`,
      html: cardHtml({
        kicker: p.tag ? `${p.tag} · QA 筆記` : "QA 筆記",
        title: p.title,
        footer: p.date,
      }),
    })),
  ];

  for (const c of cards) {
    await page.setContent(c.html, { waitUntil: "networkidle" });
    await page.screenshot({ path: c.file });
    console.log("✓ " + c.file);
  }
  await browser.close();

  // 清掉已下架文章的圖（site.png 除外）
  const live = new Set(posts.map((p) => p.slug + ".png"));
  fs.readdirSync("og").forEach((f) => {
    if (f !== "site.png" && !live.has(f)) {
      fs.unlinkSync("og/" + f);
      console.log("removed stale og/" + f);
    }
  });
})();
