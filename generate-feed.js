#!/usr/bin/env node
// Run: node generate-feed.js
// Reads content/posts.json and writes feed.xml

const fs = require("fs");

const SITE_URL = "https://tzutingchen99.github.io/lucy-qa";
const SITE_TITLE = "QA 筆記";
const SITE_DESC = "關於自動化、AI 輔助測試，以及把測試寫成意圖而不是實作的筆記。";

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const posts = JSON.parse(fs.readFileSync("content/posts.json", "utf8")).posts
  .filter((p) => p.status === "published")
  .sort((a, b) => b.date.localeCompare(a.date));

const items = posts
  .map((p) => {
    const url = `${SITE_URL}/#/posts/${p.slug}`;
    const pubDate = new Date(p.date + "T00:00:00+08:00").toUTCString();
    return [
      "  <item>",
      `    <title>${xmlEscape(p.title)}</title>`,
      `    <link>${url}</link>`,
      `    <guid isPermaLink="true">${url}</guid>`,
      `    <pubDate>${pubDate}</pubDate>`,
      p.summary ? `    <description>${xmlEscape(p.summary)}</description>` : "",
      "  </item>",
    ]
      .filter(Boolean)
      .join("\n");
  })
  .join("\n");

const lastBuild =
  posts.length > 0
    ? new Date(posts[0].date + "T00:00:00+08:00").toUTCString()
    : new Date().toUTCString();

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(SITE_TITLE)}</title>
    <link>${SITE_URL}/</link>
    <description>${xmlEscape(SITE_DESC)}</description>
    <language>zh-Hant</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

fs.writeFileSync("feed.xml", xml, "utf8");
console.log(`Generated feed.xml — ${posts.length} posts.`);
