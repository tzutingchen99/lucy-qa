#!/usr/bin/env node
// Minimal static server for tests: node tests/serve.js [port]
// (fetch() 對 file:// 不會工作，測試需要真的 HTTP server。)

const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.argv[2]) || 8123;
const root = path.resolve(__dirname, "..");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
};

http
  .createServer(function (req, res) {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    const file = path.normalize(path.join(root, urlPath));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, function (err, buf) {
      if (err) {
        // Same behavior as GitHub Pages: serve the custom 404.html if present.
        return fs.readFile(path.join(root, "404.html"), function (err2, buf404) {
          if (err2) {
            res.writeHead(404, { "content-type": "text/plain" });
            return res.end("not found: " + urlPath);
          }
          res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
          res.end(buf404);
        });
      }
      res.writeHead(200, {
        "content-type": mime[path.extname(file).toLowerCase()] || "application/octet-stream",
      });
      res.end(buf);
    });
  })
  .listen(port, "127.0.0.1", function () {
    console.log("serving " + root + " on http://127.0.0.1:" + port + "/");
  });
