#!/usr/bin/env node
// Run: node generate-pages.js
// Pre-renders each published post as posts/{slug}/index.html so crawlers and
// social platforms (which drop everything after #) get real URLs, full text,
// OG tags, and JSON-LD. app.js detects these pages (body[data-static-post])
// and layers the SPA enhancements on top — rendering logic is not duplicated.

const fs = require("fs");
const path = require("path");
const { renderProse, mdToText } = require("./lib/markdown");

const SITE_URL = "https://tzutingchen99.github.io/lucy-qa";
const SITE_PATH = "/lucy-qa/"; // production pathname, used for view-count attribution
const SITE_TITLE = "QA 筆記";
const ROOT = "../../"; // posts/{slug}/ → site root

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Same formula as readingTime() in app.js.
function readingTime(text) {
  const clean = text.replace(/[#*`_~\[\]()>|]/g, " ").replace(/\s+/g, " ");
  const zh = (clean.match(/[一-鿿㐀-䶿]/g) || []).length;
  const en = (clean.match(/[a-zA-Z]{2,}/g) || []).length;
  return Math.max(1, Math.ceil(zh / 300 + en / 200));
}

function fmtDate(iso) {
  return iso ? iso.replace(/-/g, ".") : "";
}

const posts = JSON.parse(fs.readFileSync("content/posts.json", "utf8"))
  .posts.filter((p) => p.status === "published")
  .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

// Static series nav — same markup buildSeriesNav() makes in app.js, but
// crawler-visible. app.js skips rebuilding it when it's already in the DOM.
function seriesNavHtml(p) {
  if (!p.tag) return "";
  const series = posts
    .filter((x) => x.tag === p.tag)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  if (series.length < 2) return "";
  const idx = series.findIndex((x) => x.slug === p.slug);
  const items = series
    .map((x, i) =>
      x.slug === p.slug
        ? `<li class="series__item series__item--current"><span class="series__num">${i + 1}.</span><span>${esc(x.title)}</span></li>`
        : `<li class="series__item"><span class="series__num">${i + 1}.</span><a href="../${esc(x.slug)}/">${esc(x.title)}</a></li>`
    )
    .join("");
  return `<nav class="series" aria-label="${esc(p.tag)} 系列"><p class="series__label">${esc(p.tag)} 系列  ${idx + 1} / ${series.length}</p><ul class="series__list">${items}</ul></nav>`;
}

// Static prev/next — same markup addPrevNext() makes in app.js.
function prevNextHtml(p) {
  const idx = posts.findIndex((x) => x.slug === p.slug);
  const newer = posts[idx - 1];
  const older = posts[idx + 1];
  if (!newer && !older) return "";
  const prev = older
    ? `<div class="post-nav__item post-nav__item--prev"><span class="post-nav__dir">← 上一篇</span><a href="../${esc(older.slug)}/" class="post-nav__title">${esc(older.title)}</a></div>`
    : "";
  const next = newer
    ? `<div class="post-nav__item post-nav__item--next"><span class="post-nav__dir">下一篇 →</span><a href="../${esc(newer.slug)}/" class="post-nav__title">${esc(newer.title)}</a></div>`
    : "";
  return `<nav class="post-nav" aria-label="文章導航">${prev}${next}</nav>`;
}

function ogImagePath(slug) {
  if (fs.existsSync(path.join("og", slug + ".png"))) return `${SITE_URL}/og/${slug}.png`;
  if (fs.existsSync(path.join("og", "site.png"))) return `${SITE_URL}/og/site.png`;
  return null;
}

function pageHtml(p, proseHtml, mins) {
  const url = `${SITE_URL}/posts/${p.slug}/`;
  const title = `${p.title} — ${SITE_TITLE}`;
  const desc = p.summary || "";
  const ogImage = ogImagePath(p.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: desc,
    url: url,
    datePublished: p.date,
    dateModified: p.updated || p.date,
    inLanguage: "zh-Hant",
    author: { "@type": "Person", name: "Lucy Chen", url: "https://tzutingchen99.github.io/lucy-cv/" },
  };
  if (ogImage) jsonLd.image = ogImage;
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_TITLE, item: SITE_URL + "/" },
      { "@type": "ListItem", position: 2, name: p.title },
    ],
  };

  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${esc(SITE_TITLE)}" />
    <meta property="og:title" content="${esc(p.title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="article:published_time" content="${p.date}" />
