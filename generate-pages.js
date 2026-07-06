#!/usr/bin/env node
// Run: node generate-pages.js
// Pre-renders each published post as posts/{slug}/index.html so crawlers and
// social platforms (which drop everything after #) get real URLs, full text,
// OG tags, and JSON-LD. app.js detects these pages (body[data-static-post])
// and layers the SPA enhancements on top — rendering logic is not duplicated.

const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

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

// Must produce the same ids as slugify() in app.js (?h= deep links, TOC).
function slugify(text) {
  return text.trim().replace(/\s+/g, "-").replace(/[<>&"']/g, "");
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
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

marked.setOptions({ breaks: false, gfm: true });
marked.use({
  renderer: {
    heading(text, level) {
      const plain = decodeEntities(text.replace(/<[^>]*>/g, ""));
      return `<h${level} id="${esc(slugify(plain))}">${text}</h${level}>\n`;
    },
  },
});

const posts = JSON.parse(fs.readFileSync("content/posts.json", "utf8"))
  .posts.filter((p) => p.status === "published")
  .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

function pageHtml(p, proseHtml, mins) {
  const url = `${SITE_URL}/posts/${p.slug}/`;
  const title = `${p.title} — ${SITE_TITLE}`;
  const desc = p.summary || "";
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
${p.updated ? `    <meta property="article:modified_time" content="${p.updated}" />\n` : ""}    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${esc(p.title)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
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
          <div class="prose">
${proseHtml}
          </div>
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
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
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
  const proseHtml = marked.parse(md);
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
