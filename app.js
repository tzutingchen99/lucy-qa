/* ─── SPA router + markdown loader ──────────────────────── */
(function () {
  var $main = document.getElementById("main");
  var postsIndex = null;
  var firstRoute = true;
  var basePath = location.pathname.replace(/index\.html$/, "");
  // Pre-rendered post pages (generate-pages.js) set these; app.js then skips
  // the router and layers enhancements onto the existing DOM instead.
  var STATIC_SLUG = document.body.dataset.staticPost || null;
  var ROOT = document.body.dataset.root || "";
  // Heading deep link: the hash is taken by routing, so the target heading id
  // travels in the query string (?h=...). Consumed once on first post render.
  var pendingHeading = new URLSearchParams(location.search).get("h");

  function headingHref(id) {
    // Static pages own their hash, so native fragments just work there.
    if (STATIC_SLUG) return "#" + id;
    return "?h=" + encodeURIComponent(id) + location.hash;
  }

  function postHref(slug) {
    return STATIC_SLUG ? "../" + slug + "/" : "posts/" + slug + "/";
  }

  /* ─── Marked config ───────────────────────────────────── */
  if (window.marked) {
    marked.setOptions({
      breaks: false,
      gfm: true,
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
      a.href = headingHref(h.id);
      a.textContent = h.textContent;
      a.addEventListener("click", function (e) {
        e.preventDefault();
        h.scrollIntoView({ behavior: "smooth" });
        history.replaceState(null, "", headingHref(h.id));
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
      a.href = headingHref(h.id);
      a.setAttribute("aria-hidden", "true");
      a.textContent = "#";
      a.addEventListener("click", function (e) {
        e.preventDefault();
        h.scrollIntoView({ behavior: "smooth" });
        history.replaceState(null, "", headingHref(h.id));
      });
      h.appendChild(a);
    });
  }

  function processCallouts(proseEl) {
    proseEl.querySelectorAll("blockquote").forEach(function (bq) {
      var firstP = bq.querySelector("p");
      if (!firstP) return;
      var match = firstP.textContent.trimStart().match(/^\[!(TLDR|TL;DR|NOTE|WARNING|IMPORTANT|TIP)\]/i);
      if (!match) return;
      var type = match[1].toUpperCase().replace(";", "");
      var labels = { TLDR: "TL;DR", NOTE: "Note", WARNING: "注意", IMPORTANT: "重點", TIP: "Tip" };
      firstP.innerHTML = firstP.innerHTML.replace(/^\s*\[![^\]]+\]\s*/i, "");
      var div = document.createElement("div");
      div.className = "callout callout--" + type.toLowerCase();
      var labelEl = document.createElement("p");
      labelEl.className = "callout__label";
      labelEl.textContent = labels[type] || type;
      div.appendChild(labelEl);
      while (bq.firstChild) div.appendChild(bq.firstChild);
      bq.parentNode.replaceChild(div, bq);
    });
  }

  function addLikeButton(articleNode, slug) {
    var KEY = "qa-likes";
    var likes = JSON.parse(localStorage.getItem(KEY) || "[]");
    var liked = likes.indexOf(slug) !== -1;
    var btn = document.createElement("button");
    btn.className = "like-btn" + (liked ? " like-btn--active" : "");
    btn.setAttribute("aria-pressed", liked ? "true" : "false");
    btn.setAttribute("aria-label", liked ? "已按讚" : "這篇有幫助");
    var icon = document.createElement("span");
    icon.className = "like-btn__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = liked ? "♥" : "♡";
    var text = document.createElement("span");
    text.textContent = liked ? "已按讚" : "這篇有幫助";
    btn.appendChild(icon);
    btn.appendChild(text);
    btn.addEventListener("click", function () {
      var current = JSON.parse(localStorage.getItem(KEY) || "[]");
      var isLiked = current.indexOf(slug) !== -1;
      if (isLiked) {
        current = current.filter(function (s) { return s !== slug; });
        btn.classList.remove("like-btn--active");
        icon.textContent = "♡";
        text.textContent = "這篇有幫助";
        btn.setAttribute("aria-pressed", "false");
        btn.setAttribute("aria-label", "這篇有幫助");
      } else {
        current.push(slug);
        btn.classList.add("like-btn--active");
        icon.textContent = "♥";
        text.textContent = "已按讚";
        btn.setAttribute("aria-pressed", "true");
        btn.setAttribute("aria-label", "已按讚");
        // Real like counts live in GoatCounter as events (localStorage is
        // per-browser UI state only). Unlikes aren't decremented.
        if (window.goatcounter && window.goatcounter.count) {
          window.goatcounter.count({ path: "like-" + slug, title: "Like: " + slug, event: true });
        }
      }
      localStorage.setItem(KEY, JSON.stringify(current));
    });
    articleNode.appendChild(btn);
  }

  function addAuthorBio(articleNode) {
    var bio = document.createElement("div");
    bio.className = "bio";
    var avatar = document.createElement("div");
    avatar.className = "bio__avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "L";
    var content = document.createElement("div");
    content.className = "bio__content";
    var name = document.createElement("p");
    name.className = "bio__name";
    name.textContent = "Lucy Chen";
    var desc = document.createElement("p");
    desc.className = "bio__desc";
    desc.textContent = "做 QA 五年。寫自動化、AI 輔助測試，以及 QA 的思考方式。";
    var links = document.createElement("div");
    links.className = "bio__links";
    [
      { href: "https://www.threads.com/@qauluru", text: "Threads" },
      { href: "https://github.com/tzutingchen99", text: "GitHub" },
      { href: "https://www.linkedin.com/in/ttc2024", text: "LinkedIn" },
      { href: "https://tzutingchen99.github.io/lucy-cv/", text: "CV ↗" },
    ].forEach(function (s) {
      var a = document.createElement("a");
      a.href = s.href;
      a.textContent = s.text;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      links.appendChild(a);
    });
    content.appendChild(name);
    content.appendChild(desc);
    content.appendChild(links);
    bio.appendChild(avatar);
    bio.appendChild(content);
    articleNode.appendChild(bio);
  }

  function addNewsletterBanner(articleNode) {
    var cta = document.createElement("p");
    cta.className = "newsletter-cta";
    cta.appendChild(document.createTextNode("新文章 → "));
    var threadsLink = document.createElement("a");
    threadsLink.href = "https://www.threads.com/@qauluru";
    threadsLink.textContent = "Threads @qauluru";
    threadsLink.target = "_blank";
    threadsLink.rel = "noopener noreferrer";
    cta.appendChild(threadsLink);
    cta.appendChild(document.createTextNode("  ·  "));
    var rssLink = document.createElement("a");
    rssLink.href = "feed.xml";
    rssLink.textContent = "RSS feed";
    cta.appendChild(rssLink);
    articleNode.appendChild(cta);
  }

  function buildSeriesNav(meta, allPosts) {
    if (!meta.tag) return null;
    var series = allPosts
      .filter(function (p) { return p.tag === meta.tag; })
      .sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
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
        a.href = postHref(p.slug);
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
    if (older) {
      var prevEl = document.createElement("div");
      prevEl.className = "post-nav__item post-nav__item--prev";
      var prevDir = document.createElement("span");
      prevDir.className = "post-nav__dir";
      prevDir.textContent = "← 上一篇";
      var prevLink = document.createElement("a");
      prevLink.href = postHref(older.slug);
      prevLink.className = "post-nav__title";
      prevLink.textContent = older.title;
      prevEl.appendChild(prevDir);
      prevEl.appendChild(prevLink);
      nav.appendChild(prevEl);
    }
    if (newer) {
      var nextEl = document.createElement("div");
      nextEl.className = "post-nav__item post-nav__item--next";
      var nextDir = document.createElement("span");
      nextDir.className = "post-nav__dir";
      nextDir.textContent = "下一篇 →";
      var nextLink = document.createElement("a");
      nextLink.href = postHref(newer.slug);
      nextLink.className = "post-nav__title";
      nextLink.textContent = newer.title;
      nextEl.appendChild(nextDir);
      nextEl.appendChild(nextLink);
      nav.appendChild(nextEl);
    }
    articleNode.appendChild(nav);
  }

  async function viewSearch() {
    markNav("search");
    setTitle("搜尋");
    var data = await loadPostsIndex();
    // Full-text index (built by generate-pages.js); fall back to metadata-only
    // search if it can't be fetched.
    var fullText = {};
    try {
      var idxRes = await fetch(ROOT + "search-index.json", { cache: "no-cache" });
      if (idxRes.ok) {
        (await idxRes.json()).forEach(function (entry) {
          fullText[entry.slug] = (entry.text || "").toLowerCase();
        });
      }
    } catch (err) {
      /* metadata-only fallback */
    }
    var node = el('<div class="search-page"></div>');
    var input = document.createElement("input");
    input.type = "search";
    input.className = "search-input";
    input.placeholder = "搜尋文章 — 標題、內文、標籤…";
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
              (p.tag && p.tag.toLowerCase().includes(q2)) ||
              (fullText[p.slug] && fullText[p.slug].includes(q2))
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
      // Posts moved from #/posts/{slug} to real URLs; show the sum of both
      // eras so counts don't visibly reset.
      var paths = [
        span.getAttribute("data-path"),
        span.getAttribute("data-path-legacy"),
      ].filter(Boolean);
      Promise.all(
        paths.map(function (path) {
          return fetch(base + "/counter/" + encodeURIComponent(path) + ".json")
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
              return d && d.count
                ? parseInt(String(d.count).replace(/[^\d]/g, ""), 10) || 0
                : 0;
            })
            .catch(function () { return 0; });
        })
      ).then(function (counts) {
        var total = counts.reduce(function (a, b) { return a + b; }, 0);
        if (total) span.textContent = "瀏覽 " + total;
      });
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

  /* ─── Collections (curated reading paths) ────────────── */
  var collectionsIndex = null;

  async function loadCollections() {
    if (collectionsIndex) return collectionsIndex;
    var res = await fetch(ROOT + "content/collections.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to load collections");
    collectionsIndex = (await res.json()).collections || [];
    return collectionsIndex;
  }

  // Side menu shared by the home page and the collections page.
  function buildCollectionsMenu(cols, data, currentSlug) {
    var visible = cols.filter(function (c) {
      return (c.posts || []).some(function (s) {
        return data.posts.some(function (p) { return p.slug === s; });
      });
    });
    if (!visible.length) return null;
    var menu = el(
      '<nav class="collections-menu" aria-label="合集選單">' +
        '<p class="collections-menu__label">合集</p>' +
        '<ul class="collections-menu__list"></ul>' +
        "</nav>"
    );
    var menuList = menu.querySelector(".collections-menu__list");
    visible.forEach(function (c) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#/collections/" + c.slug;
      a.textContent = c.title;
      var count = c.posts.filter(function (s) {
        return data.posts.some(function (p) { return p.slug === s; });
      }).length;
      var countEl = document.createElement("span");
      countEl.className = "collections-menu__count";
      countEl.textContent = count;
      a.appendChild(countEl);
      if (c.slug === currentSlug) a.setAttribute("aria-current", "true");
      li.appendChild(a);
      menuList.appendChild(li);
    });
    return menu;
  }

  async function viewCollections(slugParam) {
    markNav("collections");
    var data = await loadPostsIndex();
    var cols = (await loadCollections()).filter(function (c) {
      return (c.posts || []).some(function (s) {
        return data.posts.some(function (p) { return p.slug === s; });
      });
    });
    if (!cols.length) {
      showError("還沒有合集");
      return;
    }
    var current = cols.find(function (c) { return c.slug === slugParam; }) || cols[0];
    setTitle(current.title + " — 合集", current.description);

    var node = el('<div class="collections-page"></div>');

    var body = document.createElement("div");
    body.className = "collections-body";
    body.appendChild(
      el(
        '<section class="hero">' +
          '<p class="hero__kicker">Collection</p>' +
          '<h1 class="hero__title">' + escapeHtml(current.title) + "</h1>" +
          (current.description
            ? '<p class="hero__lede">' + escapeHtml(current.description) + "</p>"
            : "") +
          "</section>"
      )
    );
    var list = document.createElement("ol");
    list.className = "collection-list";
    current.posts.forEach(function (slug) {
      var p = data.posts.find(function (x) { return x.slug === slug; });
      if (!p) return; // unpublished entries are skipped silently
      var li = document.createElement("li");
      li.className = "collection-item";
      var a = document.createElement("a");
      a.className = "collection-item__title";
      a.href = postHref(p.slug);
      a.textContent = p.title;
      li.appendChild(a);
      if (p.summary) {
        var sum = document.createElement("p");
        sum.className = "collection-item__summary";
        sum.textContent = p.summary;
        li.appendChild(sum);
      }
      var meta = document.createElement("p");
      meta.className = "collection-item__meta";
      meta.textContent = fmtDate(p.date);
      li.appendChild(meta);
      list.appendChild(li);
    });
    body.appendChild(list);

    var menu = buildCollectionsMenu(cols, data, current.slug);

    node.appendChild(body);
    if (menu) node.appendChild(menu);
    render(node);
  }

  /* ─── Data ────────────────────────────────────────────── */
  async function loadPostsIndex() {
    if (postsIndex) return postsIndex;
    var res = await fetch(ROOT + "content/posts.json", { cache: "no-cache" });
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
    var res = await fetch(ROOT + path, { cache: "no-cache" });
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

    // Post list on the left, collections menu on the right.
    var grid = el('<div class="home-grid"></div>');
    grid.appendChild(sec);
    try {
      var menu = buildCollectionsMenu(await loadCollections(), data, null);
      if (menu) grid.appendChild(menu);
    } catch (err) {
      /* collections are optional on home */
    }
    node.appendChild(grid);

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
        escapeHtml(basePath + "posts/" + p.slug + "/") +
        '" data-path-legacy="' +
        escapeHtml(basePath + "#/posts/" + p.slug) +
        '"></span></span>' +
        "</div>" +
        '<div class="post-card__body">' +
        // Real link so keyboard / screen-reader users can open the post;
        // the card-wide click listener is a pointer convenience on top.
        '<h3 class="post-card__title"><a href="' +
        escapeHtml(postHref(p.slug)) +
        '">' +
        escapeHtml(p.title) +
        "</a></h3>" +
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
      location.href = postHref(p.slug);
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
    // Posts live at real URLs now (generate-pages.js); this route only
    // forwards old #/posts/ links there. Unknown slugs still get a nice 404.
    var data = await loadPostsIndex();
    var meta = data.posts.find(function (p) {
      return p.slug === slug;
    });
    if (!meta) {
      showError("Post not found (or still in draft)");
      return;
    }
    var fragment = pendingHeading ? "#" + pendingHeading : "";
    location.replace(basePath + "posts/" + slug + "/" + fragment);
  }

  function addCopyLinkButton(metaEl) {
    var copyLinkBtn = document.createElement("button");
    copyLinkBtn.className = "copy-link-btn";
    copyLinkBtn.textContent = "link";
    copyLinkBtn.setAttribute("aria-label", "複製文章連結");
    copyLinkBtn.addEventListener("click", function () {
      navigator.clipboard.writeText(location.href).then(function () {
        copyLinkBtn.textContent = "✓";
        setTimeout(function () { copyLinkBtn.textContent = "link"; }, 2000);
      }).catch(function () {});
    });
    metaEl.appendChild(document.createTextNode("  ·  "));
    metaEl.appendChild(copyLinkBtn);
  }

  /* ─── Static post pages (pre-rendered by generate-pages.js) ── */
  async function enhanceStaticPost() {
    var article = document.querySelector("article.post");
    if (!article) return;
    var proseEl = article.querySelector(".prose");
    processCallouts(proseEl);
    var metaEl = article.querySelector(".post__meta");
    if (metaEl) addCopyLinkButton(metaEl);

    var data = null;
    try {
      data = await loadPostsIndex();
    } catch (err) {
      console.error(err); // index unavailable → skip nav extras, keep the rest
    }
    var meta =
      data &&
      data.posts.find(function (p) {
        return p.slug === STATIC_SLUG;
      });
    // Series nav and prev/next are pre-rendered by generate-pages.js;
    // only build them here if the static page somehow lacks them.
    if (meta && !article.querySelector(".series")) {
      var seriesNav = buildSeriesNav(meta, data.posts);
      if (seriesNav) article.insertBefore(seriesNav, proseEl);
    }
    var toc = buildToc(proseEl); // before addHeadingAnchors — TOC reads heading text
    if (toc) article.insertBefore(toc, proseEl);
    addHeadingAnchors(proseEl);
    addCopyButtons(proseEl);
    if (window.Prism) Prism.highlightAllUnder(proseEl);
    // Like / bio / CTA belong between the prose and the pre-rendered post-nav.
    var postNav = article.querySelector(".post-nav");
    var tail = document.createElement("div");
    if (postNav) article.insertBefore(tail, postNav);
    else article.appendChild(tail);
    addLikeButton(tail, STATIC_SLUG);
    addAuthorBio(tail);
    addNewsletterBanner(tail);
    if (meta && !postNav) addPrevNext(article, meta, data.posts);
    fetchViewCounts();
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
    // A ?h= heading deep link belongs to the page it was copied from; drop it
    // when the route changes so it doesn't leak onto the next page's URL.
    if (!firstRoute && new URLSearchParams(location.search).has("h")) {
      history.replaceState(null, "", location.pathname + location.hash);
    }
    try {
      if (hash === "/" || hash === "") {
        await viewHome();
      } else if (hash === "/posts") {
        await viewPosts();
      } else if (hash.startsWith("/posts/")) {
        var slug = decodeURIComponent(hash.slice("/posts/".length));
        await viewPost(slug);
      } else if (hash.startsWith("/tags/")) {
        var tag = decodeURIComponent(hash.slice("/tags/".length));
        await viewTag(tag);
      } else if (hash === "/collections") {
        await viewCollections();
      } else if (hash.startsWith("/collections/")) {
        await viewCollections(decodeURIComponent(hash.slice("/collections/".length)));
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
    // Local date, not UTC — otherwise 00:00–08:00 (UTC+8) shows yesterday's count.
    var now = new Date();
    var today =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0");

    fetch("https://tzu.goatcounter.com/counter/TOTAL.json?start=" + today)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var span = document.getElementById("today-views");
        if (span && d.count) span.textContent = "今日瀏覽 " + d.count;
      })
      .catch(function () {});

    fetch("https://tzu.goatcounter.com/counter/TOTAL.json")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var span = document.getElementById("total-views");
        if (span && d.count) span.textContent = "累計瀏覽 " + d.count;
      })
      .catch(function () {});
  }

  /* ─── Font size control ──────────────────────────────── */
  var storedSize = parseFloat(localStorage.getItem("qa-font-size"));
  var proseSize = (storedSize && storedSize >= 0.9 && storedSize <= 1.2) ? storedSize : 1.02;
  document.documentElement.style.setProperty("--prose-size", proseSize + "rem");
  document.querySelectorAll(".font-ctrl__btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var delta = parseInt(btn.dataset.delta, 10) * 0.06;
      proseSize = Math.round(Math.min(1.2, Math.max(0.9, proseSize + delta)) * 100) / 100;
      document.documentElement.style.setProperty("--prose-size", proseSize + "rem");
      localStorage.setItem("qa-font-size", proseSize);
    });
  });

  /* ─── Keyboard shortcuts ─────────────────────────────── */
  function navigatePost(direction) {
    if (!STATIC_SLUG || !postsIndex) return; // posts are static pages now
    var idx = postsIndex.posts.findIndex(function (p) { return p.slug === STATIC_SLUG; });
    var target = direction > 0 ? postsIndex.posts[idx - 1] : postsIndex.posts[idx + 1];
    if (target) location.href = postHref(target.slug);
  }

  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case "/":
        e.preventDefault();
        if (STATIC_SLUG) location.href = ROOT + "#/search";
        else location.hash = "#/search";
        break;
      case "Escape":
        if (location.hash === "#/search") location.hash = "#/";
        break;
      case "j":
        navigatePost(1);
        break;
      case "k":
        navigatePost(-1);
        break;
    }
  });

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

  document.addEventListener("DOMContentLoaded", function () {
    if (STATIC_SLUG) {
      enhanceStaticPost();
    } else {
      window.addEventListener("hashchange", route);
      route();
    }
    fetchViewStats();
  });
})();