${p.updated ? `    <meta property="article:modified_time" content="${p.updated}" />\n` : ""}${
    ogImage
      ? `    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${ogImage}" />
`
      : `    <meta name="twitter:card" content="summary" />
`
  }    <meta name="twitter:title" content="${esc(p.title)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
    <link rel="alternate" type="application/rss+xml" title="${esc(SITE_TITLE)} RSS" href="${ROOT}feed.xml" />
    <link rel="icon" type="image/png" href="${ROOT}letter-q.png" />
    <link rel="apple-touch-icon" href="${ROOT}letter-q.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+TC:wght@300;400;500;600&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="${ROOT}style.css" />
    <script>
      window.goatcounter = {
        path: function () {
          return location.pathname + location.hash;
        },
      };
    </script>
    <script data-goatcounter="https://tzu.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
    <script>
      // Early theme detection to avoid flash (keep in sync with index.html)
      (function () {
        var saved = localStorage.getItem("qa-theme");
        var prefersDark =
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;
        var theme =
          saved === "dark" || saved === "light"
            ? saved
            : prefersDark
            ? "dark"
            : "light";
        document.documentElement.dataset.theme = theme;
        var fs = parseFloat(localStorage.getItem("qa-font-size"));
        if (fs && fs >= 0.9 && fs <= 1.2) {
          document.documentElement.style.setProperty("--prose-size", fs + "rem");
        }
      })();
    </script>
  </head>
  <body data-static-post="${esc(p.slug)}" data-root="${ROOT}">
    <div id="progress-bar" aria-hidden="true"></div>
    <div class="grid">
      <header class="strip" role="banner">
        <a href="${ROOT}" class="strip__item strip__brand">QA / Lucy</a>
        <nav class="strip__nav" aria-label="Primary">
          <a href="${ROOT}#/">Home</a>
          <a href="${ROOT}#/posts" aria-current="page">Posts</a>
          <a href="${ROOT}#/collections">Collections</a>
          <a href="${ROOT}#/about">About</a>
          <a href="${ROOT}#/search">Search</a>
        </nav>
        <div class="font-ctrl" role="group" aria-label="字體大小">
          <button type="button" class="font-ctrl__btn" data-delta="-1" aria-label="縮小字體">A−</button>
          <button type="button" class="font-ctrl__btn" data-delta="1" aria-label="放大字體">A+</button>
        </div>
        <div class="theme" role="group" aria-label="Theme">
          <button type="button" class="theme__btn" data-theme="light" aria-label="Light theme">○</button>
          <span class="theme__sep" aria-hidden="true">·</span>
          <button type="button" class="theme__btn" data-theme="dark" aria-label="Dark theme">●</button>
        </div>
      </header>

      <main id="main" class="main" tabindex="-1">
        <article class="post">
          <a href="${ROOT}#/posts" class="post__back">← All posts</a>
          <p class="post__meta">${esc(fmtDate(p.date))}${
    p.updated ? `  ·  更新 ${esc(fmtDate(p.updated))}` : ""
  }${
    p.tag
      ? `  ·  <a href="${ROOT}#/tags/${esc(p.tag)}" class="post__tag-link">${esc(p.tag)}</a>`
      : ""
  }  ·  ${mins} min read  ·  <span class="goatcounter-count" data-path="${esc(
    SITE_PATH + "posts/" + p.slug + "/"
  )}" data-path-legacy="${esc(SITE_PATH + "#/posts/" + p.slug)}"></span></p>
          <h1 class="post__title">${esc(p.title)}</h1>
          ${seriesNavHtml(p)}
          <div class="prose">
${proseHtml}
          </div>
          ${prevNextHtml(p)}
        </article>
      </main>

      <footer class="strip strip--foot" role="contentinfo">
        <span class="strip__item">QA / Lucy</span>
        <a href="https://tzutingchen99.github.io/lucy-cv/" class="strip__item">CV ↗</a>
        <a
          href="https://www.threads.com/@qauluru"
          target="_blank"
          rel="noopener noreferrer"
          class="strip__item"
          >Threads ↗</a
        >
        <a href="${ROOT}feed.xml" class="strip__item">RSS ↗</a>
        <span id="today-views" class="strip__item" aria-live="polite"></span>
        <span id="total-views" class="strip__item" aria-live="polite"></span>
        <span class="strip__item strip__item--end">2026</span>
      </footer>
    </div>

    <button id="back-to-top" aria-label="回到頂部">↑</button>
    <script>window.Prism = window.Prism || {}; window.Prism.manual = true;</script>
    <script src="${ROOT}vendor/prism.min.js"></script>
    <script src="${ROOT}vendor/prism-python.min.js"></script>
    <script src="${ROOT}theme.js"></script>
    <script src="${ROOT}app.js"></script>
  </body>
