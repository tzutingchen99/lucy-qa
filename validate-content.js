#!/usr/bin/env node
// Run: node validate-content.js
// Checks posts.json ↔ content/posts/*.md consistency. Exits 1 on any error.

const fs = require("fs");
const path = require("path");

const errors = [];
const POSTS_DIR = path.join("content", "posts");

let data;
try {
  data = JSON.parse(fs.readFileSync(path.join("content", "posts.json"), "utf8"));
} catch (e) {
  console.error("✗ content/posts.json 不是合法 JSON: " + e.message);
  process.exit(1);
}

const posts = data.posts;
if (!Array.isArray(posts)) {
  console.error("✗ posts.json 缺少 posts 陣列");
  process.exit(1);
}

function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  // Parse as UTC so toISOString() round-trips regardless of local timezone.
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const seen = new Set();
posts.forEach((p, i) => {
  const where = `posts[${i}]` + (p.slug ? ` (${p.slug})` : "");

  ["slug", "title", "date", "status"].forEach((k) => {
    if (!p[k]) errors.push(`${where}: 缺少必填欄位 "${k}"`);
  });
  if (p.slug) {
    if (!/^[a-z0-9-]+$/.test(p.slug))
      errors.push(`${where}: slug 只能用小寫英數和連字號`);
    if (seen.has(p.slug)) errors.push(`${where}: slug 重複`);
    seen.add(p.slug);
  }
  if (p.date && !isValidDate(p.date))
    errors.push(`${where}: date "${p.date}" 不是合法的 YYYY-MM-DD`);
  if (p.updated && !isValidDate(p.updated))
    errors.push(`${where}: updated "${p.updated}" 不是合法的 YYYY-MM-DD`);
  if (p.status && !["published", "draft"].includes(p.status))
    errors.push(`${where}: status 必須是 published 或 draft，收到 "${p.status}"`);

  if (p.slug && p.status === "published") {
    const md = path.join(POSTS_DIR, p.slug + ".md");
    if (!fs.existsSync(md)) errors.push(`${where}: 找不到 ${md}`);
    else if (!fs.readFileSync(md, "utf8").trim()) errors.push(`${where}: ${md} 是空的`);
  }
});

// Orphan check: every published md file must be registered in posts.json.
fs.readdirSync(POSTS_DIR)
  .filter((f) => f.endsWith(".md"))
  .forEach((f) => {
    const slug = f.replace(/\.md$/, "");
    if (!seen.has(slug))
      errors.push(`${POSTS_DIR}/${f}: 沒有登記在 posts.json（無法被讀者看到）`);
  });

// Collections must reference existing published posts.
const colsPath = path.join("content", "collections.json");
if (fs.existsSync(colsPath)) {
  let cols = null;
  try {
    cols = JSON.parse(fs.readFileSync(colsPath, "utf8")).collections;
  } catch (e) {
    errors.push("content/collections.json 不是合法 JSON: " + e.message);
  }
  if (cols) {
    const colSeen = new Set();
    cols.forEach((c, i) => {
      const where = `collections[${i}]` + (c.slug ? ` (${c.slug})` : "");
      ["slug", "title", "posts"].forEach((k) => {
        if (!c[k] || (k === "posts" && !c[k].length))
          errors.push(`${where}: 缺少 "${k}"`);
      });
      if (c.slug) {
        if (colSeen.has(c.slug)) errors.push(`${where}: slug 重複`);
        colSeen.add(c.slug);
      }
      (c.posts || []).forEach((s) => {
        const p = posts.find((x) => x.slug === s);
        if (!p) errors.push(`${where}: 找不到文章 "${s}"`);
        else if (p.status !== "published")
          errors.push(`${where}: "${s}" 不是 published，不能進合集`);
      });
    });
  }
}

if (errors.length) {
  errors.forEach((e) => console.error("✗ " + e));
  console.error(`\n${errors.length} 個問題。`);
  process.exit(1);
}
console.log(`✓ ${posts.length} 篇文章 metadata 與檔案一致。`);
