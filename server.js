import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import analyze from "./api/analyze.js";

const root = dirname(fileURLToPath(import.meta.url));
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/simulator.js", ["simulator.js", "text/javascript; charset=utf-8"]],
]);

const port = Number(process.env.PORT || 3000);

createServer(async (req, res) => {
  const path = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
  if (path === "/api/analyze") {
    try {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 4096) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "REQUEST_TOO_LARGE" }));
          return;
        }
      }
      req.body = raw || "{}";
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (body) => { res.end(JSON.stringify(body)); return res; };
      await analyze(req, res);
    } catch {
      if (!res.writableEnded) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "SERVER_ERROR" }));
      }
    }
    return;
  }

  const entry = files.get(path);
  if (!entry || req.method !== "GET") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  try {
    const body = await readFile(join(root, entry[0]));
    res.writeHead(200, { "Content-Type": entry[1], "Cache-Control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Akim simulator: http://localhost:${port}`);
});
