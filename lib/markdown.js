// Shared markdown rendering for generate-pages.js / generate-feed.js.
// Mirrors the client-side behavior in app.js (slugify ids, callouts) so
// crawlers and RSS readers see the same thing browsers do.

const { marked } = require("marked");

// Must produce the same ids as slugify() in app.js (?h= deep links, TOC).
function slugify(text) {
  return text.trim().replace(/\s+/g, "-").replace(/[<>&"']/g, "");
}

function escAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

marked.setOptions({ breaks: false, gfm: true });
marked.use({
  renderer: {
    heading(text, level) {
      const plain = decodeEntities(text.replace(/<[^>]*>/g, ""));
      return `<h${level} id="${escAttr(slugify(plain))}">${text}</h${level}>\n`;
    },
  },
});

// Same transform processCallouts() does in the browser, applied at build time
// so no-JS readers (crawlers, RSS) get the styled markup instead of "[!TLDR]".
const CALLOUT_LABELS = { TLDR: "TL;DR", NOTE: "Note", WARNING: "注意", IMPORTANT: "重點", TIP: "Tip" };

function processCallouts(html) {
  return html.replace(
    /<blockquote>\s*<p>\[!(TLDR|TL;DR|NOTE|WARNING|IMPORTANT|TIP)\]\s*([\s\S]*?)<\/blockquote>/gi,
    (m, type, rest) => {
      const t = type.toUpperCase().replace(";", "");
      const label = CALLOUT_LABELS[t] || t;
      return `<div class="callout callout--${t.toLowerCase()}"><p class="callout__label">${label}</p><p>${rest}</div>`;
    }
  );
}

function renderProse(md) {
  // Post pages and feed items already carry the title (post__title / <title>);
  // a leading "# Title" in the md would render it twice.
  const body = md.replace(/^\s*# [^\n]*\n+/, "");
  return processCallouts(marked.parse(body));
}

// Plain text for the search index.
function mdToText(md) {
  return md
    .replace(/^```.*$/gm, " ") // keep code content, drop fence lines
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^>\s*\[![A-Z;]+\]\s*/gim, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/[*_~>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = { renderProse, mdToText, slugify };
