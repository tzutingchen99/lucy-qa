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
├── index.html              # SPA shell（首頁 / 文章列表 / 文章內頁 / about）
├── style.css               # 樣式（tokens 跟 lucy-cv 同步）
├── theme.js                # light/dark theme toggle
├── app.js                  # 客戶端路由 + markdown 渲染
├── content/
│   ├── posts.json          # 文章 metadata
│   ├── about.md            # About 頁內容
│   ├── posts/              # 已發布文章
│   │   ├── hello.md
│   │   ├── intent-vs-implementation.md
│   │   ├── bug-language.md
│   │   └── test-docs.md
│   └── drafts/             # 草稿（不 deploy、不公開）
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

3. 執行 `node generate-feed.js` 更新 RSS feed
4. commit + push。完。

文章順序按 `date` 自動排序，最新在前。

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
