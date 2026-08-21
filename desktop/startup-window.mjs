import { app, BrowserWindow } from "electron";
import path from "node:path";

const MINIMUM_VISIBLE_MS = 900;
const INITIAL_STATUS = {
  title: "Dividendenfluss startet",
  detail: "Wir prüfen kurz, ob eine neue Version bereitsteht.",
  progress: null,
  label: "Updateprüfung",
  canSkip: true,
};

export function createStartupWindowController({
  browserPreferences,
  isSmokeTest,
  onFinished,
  onLoadFailure,
}) {
  let window = null;
  let rendererReady = false;
  let shownAt = 0;
  let finishTimer = null;
  let status = INITIAL_STATUS;

  function setStatus(nextStatus) {
    status = { ...status, ...nextStatus };
    if (!rendererReady || !window || window.isDestroyed()) return;
    void window.webContents.executeJavaScript(
      `window.setDividendenflussStatus?.(${JSON.stringify(status)})`,
    );
  }

  function finish(extraDelayMs = 0) {
    if (finishTimer) return;
    const elapsed = shownAt ? Date.now() - shownAt : MINIMUM_VISIBLE_MS;
    const delay = Math.max(extraDelayMs, MINIMUM_VISIBLE_MS - elapsed);
    finishTimer = setTimeout(() => {
      finishTimer = null;
      if (window && !window.isDestroyed()) window.close();
      onFinished();
    }, delay);
  }

  function create() {
    if (window && !window.isDestroyed()) return window;
    window = new BrowserWindow({
      width: 470,
      height: 360,
      show: false,
      frame: false,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      title: "Dividendenfluss",
      backgroundColor: "#121814",
      icon: path.join(app.getAppPath(), "desktop", "icon.png"),
      webPreferences: browserPreferences(),
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith("file://")) event.preventDefault();
    });
    window.once("ready-to-show", () => {
      shownAt = Date.now();
      if (!isSmokeTest) window.show();
    });
    window.webContents.once("did-fail-load", () => {
      if (isSmokeTest) app.exit(1);
      else onLoadFailure();
    });
    window.webContents.once("did-finish-load", async () => {
      rendererReady = true;
      setStatus(status);
      if (!isSmokeTest) return;
      const isReady = await window.webContents.executeJavaScript(
        "Boolean(document.title === 'Dividendenfluss' && document.querySelector('#startup-title') && document.querySelector('#startup-progress[role=progressbar]') && document.querySelector('#startup-skip'))",
      );
      app.exit(isReady ? 0 : 1);
    });
    window.on("closed", () => { window = null; });
    void window.loadFile(path.join(app.getAppPath(), "desktop", "startup.html"));
    return window;
  }

  return {
    create,
    finish,
    setStatus,
    show() {
      if (!window || window.isDestroyed()) return false;
      window.show();
      window.focus();
      return true;
    },
    isSender(sender) {
      return Boolean(window && !window.isDestroyed() && sender === window.webContents);
    },
    dispose() {
      if (finishTimer) clearTimeout(finishTimer);
    },
  };
}
