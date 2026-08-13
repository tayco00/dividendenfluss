import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the finished dividend tracker shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Dividendenfluss/);
  assert.match(html, /dein lokaler Dividendentracker/);
  assert.doesNotMatch(html, /codex-preview|Starter Project|Your site is taking shape/i);
});

test("keeps personal data in the browser and repository-safe", async () => {
  const [storage, hosting, gitignore, packageJson] = await Promise.all([
    readFile(new URL("../lib/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(storage, /indexedDB\.open/);
  assert.deepEqual(JSON.parse(hosting), { d1: null, r2: null });
  assert.match(gitignore, /dividenden-backup/);
  assert.match(gitignore, /portfolio-export/);
  assert.match(gitignore, /\/\.runtime\//);
  assert.match(gitignore, /\.launcher\/legacy-shortcuts/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