</html>
`;
}

let count = 0;
posts.forEach((p) => {
  const mdPath = path.join("content", "posts", p.slug + ".md");
  const md = fs.readFileSync(mdPath, "utf8");
  const proseHtml = renderProse(md);
  const dir = path.join("posts", p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), pageHtml(p, proseHtml, readingTime(md)), "utf8");
  count++;
});

// Remove pages for posts that were unpublished or renamed.
if (fs.existsSync("posts")) {
  const live = new Set(posts.map((p) => p.slug));
  fs.readdirSync("posts").forEach((d) => {
    if (!live.has(d)) {
      fs.rmSync(path.join("posts", d), { recursive: true, force: true });
      console.log(`removed stale posts/${d}/`);
    }
  });
}

console.log(`Generated ${count} static post pages under posts/.`);

/* ─── Full-text search index ─────────────────────────────── */
const searchIndex = posts.map((p) => ({
  slug: p.slug,
  title: p.title,
  date: p.date,
  tag: p.tag || "",
  summary: p.summary || "",
  text: mdToText(fs.readFileSync(path.join("content", "posts", p.slug + ".md"), "utf8")),
}));
fs.writeFileSync("search-index.json", JSON.stringify(searchIndex), "utf8");
console.log(`Generated search-index.json — ${searchIndex.length} posts.`);

/* ─── Pre-rendered home post list ────────────────────────── */
// Crawlers on the root page previously saw only "Loading…" — no links to any
// post. Inject the same markup viewHome() renders between the marker comments
// in index.html; app.js re-renders identical DOM on load.
function postCardHtml(p) {
  return `<article class="post-card">
<div class="post-card__meta">${esc(fmtDate(p.date))}<span class="post-card__views"><span class="goatcounter-count" data-path="${esc(SITE_PATH + "posts/" + p.slug + "/")}" data-path-legacy="${esc(SITE_PATH + "#/posts/" + p.slug)}"></span></span></div>
<div class="post-card__body">
<h3 class="post-card__title"><a href="posts/${esc(p.slug)}/">${esc(p.title)}</a></h3>
${p.summary ? `<p class="post-card__summary">${esc(p.summary)}</p>` : ""}
${p.tag ? `<button class="post-card__tag" data-tag="${esc(p.tag)}">${esc(p.tag)}</button>` : ""}
</div>
</article>`;
}

const homeHtml = `
        <div class="home">
          <section class="hero">
            <p class="hero__kicker">Notes on QA</p>
            <h1 class="hero__title">QA 筆記</h1>
            <p class="hero__lede">關於自動化、AI 輔助測試，以及把測試寫成意圖而不是實作的筆記。</p>
          </section>
          <section class="section">
            <div class="section__head">
              <h2 class="section__title">All posts</h2>
              <span class="section__count">${posts.length}</span>
            </div>
            <div class="post-list">
${posts.map(postCardHtml).join("\n")}
            </div>
          </section>
        </div>
        `;

/* ─── Custom 404 page ────────────────────────────────────── */
// GitHub Pages serves 404.html from the repo root for any missing path.
// Absolute (SITE_PATH-prefixed) links because the page renders at any depth.
const latest = posts.slice(0, 3);
const notFoundHtml = `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>404 — ${SITE_TITLE}</title>
    <meta name="robots" content="noindex" />
    <link rel="icon" type="image/png" href="${SITE_PATH}letter-q.png" />
    <link rel="stylesheet" href="${SITE_PATH}style.css" />
    <script>
      (function () {
        var saved = localStorage.getItem("qa-theme");
        var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.dataset.theme =
          saved === "dark" || saved === "light" ? saved : prefersDark ? "dark" : "light";
      })();
    </script>
  </head>
  <body>
    <div class="grid">
      <header class="strip" role="banner">
        <a href="${SITE_PATH}" class="strip__item strip__brand">QA / Lucy</a>
      </header>
      <main class="main">
        <section class="post">
          <p class="post__meta">404</p>
          <h1 class="post__title">找不到這一頁</h1>
          <div class="prose">
            <p>網址可能打錯了，或這篇文章已經搬家。</p>
            <p><a href="${SITE_PATH}">← 回首頁</a></p>
            <h2>最新文章</h2>
            <ul>
${latest.map((p) => `              <li><a href="${SITE_PATH}posts/${esc(p.slug)}/">${esc(p.title)}</a></li>`).join("\n")}
            </ul>
          </div>
        </section>
      </main>
      <footer class="strip strip--foot" role="contentinfo">
        <span class="strip__item">QA / Lucy</span>
        <span class="strip__item strip__item--end">2026</span>
      </footer>
    </div>
  </body>
</html>
`;
fs.writeFileSync("404.html", notFoundHtml, "utf8");
console.log("Generated 404.html.");

const indexHtml = fs.readFileSync("index.html", "utf8");
const START = "<!-- prerender:start -->";
const END = "<!-- prerender:end -->";
if (indexHtml.includes(START) && indexHtml.includes(END)) {
  const updated =
    indexHtml.slice(0, indexHtml.indexOf(START) + START.length) +
    homeHtml +
    indexHtml.slice(indexHtml.indexOf(END));
  fs.writeFileSync("index.html", updated, "utf8");
  console.log("Injected pre-rendered post list into index.html.");
} else {
  console.warn("index.html 缺少 prerender 標記，略過首頁預渲染。");
}
