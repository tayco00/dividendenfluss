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
  assert.match(html, /favicon\.png\?v=3/);
  assert.doesNotMatch(html, /100 % lokal|Lokal gespeichert|Nur auf diesem Gerät|Daten & Schutz/);
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

test("opens Dividendenfluss in a dedicated Windows application window", async () => {
  const [desktopMain, packageJson, gitignore] = await Promise.all([
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
  ]);
  assert.match(desktopMain, /new BrowserWindow/);
  assert.match(desktopMain, /title: "Dividendenfluss"/);
  assert.match(desktopMain, /Menu\.setApplicationMenu\(null\)/);
  assert.match(desktopMain, /dividendenfluss:\/\/app\/index\.html/);
  assert.match(packageJson, /"artifactName": "Dividendenfluss\.\$\{ext\}"/);
  assert.match(gitignore, /\/Dividendenfluss\.exe/);
});

test("offers quick dividend entry and full portfolio details", async () => {
  const [tracker, layout, entryStyles] = await Promise.all([
    readFile(new URL("../app/tracker-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/position-entry-v2.css", import.meta.url), "utf8"),
  ]);
  assert.match(tracker, /Schneller Eintrag/);
  assert.match(tracker, /Portfolio-Details/);
  assert.match(tracker, /Eingegangene Dividende \(netto/);
  assert.match(tracker, /Zahltag<input name="payDate" type="date"/);
  assert.match(tracker, /status: "Erhalten"/);
  assert.match(tracker, /payDate,/);
  assert.match(layout, /position-entry-v2\.css/);
  assert.match(entryStyles, /\.entry-choice\s*\{[\s\S]*display: grid/);
});

test("offers standardized sectors without dropping existing labels", async () => {
  const tracker = await readFile(new URL("../app/tracker-app.tsx", import.meta.url), "utf8");
  assert.match(tracker, /const sectorOptions = \[/);
  assert.match(tracker, /Informationstechnologie/);
  assert.match(tracker, /Kommunikationsdienste/);
  assert.match(tracker, /<select name="sector"/);
  assert.match(tracker, /hasCustomSector/);
  assert.doesNotMatch(tracker, /Sektor<input name="sector"/);
});

test("provides readable text sizes as a local preference", async () => {
  const [tracker, layout, typography] = await Promise.all([
    readFile(new URL("../app/tracker-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/typography.css", import.meta.url), "utf8"),
  ]);
  assert.match(tracker, /Textgröße/);
  assert.match(tracker, /Kompakt/);
  assert.match(tracker, /Standard/);
  assert.match(tracker, /Groß/);
  assert.match(tracker, /Einstellungen/);
  assert.match(tracker, /Startansicht/);
  assert.doesNotMatch(tracker, /DATENSOUVERÄNITÄT|Deine Zahlen verlassen dieses Gerät nicht|100 % lokal|Lokal gespeichert|Nur auf diesem Gerät|Daten & Schutz/);
  assert.match(layout, /typography\.css/);
  assert.match(typography, /data-text-size="large"/);
  assert.match(typography, /--text-body: 14px/);
});
