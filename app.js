/* ─── SPA router + markdown loader ──────────────────────── */
(function () {
  var $main = document.getElementById("main");
  var postsIndex = null; // cached posts.json

  /* ─── Marked config ───────────────────────────────────── */
  if (window.marked) {
    marked.setOptions({
      breaks: false,
      gfm: true,
      headerIds: true,
      mangle: false,
    });
  }

  /* ─── Utilities ───────────────────────────────────────── */
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "." + mm + "." + dd;
  }

  function setTitle(title) {
    document.title = title ? title + " — QA 筆記" : "QA 筆記";
  }

  function markNav(name) {
    document.querySelectorAll(".strip__nav a[data-nav]").forEach(function (a) {
      if (a.dataset.nav === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function render(node) {
    $main.innerHTML = "";
    $main.appendChild(node);
    $main.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  function showError(msg) {
    render(
      el(
        '<section class="post"><p class="post__meta">Error</p>' +
          '<h1 class="post__title">' +
          escapeHtml(msg) +
          "</h1>" +
          '<a href="#/" class="post__back">← Home</a></section>'
      )
    );
  }

  /* ─── Data ────────────────────────────────────────────── */
  async function loadPostsIndex() {
    if (postsIndex) return postsIndex;
    var res = await fetch("content/posts.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to load posts index");
    var data = await res.json();
    // Public site only renders "published" posts; drafts are admin-only.
    data.posts = (data.posts || []).filter(function (p) {
      return p.status !== "draft";
    });
    data.posts.sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "");
    });
    postsIndex = data;
    return postsIndex;
  }

  async function loadMarkdown(path) {
    var res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error("Not found: " + path);
    return await res.text();
  }

  /* ─── Views ───────────────────────────────────────────── */
  async function viewHome() {
    markNav("home");
    setTitle("");
    var data = await loadPostsIndex();
    var recent = data.posts.slice(0, 5);
    var node = el('<div class="home"></div>');

    node.appendChild(
      el(
        '<section class="hero">' +
          '<p class="hero__kicker">Notes on QA</p>' +
          '<h1 class="hero__title">QA 筆記</h1>' +
          '<p class="hero__lede">關於自動化、AI 輔助測試，以及把測試寫成意圖而不是實作的筆記。</p>' +
          "</section>"
      )
    );

    var sec = el(
      '<section class="section">' +
        '<div class="section__head">' +
        '<h2 class="section__title">Recent posts</h2>' +
        '<a class="section__more" href="#/posts">All posts →</a>' +
        "</div>" +
        '<div class="post-list"></div>' +
        "</section>"
    );
    var list = sec.querySelector(".post-list");
    recent.forEach(function (p) {
      list.appendChild(postCard(p));
    });
    node.appendChild(sec);

    render(node);
  }

  async function viewPosts() {
    markNav("posts");
    setTitle("Posts");
    var data = await loadPostsIndex();
    var node = el('<div class="posts-page"></div>');
    node.appendChild(
      el(
        '<section class="hero">' +
          '<p class="hero__kicker">All posts</p>' +
          '<h1 class="hero__title">' +
          data.posts.length +
          " entries.</h1>" +
          "</section>"
      )
    );
    var list = el('<div class="post-list"></div>');
    data.posts.forEach(function (p) {
      list.appendChild(postCard(p));
    });
    node.appendChild(list);
    render(node);
  }

  function postCard(p) {
    var card = el(
      '<article class="post-card">' +
        '<div class="post-card__meta">' +
        escapeHtml(fmtDate(p.date)) +
        "</div>" +
        '<div class="post-card__body">' +
        '<h3 class="post-card__title">' +
        escapeHtml(p.title) +
        "</h3>" +
        (p.summary
          ? '<p class="post-card__summary">' +
            escapeHtml(p.summary) +
            "</p>"
          : "") +
        (p.tag
          ? '<span class="post-card__tag">' + escapeHtml(p.tag) + "</span>"
          : "") +
        "</div>" +
        "</article>"
    );
    card.addEventListener("click", function () {
      location.hash = "#/posts/" + p.slug;
    });
    return card;
  }

  async function viewPost(slug) {
    markNav("posts");
    var data = await loadPostsIndex();
    var meta = data.posts.find(function (p) {
      return p.slug === slug;
    });
    if (!meta) {
      showError("Post not found (or still in draft)");
      return;
    }
    setTitle(meta.title);
    var md = await loadMarkdown("content/posts/" + slug + ".md");
    var html = marked.parse(md);
    var node = el(
      '<article class="post">' +
        '<a href="#/posts" class="post__back">← All posts</a>' +
        '<p class="post__meta">' +
        escapeHtml(fmtDate(meta.date)) +
        (meta.tag ? "  ·  " + escapeHtml(meta.tag) : "") +
        "</p>" +
        '<h1 class="post__title">' +
        escapeHtml(meta.title) +
        "</h1>" +
        '<div class="prose"></div>' +
        "</article>"
    );
    node.querySelector(".prose").innerHTML = html;
    render(node);
  }

  async function viewAbout() {
    markNav("about");
    setTitle("About");
    var md = await loadMarkdown("content/about.md");
    var html = marked.parse(md);
    var node = el(
      '<article class="about post">' +
        '<a href="#/" class="post__back">← Home</a>' +
        '<h1 class="post__title">About</h1>' +
        '<div class="prose"></div>' +
        "</article>"
    );
    node.querySelector(".prose").innerHTML = html;
    render(node);
  }

  /* ─── Router ──────────────────────────────────────────── */
  async function route() {
    var hash = location.hash.replace(/^#/, "") || "/";
    try {
      if (hash === "/" || hash === "") {
        await viewHome();
      } else if (hash === "/posts") {
        await viewPosts();
      } else if (hash.startsWith("/posts/")) {
        var slug = hash.slice("/posts/".length);
        await viewPost(slug);
      } else if (hash === "/about") {
        await viewAbout();
      } else {
        showError("Page not found");
      }
    } catch (err) {
      console.error(err);
      showError(err.message || "Something went wrong");
    }
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", route);
})();
