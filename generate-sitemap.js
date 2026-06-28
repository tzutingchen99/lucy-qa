#!/usr/bin/env node
// Run: node generate-sitemap.js

const fs = require("fs");

const SITE_URL = "https://tzutingchen99.github.io/lucy-qa";

const posts = JSON.parse(fs.readFileSync("content/posts.json", "utf8")).posts
  .filter((p) => p.status === "published")
  .sort((a, b) => b.date.localeCompare(a.date));

const urls = [
  { loc: SITE_URL + "/", priority: "1.0", changefreq: "weekly" },
  { loc: SITE_URL + "/#/posts", priority: "0.8", changefreq: "weekly" },
  { loc: SITE_URL + "/#/about", priority: "0.5", changefreq: "monthly" },
  ...posts.map((p) => ({
    loc: SITE_URL + "/#/posts/" + p.slug,
    lastmod: p.date,
    priority: "0.7",
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
  `\n</urlset>`;

fs.writeFileSync("sitemap.xml", xml, "utf8");
console.log(`Generated sitemap.xml — ${posts.length} posts + 3 static pages.`);
