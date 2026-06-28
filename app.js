/* ─── SPA router + markdown loader ──────────────────────── */
(function () {
  var $main = document.getElementById("main");
  var postsIndex = null;
  var firstRoute = true;
  var basePath = location.pathname;

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

  function slugify(text) {
    return text.trim().replace(/\s+/g, "-").replace(/[<>&"']/g, "");
  }

  function buildToc(proseEl) {
    var headings = Array.from(proseEl.querySelectorAll("h2, h3"));
    if (headings.length < 2) return null;

    headings.forEach(function (h) {
      if (!h.id) h.id = slugify(h.textContent);
    });

    var nav = document.createElement("nav");
    nav.className = "toc";
    nav.setAttribute("aria-label", "目錄");

    var label = document.createElement("p");
    label.className = "toc__label";
    label.textContent = "目錄";
    nav.appendChild(label);

    var ul = document.createElement("ul");
    ul.className = "toc__list";
    headings.forEach(function (h) {
      var li = document.createElement("li");
      li.className =
        "toc__item" + (h.tagName === "H3" ? " toc__item--h3" : "");
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      a.addEventListener("click", function (e) {
        e.preventDefault();
        h.scrollIntoView({ behavior: "smooth" });
      });
      li.appendChild(a);
      ul.appendChild(li);
    });
    nav.appendChild(ul);
    return nav;
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

  function fetchViewCounts() {
    var spans = Array.from(document.querySelectorAll(".goatcounter-count[data-path]"));
    if (!spans.length) return;
    var script = document.querySelector("script[data-goatcounter]");
    if (!script) return;
    var base = script.getAttribute("data-goatcounter").replace(/\/count$/, "");
    spans.forEach(function (span) {
      var path = span.getAttribute("data-path");
      fetch(base + "/counter/" + encodeURIComponent(path) + ".json")
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d.count) span.textContent = d.count; })
        .catch(function () {});
    });
  }

  function render(node) {
    $main.innerHTML = "";
    $main.appendChild(node);
    $main.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
    fetchViewCounts();
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
        '<h2 class="section__title">All posts</h2>' +
        '<span class="section__count">' + data.posts.length + "</span>" +
        "</div>" +
        '<div class="post-list"></div>' +
        "</section>"
    );
    var list = sec.querySelector(".post-list");
    data.posts.forEach(function (p) {
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
        '<span class="post-card__views"><span class="goatcounter-count" data-path="' +
        escapeHtml(basePath) + '#/posts/' +
        escapeHtml(p.slug) +
        '"></span></span>' +
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
          ? '<button class="post-card__tag" data-tag="' + escapeHtml(p.tag) + '">' + escapeHtml(p.tag) + "</button>"
          : "") +
        "</div>" +
        "</article>"
    );
    card.addEventListener("click", function () {
      location.hash = "#/posts/" + p.slug;
    });
    var tagBtn = card.querySelector(".post-card__tag");
    if (tagBtn) {
      tagBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        location.hash = "#/tags/" + tagBtn.dataset.tag;
      });
    }
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
        '  ·  <span class="goatcounter-count" data-path="' +
        escapeHtml(basePath) + '#/posts/' +
        escapeHtml(slug) +
        '"></span> views' +
        "</p>" +
        '<h1 class="post__title">' +
        escapeHtml(meta.title) +
        "</h1>" +
        '<div class="prose"></div>' +
        "</article>"
    );
    var proseEl = node.querySelector(".prose");
    proseEl.innerHTML = html;
    var toc = buildToc(proseEl);
    if (toc) proseEl.parentNode.insertBefore(toc, proseEl);
    render(node);
  }

  async function viewTag(tag) {
    markNav("posts");
    setTitle(tag);
    var data = await loadPostsIndex();
    var filtered = data.posts.filter(function (p) { return p.tag === tag; });
    var node = el('<div class="posts-page"></div>');

    node.appendChild(el(
      '<nav class="breadcrumb" aria-label="Breadcrumb">' +
      '<a href="#/" class="breadcrumb__item">Home</a>' +
      '<span class="breadcrumb__sep" aria-hidden="true">/</span>' +
      '<span class="breadcrumb__item breadcrumb__item--current">' + escapeHtml(tag) + '</span>' +
      '</nav>'
    ));

    var sec = el(
      '<section class="section">' +
      '<div class="section__head">' +
      '<h2 class="section__title">' + escapeHtml(tag) + '</h2>' +
      '<span class="section__count">' + filtered.length + '</span>' +
      '</div>' +
      '<div class="post-list"></div>' +
      '</section>'
    );
    filtered.forEach(function (p) { sec.querySelector(".post-list").appendChild(postCard(p)); });
    node.appendChild(sec);
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
      } else if (hash.startsWith("/tags/")) {
        var tag = hash.slice("/tags/".length);
        await viewTag(tag);
      } else if (hash === "/about") {
        await viewAbout();
      } else {
        showError("Page not found");
      }
    } catch (err) {
      console.error(err);
      showError(err.message || "Something went wrong");
    }
    if (!firstRoute && window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: location.pathname + location.hash });
    }
    firstRoute = false;
  }

  function fetchTodayTotal() {
    var today = new Date().toISOString().slice(0, 10);
    fetch("https://tzu.goatcounter.com/counter/TOTAL.json?start=" + today)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var span = document.getElementById("today-views");
        if (span && d.count) span.textContent = "today · " + d.count;
      })
      .catch(function () {});
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", function () {
    route();
    fetchTodayTotal();
  });
})();
