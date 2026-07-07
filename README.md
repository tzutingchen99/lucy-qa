# Lucy QA — notes on testing

QA 主題的個人網站。純 HTML / CSS / JS，無框架、零 build。

## 本地預覽

```bash
cd ~/lucy-qa
python3 -m http.server 8000
```

開 <http://127.0.0.1:8000/>。

不能直接雙擊 `index.html` — `fetch()` 對 `file://` 不會工作（CORS），一定要透過 HTTP server。

## 目錄結構

```
lucy-qa/
├── index.html              # SPA shell（首頁 / 文章列表 / 文章內頁 / about / search）
├── style.css               # 樣式（tokens 跟 lucy-cv 同步）
├── theme.js                # light/dark theme toggle
├── app.js                  # 客戶端路由 + markdown 渲染
├── generate-feed.js        # 產生 feed.xml，含全文（CI 自動跑）
├── generate-sitemap.js     # 產生 sitemap.xml（CI 自動跑）
├── generate-pages.js       # 預渲染文章頁 / 首頁列表 / 404 / 搜尋索引（CI 自動跑）
├── generate-og.js          # 產生 og/ 分享圖（只能本地跑：npm run og）
├── posts/                  # 預渲染的文章頁（產出物，會 commit）
├── og/                     # 分享圖 1200×630（產出物，會 commit）
├── vendor/                 # marked + Prism（自帶，不用 CDN；新語言要加對應 prism-*.js）
├── search-index.json       # 全文搜尋索引（產出物）
├── 404.html                # 自訂 404（產出物）
├── feed.xml                # RSS feed（產出物）
├── sitemap.xml             # Sitemap（產出物）
├── robots.txt
├── content/
│   ├── posts.json          # 文章 metadata
│   ├── collections.json    # 合集（有排序的閱讀路線，#/collections）
│   ├── about.md            # About 頁內容
│   ├── posts/              # 已發布文章（*.md，slug 對應 posts.json）
│   └── drafts/             # 草稿（gitignore — 不進 repo、不公開，注意自行備份）
└── README.md
```

## 新增文章

1. 在 `content/posts/{slug}.md` 寫 markdown
2. 在 `content/posts.json` 的 `posts` 陣列加 entry：

   ```json
   {
     "slug": "my-new-post",
     "title": "文章標題",
     "date": "2026-07-01",
     "tag": "automation",
     "summary": "一句話摘要，會出現在列表上。",
     "status": "published"
   }
   ```

3. （可選）`npm run og` 產生這篇的專屬分享圖——不跑的話會先用全站圖 fallback
4. commit + push。完。

push 之後 GitHub Actions 會自動：驗證 `posts.json` ↔ `content/posts/*.md` 一致
（slug 唯一、日期合法、檔案存在）、重新產生 feed.xml、sitemap.xml 和
`posts/{slug}/` 預渲染頁並 commit、跑 Playwright 冒煙測試。

文章的正式網址是 `/posts/{slug}/`（預渲染的真實頁面，爬蟲和社群分享
都看得到完整內容）；舊的 `#/posts/{slug}` 連結會自動轉址過去。

文章順序按 `date` 自動排序，最新在前。

## 合集（閱讀路線）

`content/collections.json` 定義有順序的閱讀路線（跟 tag 不同：tag 是分類，
合集是排好序的推薦讀法），顯示在 `#/collections`，右側選單切換。
只能收錄 published 文章（CI 會驗證）。新增合集：在 `collections` 陣列加
`{ slug, title, description, posts: [slug...] }`。

## 本地開發指令

```bash
npm install                  # 第一次；裝測試工具（網站本身零 build，不需要）
npm run validate             # 檢查 posts.json 與文章檔案一致
npm test                     # Playwright 冒煙測試（會自己起 server）
npm run feed && npm run sitemap && npm run pages   # 手動重生產出物（CI 也會做）
npm run og                   # 重生分享圖（需要本地瀏覽器，CI 不做）
```

## 草稿 / 發佈

- `status: "draft"` → **公開站不會顯示**（連直接點網址也是 404）
- `status: "published"` → 顯示

公開站的 `app.js` 會自動 filter 掉 draft。要預覽草稿，把 status 暫時改成 `published` 跑本地 server 看。

## 主題（light / dark）

切換鈕在右上角。會記到 `localStorage.qa-theme`，下次直接套用。Tokens 跟 `lucy-cv` 同步，方便整體視覺一致。

## 部署到 GitHub Pages

```bash
cd ~/lucy-qa
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin git@github.com:tzutingchen99/lucy-qa.git
git push -u origin main
```

到 GitHub repo 的 **Settings → Pages**：

- Source: `Deploy from a branch`
- Branch: `main` / `/ (root)`
- Save

等 1–2 分鐘，網站會在 `https://tzutingchen99.github.io/lucy-qa/` 上線。

## 跟 lucy-cv 的關係

- `tzutingchen99.github.io/lucy-cv/` → 履歷站（lucy-cv repo）
- `tzutingchen99.github.io/lucy-qa/` → QA 筆記站（本 repo）

兩個 repo 獨立，但 design tokens 一致；header / footer 互相連結。
