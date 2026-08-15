import { app, BrowserWindow, Menu, net, protocol, session } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

const isSmokeTest = process.argv.includes("--smoke-test");
let mainWindow = null;

app.setName("Dividendenfluss");

if (isSmokeTest) {
  app.setPath("userData", path.join(app.getPath("temp"), `Dividendenfluss-Smoke-${process.pid}`));
}

function rendererResponse(request) {
  const rendererRoot = path.resolve(app.getAppPath(), "desktop-dist");
  const url = new URL(request.url);
  const requestedPath = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  const filePath = path.resolve(rendererRoot, requestedPath);
  const insideRenderer = filePath === rendererRoot || filePath.startsWith(`${rendererRoot}${path.sep}`);

  if (!insideRenderer) {
    return new Response("Nicht gefunden", { status: 404 });
  }

  return net.fetch(pathToFileURL(filePath).toString());
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    show: false,
    title: "Dividendenfluss",
    backgroundColor: "#f3f5f0",
    icon: path.join(app.getAppPath(), "desktop", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = window;
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("dividendenfluss://app/")) {
      event.preventDefault();
    }
  });
  window.once("ready-to-show", () => {
    if (!isSmokeTest) {
      window.show();
    }
  });
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
  window.webContents.once("did-fail-load", (_event, _code, _description, _url, isMainFrame) => {
    if (isSmokeTest && isMainFrame) {
      app.exit(1);
    }
  });
  window.webContents.once("did-finish-load", async () => {
    if (!isSmokeTest) {
      return;
    }

    let appIsReady = false;
    for (let attempt = 0; attempt < 20 && !appIsReady; attempt += 1) {
      appIsReady = await window.webContents.executeJavaScript(
        "Boolean(document.querySelector('.app-shell') && document.body.textContent?.toLowerCase().includes('dividendenfluss'))",
      );
      if (!appIsReady) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    app.exit(appIsReady ? 0 : 1);
  });
  void window.loadURL("dividendenfluss://app/index.html");
}

const hasInstanceLock = isSmokeTest || app.requestSingleInstanceLock();

if (!hasInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      createWindow();
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });
    await protocol.handle("dividendenfluss", rendererResponse);
    createWindow();
  });
}

app.on("window-all-closed", () => {
  app.quit();
});
