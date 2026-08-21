import { app, BrowserWindow, ipcMain, Menu, net, protocol, screen, session } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createStartupWindowController } from "./startup-window.mjs";
import { createUpdateService } from "./update-service.mjs";
import { createWindowStateStore } from "./window-state.mjs";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "dividendenfluss",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const isMainSmokeTest = process.argv.includes("--smoke-test");
const isStartupSmokeTest = process.argv.includes("--startup-smoke-test");
const isSmokeTest = isMainSmokeTest || isStartupSmokeTest;
let mainWindow = null;
let mainRendererReady = false;
let startupFinished = false;
let isQuitting = false;
let startupController = null;
let windowStateStore = null;

app.setName("Dividendenfluss");
app.setAppUserModelId("de.dividendenfluss.app");

if (isSmokeTest) {
  app.setPath("userData", path.join(app.getPath("temp"), `Dividendenfluss-Smoke-${process.pid}`));
}

function rendererResponse(request) {
  const rendererRoot = path.resolve(app.getAppPath(), "desktop-dist");
  const url = new URL(request.url);
  const requestedPath = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  const filePath = path.resolve(rendererRoot, requestedPath);
  const insideRenderer = filePath === rendererRoot || filePath.startsWith(`${rendererRoot}${path.sep}`);

  if (!insideRenderer) return new Response("Nicht gefunden", { status: 404 });
  return net.fetch(pathToFileURL(filePath).toString());
}

function browserPreferences() {
  return {
    preload: path.join(app.getAppPath(), "desktop", "preload.cjs"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
}

function secureWindow(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("dividendenfluss://app/")) event.preventDefault();
  });
}

function revealMainWindow() {
  if (!startupFinished || !mainRendererReady || !mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  mainWindow.focus();
}

function showMainWindow() {
  if (!startupFinished && startupController?.show()) return;
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

const updateService = createUpdateService({
  app,
  isSmokeTest,
  getMainWindow: () => mainWindow,
  getStartupController: () => startupController,
  isStartupFinished: () => startupFinished,
  onBeforeInstall: () => {
    isQuitting = true;
    windowStateStore?.save(mainWindow);
  },
});

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  const state = windowStateStore?.load() ?? { width: 1440, height: 900, maximized: false };
  const window = new BrowserWindow({
    width: state.width,
    height: state.height,
    ...(Number.isFinite(state.x) && Number.isFinite(state.y) ? { x: state.x, y: state.y } : {}),
    minWidth: 900,
    minHeight: 650,
    show: false,
    title: "Dividendenfluss",
    backgroundColor: "#f3f5f0",
    icon: path.join(app.getAppPath(), "desktop", "icon.png"),
    webPreferences: browserPreferences(),
  });
  mainWindow = window;
  secureWindow(window);
  if (state.maximized) window.maximize();

  window.once("ready-to-show", () => {
    mainRendererReady = true;
    if (!isSmokeTest) revealMainWindow();
  });
  window.on("close", () => windowStateStore?.save(window));
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  window.webContents.once("did-fail-load", (_event, _code, _description, _url, isMainFrame) => {
    if (isSmokeTest && isMainFrame) app.exit(1);
  });
  window.webContents.once("did-finish-load", async () => {
    if (!isMainSmokeTest) return;
    let appIsReady = false;
    for (let attempt = 0; attempt < 20 && !appIsReady; attempt += 1) {
      appIsReady = await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.app-shell') && document.querySelector('.sidebar-profile') && document.body.textContent?.includes('Dividendenfluss'))",
      );
      if (!appIsReady) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    app.exit(appIsReady ? 0 : 1);
  });
  void window.loadURL("dividendenfluss://app/index.html");
  return window;
}

const hasInstanceLock = isSmokeTest || app.requestSingleInstanceLock();

if (!hasInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", showMainWindow);

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    await protocol.handle("dividendenfluss", rendererResponse);
    windowStateStore = createWindowStateStore({ app, screen });

    startupController = createStartupWindowController({
      browserPreferences,
      isSmokeTest: isStartupSmokeTest,
      onFinished() {
        startupFinished = true;
        revealMainWindow();
      },
      onLoadFailure: () => updateService.finishStartup(),
    });

    ipcMain.on("dividendenfluss:skip-startup-update", (event) => {
      if (startupController?.isSender(event.sender)) updateService.skipStartupUpdate();
    });
    ipcMain.handle("dividendenfluss:app-info", (event) => {
      if (!mainWindow || event.sender !== mainWindow.webContents) {
        return { version: app.getVersion(), packaged: app.isPackaged, updateStatus: updateService.getStatus() };
      }
      return { version: app.getVersion(), packaged: app.isPackaged, updateStatus: updateService.getStatus() };
    });
    ipcMain.handle("dividendenfluss:check-for-updates", (event) => {
      if (!mainWindow || event.sender !== mainWindow.webContents) {
        return { state: "error", message: "Updateprüfung nicht verfügbar." };
      }
      return updateService.checkManually();
    });
    ipcMain.on("dividendenfluss:install-update", (event) => {
      if (mainWindow && event.sender === mainWindow.webContents) updateService.installReadyUpdate();
    });

    if (isStartupSmokeTest) {
      startupController.create();
    } else {
      if (app.isPackaged && !isSmokeTest) startupController.create();
      else startupFinished = true;
      createMainWindow();
    }
    updateService.start();
    app.on("activate", showMainWindow);
  });
}

app.on("before-quit", () => {
  isQuitting = true;
  windowStateStore?.save(mainWindow);
  updateService.dispose();
  startupController?.dispose();
});

app.on("window-all-closed", () => {
  if (isQuitting || process.platform !== "darwin") app.quit();
});
