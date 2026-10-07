import { defineConfig, type Connect } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
// Local QA only. This middleware is not part of dist or a hosted site.
const evidence: Connect.NextHandleFunction = async (req, res, next) => {
  if (req.method !== "POST") return next();
  const origin = req.headers.origin;
  if (
    !/^(localhost|127\.0\.0\.1):(5188|4188)$/.test(req.headers.host || "") ||
    (origin && origin !== `http://${req.headers.host}`)
  ) {
    res.statusCode = 403;
    res.end();
    return;
  }
  const name =
    new URL(req.url || "", "http://localhost").searchParams.get("name") || "";
  if (!/^[a-zA-Z0-9_-]{1,100}\.(png|json|webm)$/.test(name)) {
    res.statusCode = 400;
    res.end();
    return;
  }
  try {
    let size = 0;
    const parts: Buffer[] = [];
    for await (const p of req) {
      size += p.length;
      if (size > 64 * 1024 * 1024) throw Error("Too large");
      parts.push(p);
    }
    await mkdir(resolve("qa"), { recursive: true });
    await writeFile(resolve("qa", name), Buffer.concat(parts));
    res.end("saved");
  } catch (e) {
    res.statusCode = 400;
    res.end(String(e));
  }
};
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      input: {
        journey: resolve("index.html"),
        atmosphere: resolve("environment-lab/index.html"),
      },
    },
  },
  server: {
    port: 5188,
    strictPort: true,
    host: "127.0.0.1",
    watch: { ignored: ["**/qa/**", "**/.build/**"] },
  },
  preview: { port: 4188, strictPort: true, host: "127.0.0.1" },
  plugins: [
    {
      name: "local-evidence",
      configureServer(server) {
        server.middlewares.use("/__evidence", evidence);
      },
      configurePreviewServer(server) {
        server.middlewares.use("/__evidence", evidence);
      },
    },
  ],
});
