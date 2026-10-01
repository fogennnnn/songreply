/**
 * Zero-dependency static file server (node:http only) for the songreply demo.
 * Serves the project root plus /public (model.json). Run: npm run demo,
 * then open http://localhost:8082/
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    let rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "");
    if (rel === "model.json") rel = path.join("public", "model.json");
    const abs = path.join(root, rel);
    if (abs !== root && !abs.startsWith(root + path.sep)) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("forbidden");
      return;
    }
    if (path.basename(abs).startsWith(".")) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("forbidden");
      return;
    }
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch (_e) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }
    let target = abs;
    if (stat.isDirectory()) {
      const indexFile = path.join(abs, "index.html");
      try {
        if (fs.statSync(indexFile).isFile()) target = indexFile;
        else throw new Error("no index");
      } catch (_e) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("no index here");
        return;
      }
    }
    res.writeHead(200, { "content-type": MIME[path.extname(target).toLowerCase()] ?? "application/octet-stream" });
    res.end(fs.readFileSync(target));
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(`server error: ${e?.message ?? e}`);
  }
});

const port = Number(process.env.PORT ?? 8082);
server.listen(port, () => {
  console.log(`songreply: http://localhost:${port}/`);
});
