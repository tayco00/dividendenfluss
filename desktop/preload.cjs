// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dividendenflussDesktop", {
  getAppInfo() {
    return ipcRenderer.invoke("dividendenfluss:app-info");
  },
  skipStartupUpdate() {
    ipcRenderer.send("dividendenfluss:skip-startup-update");
  },
  checkForUpdates() {
    return ipcRenderer.invoke("dividendenfluss:check-for-updates");
  },
  installReadyUpdate() {
    ipcRenderer.send("dividendenfluss:install-update");
  },
  onUpdateStatus(callback) {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("dividendenfluss:update-status", listener);
    return () => ipcRenderer.removeListener("dividendenfluss:update-status", listener);
  },
});
