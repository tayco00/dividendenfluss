import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const [main, preload, updater, startup, windowState, workflow, tracker] = await Promise.all([
  readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
  readFile(new URL("../desktop/preload.cjs", import.meta.url), "utf8"),
  readFile(new URL("../desktop/update-service.mjs", import.meta.url), "utf8"),
  readFile(new URL("../desktop/startup.html", import.meta.url), "utf8"),
  readFile(new URL("../desktop/window-state.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8"),
  readFile(new URL("../app/tracker-app.tsx", import.meta.url), "utf8"),
]);

test("ships an installable GitHub update channel", () => {
  assert.equal(packageJson.version, "0.2.1");
  assert.match(packageJson.scripts["desktop:package"], /--publish never/);
  assert.equal(packageJson.dependencies["electron-updater"], "^6.8.9");
  assert.match(packageJson.dependencies.xlsx, /xlsx-0\.20\.3/);
  assert.equal(packageJson.build.win.target, "nsis");
  assert.equal(packageJson.build.nsis.artifactName, "Dividendenfluss-Setup.exe");
  assert.equal(packageJson.build.nsis.shortcutName, "Dividendenfluss");
  assert.deepEqual(packageJson.build.publish, [{ provider: "github", owner: "tayco00", repo: "dividendenfluss", releaseType: "release" }]);
});

test("checks at startup, manually and repeatedly and can install a downloaded update", () => {
  assert.match(updater, /from "electron-updater"/);
  assert.match(updater, /if \(started \|\| !app\.isPackaged \|\| isSmokeTest\) return/);
  assert.match(updater, /checkForUpdatesAndNotify\(\)/);
  assert.match(updater, /UPDATE_CHECK_INTERVAL_MS = 6 \* 60 \* 60 \* 1000/);
  assert.match(updater, /"download-progress"/);
  assert.match(updater, /quitAndInstall\(false, true\)/);
  assert.match(preload, /dividendenfluss:check-for-updates/);
  assert.match(preload, /dividendenfluss:update-status/);
  assert.match(main, /event\.sender !== mainWindow\.webContents/);
});

test("shows a skippable and accessible update phase before the app opens", () => {
  assert.match(main, /--startup-smoke-test/);
  assert.match(startup, /id="startup-progress" role="progressbar"/);
  assert.match(startup, /Ohne Update starten/);
  assert.match(preload, /skipStartupUpdate/);
});

test("publishes update metadata and installer together", () => {
  assert.match(workflow, /desktop-release\/Dividendenfluss-Setup\.exe/);
  assert.match(workflow, /desktop-release\/Dividendenfluss-Setup\.exe\.blockmap/);
  assert.match(workflow, /desktop-release\/latest\.yml/);
  assert.match(workflow, /gh release create/);
});

test("keeps native state outside the repository and retains Electron isolation", () => {
  assert.match(windowState, /app\.getPath\("userData"\)/);
  assert.match(windowState, /window-state\.json/);
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /setPermissionRequestHandler/);
});

test("exposes local profile management in the product", () => {
  assert.match(tracker, /ProfileSettings/);
  assert.match(tracker, /ProfilePicker/);
  assert.match(tracker, /Guten Tag, \$\{currentProfile/);
  assert.match(tracker, /Alle Profile, Positionen, Zahlungen/);
});
