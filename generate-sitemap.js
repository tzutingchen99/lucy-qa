#!/usr/bin/env node
// Run: node generate-sitemap.js

const fs = require("fs");

const SITE_URL = "https://tzutingchen99.github.io/lucy-qa";

const posts = JSON.parse(fs.readFileSync("content/posts.json", "utf8")).posts
  .filter((p) => p.status === "published")
  .sort((a, b) => b.date.localeCompare(a.date));

// Root + every published post (posts have real pre-rendered URLs now).
const urls = [
  { loc: SITE_URL + "/", lastmod: posts[0] && posts[0].date, priority: "1.0", changefreq: "weekly" },
  ...posts.map((p) => ({
    loc: `${SITE_URL}/posts/${p.slug}/`,
    lastmod: p.updated || p.date,
    priority: "0.8",
    changefreq: "monthly",
  })),
];

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map((u) =>
      [
        "  <url>",
        `    <loc>${u.loc}</loc>`,
        u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>` : "",
        `    <changefreq>${u.changefreq}</changefreq>`,
        `    <priority>${u.priority}</priority>`,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n") +
  `\n</urlset>\n`;

fs.writeFileSync("sitemap.xml", xml, "utf8");
console.log(`Generated sitemap.xml — root + ${posts.length} posts.`);
