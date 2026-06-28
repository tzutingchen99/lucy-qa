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

  function updateMeta(title, description) {
    var def = "關於自動化、AI 輔助測試，以及把測試寫成意圖而不是實作的筆記。";
    var desc = description || def;
    document.querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]').forEach(function (m) {
      m.setAttribute("content", title);
    });
    document.querySelectorAll('meta[property="og:description"], meta[name="twitter:description"]').forEach(function (m) {
      m.setAttribute("content", desc);
    });
    var urlMeta = document.querySelector('meta[property="og:url"]');
    if (urlMeta) urlMeta.setAttribute("content", location.href);
  }

  function setTitle(title, description) {
    var fullTitle = title ? title + " — QA 筆記" : "QA 筆記";
    document.title = fullTitle;
    updateMeta(fullTitle, description);
  }

  function markNav(name) {
    document.querySelectorAll(".strip__nav a[data-nav]").forEach(function (a) {
      if (a.dataset.nav === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function readingTime(text) {
    var clean = text.replace(/[#*`_~\[\]()>|]/g, " ").replace(/\s+/g, " ");
    var zh = (clean.match(/[一-鿿㐀-䶿]/g) || []).length;
    var en = (clean.match(/[a-zA-Z]{2,}/g) || []).length;
    return Math.max(1, Math.ceil(zh / 300 + en / 200));
  }

  function addCopyButtons(proseEl) {
    proseEl.querySelectorAll("pre").forEach(function (pre) {
      var btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "copy";
      btn.setAttribute("aria-label", "複製程式碼");
      btn.addEventListener("click", function () {
        var code = pre.querySelector("code");
        var text = code ? code.textContent : pre.textContent;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function () {
            btn.textContent = "done ✓";
            btn.classList.add("copy-btn--done");
            setTimeout(function () {
              btn.textContent = "copy";
              btn.classList.remove("copy-btn--done");
            }, 2000);
          }).catch(function () {});
        }
      });
      pre.appendChild(btn);
    });
  }

  function addHeadingAnchors(proseEl) {
    proseEl.querySelectorAll("h2, h3").forEach(function (h) {
      if (!h.id) h.id = slugify(h.textContent);
      var a = document.createElement("a");
      a.className = "heading-anchor";
      a.href = "#" + h.id;
      a.setAttribute("aria-hidden", "true");
      a.textContent = "#";
      a.addEventListener("click", function (e) {
        e.preventDefault();
        h.scrollIntoView({ behavior: "smooth" });
      });
      h.appendChild(a);
    });
  }

  function addRelatedPosts(articleNode, meta, allPosts) {
    if (!meta.tag) return;
    var related = allPosts.filter(function (p) {
      return p.slug !== meta.slug && p.tag === meta.tag;
    });
    if (!related.length) return;
    var section = document.createElement("div");
    section.className = "related";
    var label = document.createElement("p");
    label.className = "related__label";
    label.textContent = "同系列";
    section.appendChild(label);
    var ul = document.createElement("ul");
    ul.className = "related__list";
    related.slice(0, 3).forEach(function (p) {
      var li = document.createElement("li");
      li.className = "related__item";
      var a = document.createElement("a");
      a.href = "#/posts/" + p.slug;
      a.textContent = p.title;
      var dateSpan = document.createElement("span");
      dateSpan.className = "related__date";
      dateSpan.textContent = fmtDate(p.date);
      li.appendChild(a);
      li.appendChild(dateSpan);
      ul.appendChild(li);
    });
    section.appendChild(ul);
    articleNode.appendChild(section);
  }

  function buildSeriesNav(meta, allPosts) {
    if (!meta.tag) return null;
    var series = allPosts
      .filter(function (p) { return p.tag === meta.tag; })
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (series.length < 2) return null;
    var idx = series.findIndex(function (p) { return p.slug === meta.slug; });
    var nav = document.createElement("nav");
    nav.className = "series";
    nav.setAttribute("aria-label", meta.tag + " 系列");
    var label = document.createElement("p");
    label.className = "series__label";
    label.textContent = meta.tag + " 系列  " + (idx + 1) + " / " + series.length;
    nav.appendChild(label);
    var ul = document.createElement("ul");
    ul.className = "series__list";
    series.forEach(function (p, i) {
      var li = document.createElement("li");
      li.className = "series__item" + (p.slug === meta.slug ? " series__item--current" : "");
      var num = document.createElement("span");
      num.className = "series__num";
      num.textContent = (i + 1) + ".";
      li.appendChild(num);
      if (p.slug === meta.slug) {
        var span = document.createElement("span");
        span.textContent = p.title;
        li.appendChild(span);
      } else {
        var a = document.createElement("a");
        a.href = "#/posts/" + p.slug;
        a.textContent = p.title;
        li.appendChild(a);
      }
      ul.appendChild(li);
    });
    nav.appendChild(ul);
    return nav;
  }

  function addPrevNext(articleNode, meta, allPosts) {
    var idx = allPosts.findIndex(function (p) { return p.slug === meta.slug; });
    var newer = allPosts[idx - 1];
    var older = allPosts[idx + 1];
    if (!newer && !older) return;
    var nav = document.createElement("nav");
    nav.className = "post-nav";
    nav.setAttribute("aria-label", "文章導航");
    var prevEl = document.createElement("div");
    prevEl.className = "post-nav__item post-nav__item--prev";
    if (older) {
      var prevDir = document.createElement("span");
      prevDir.className = "post-nav__dir";
      prevDir.textContent = "← 上一篇";
      var prevLink = document.createElement("a");
      prevLink.href = "#/posts/" + older.slug;
      prevLink.className = "post-nav__title";
      prevLink.textContent = older.title;
      prevEl.appendChild(prevDir);
      prevEl.appendChild(prevLink);
    }
    nav.appendChild(prevEl);
    var nextEl = document.createElement("div");
    nextEl.className = "post-nav__item post-nav__item--next";
    if (newer) {
      var nextDir = document.createElement("span");
      nextDir.className = "post-nav__dir";
      nextDir.textContent = "下一篇 →";
      var nextLink = document.createElement("a");
      nextLink.href = "#/posts/" + newer.slug;
      nextLink.className = "post-nav__title";
      nextLink.textContent = newer.title;
      nextEl.appendChild(nextDir);
      nextEl.appendChild(nextLink);
    }
    nav.appendChild(nextEl);
    articleNode.appendChild(nav);
  }

  async function viewSearch() {
    markNav("search");
    setTitle("搜尋");
    var data = await loadPostsIndex();
    var node = el('<div class="search-page"></div>');
    var input = document.createElement("input");
    input.type = "search";
    input.className = "search-input";
    input.placeholder = "搜尋文章 — 標題、摘要、標籤…";
    input.setAttribute("aria-label", "搜尋文章");
    node.appendChild(input);
    var results = document.createElement("div");
    results.className = "search-results";
    node.appendChild(results);
    function doSearch(q) {
      var q2 = q.trim().toLowerCase();
      results.innerHTML = "";
      var matched = q2
        ? data.posts.filter(function (p) {
            return (
              (p.title && p.title.toLowerCase().includes(q2)) ||
              (p.summary && p.summary.toLowerCase().includes(q2)) ||
              (p.tag && p.tag.toLowerCase().includes(q2))
            );
          })
        : data.posts;
      if (!matched.length) {
        var empty = document.createElement("p");
        empty.className = "search-empty";
        empty.textContent = "沒有符合的文章";
        results.appendChild(empty);
        return;
      }
      matched.forEach(function (p) { results.appendChild(postCard(p)); });
    }
    input.addEventListener("input", function () { doSearch(input.value); });
    render(node);
    doSearch("");
    setTimeout(function () { input.focus(); }, 50);
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
    setTitle(meta.title, meta.summary);
    var md = await loadMarkdown("content/posts/" + slug + ".md");
    var mins = readingTime(md);
    var html = marked.parse(md);
    var node = el(
      '<article class="post">' +
        '<a href="#/posts" class="post__back">← All posts</a>' +
        '<p class="post__meta">' +
        escapeHtml(fmtDate(meta.date)) +
        (meta.tag ? "  ·  " + escapeHtml(meta.tag) : "") +
        "  ·  " + mins + " min read" +
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
    var seriesNav = buildSeriesNav(meta, data.posts);
    if (seriesNav) node.insertBefore(seriesNav, proseEl);
    var toc = buildToc(proseEl);
    if (toc) node.insertBefore(toc, proseEl);
    addHeadingAnchors(proseEl);
    addCopyButtons(proseEl);
    if (window.Prism) Prism.highlightAllUnder(proseEl);
    addPrevNext(node, meta, data.posts);
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
      } else if (hash === "/search") {
        await viewSearch();
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

  function fetchViewStats() {
    var now = new Date();
    var today = now.toISOString().slice(0, 10);
    var monthStart = today.slice(0, 8) + "01";

    fetch("https://tzu.goatcounter.com/counter/TOTAL.json?start=" + today)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var span = document.getElementById("today-views");
        if (span && d.count) span.textContent = "today · " + d.count;
      })
      .catch(function () {});

    fetch("https://tzu.goatcounter.com/counter/TOTAL.json?start=" + monthStart)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var span = document.getElementById("month-views");
        if (span && d.count) span.textContent = "this month · " + d.count;
      })
      .catch(function () {});
  }

  /* ─── Progress bar + Back to top ─────────────────────── */
  var progressBar = document.getElementById("progress-bar");
  var backToTopBtn = document.getElementById("back-to-top");

  function updateScroll() {
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;

    if (progressBar) {
      if ($main.querySelector(".post")) {
        progressBar.style.width = pct + "%";
        progressBar.classList.toggle("active", scrollTop > 0);
      } else {
        progressBar.style.width = "0%";
        progressBar.classList.remove("active");
      }
    }

    if (backToTopBtn) {
      backToTopBtn.classList.toggle("visible", scrollTop > 400);
    }
  }

  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  window.addEventListener("scroll", updateScroll, { passive: true });

  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", function () {
    if (window.Prism && Prism.plugins && Prism.plugins.autoloader) {
      Prism.plugins.autoloader.languages_path =
        "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/";
    }
    route();
    fetchViewStats();
  });
})();
