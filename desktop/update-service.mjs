import { Notification } from "electron";
import updater from "electron-updater";

const { autoUpdater } = updater;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTUP_CHECK_TIMEOUT_MS = 15_000;
const STARTUP_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

export function createUpdateService({
  app,
  isSmokeTest,
  getMainWindow,
  getStartupController,
  isStartupFinished,
  onBeforeInstall,
}) {
  let updateReady = false;
  let updateCheckInFlight = null;
  let startupUpdateActive = false;
  let startupSkipped = false;
  let startupTimeout = null;
  let recurringCheck = null;
  let started = false;
  let lastUpdateStatus = {
    state: "idle",
    message: "Updates werden beim Start und regelmäßig im Hintergrund geprüft.",
  };

  const setStartupStatus = (status) => getStartupController()?.setStatus(status);

  const clearStartupTimeout = () => {
    if (startupTimeout) clearTimeout(startupTimeout);
    startupTimeout = null;
  };

  const broadcast = (status) => {
    lastUpdateStatus = status;
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("dividendenfluss:update-status", status);
  };

  const finishStartup = (extraDelayMs = 0) => {
    if (isStartupFinished()) return;
    clearStartupTimeout();
    startupUpdateActive = false;
    getStartupController()?.finish(extraDelayMs);
  };

  const skipStartupUpdate = () => {
    if (isStartupFinished() || startupSkipped) return;
    startupSkipped = true;
    startupUpdateActive = false;
    setStartupStatus({
      title: "Dividendenfluss wird geöffnet",
      detail: "Das Update kann im Hintergrund weitergeladen werden.",
      progress: null,
      label: "Startbereit",
      canSkip: false,
    });
    finishStartup(180);
  };

  const installReadyUpdate = () => {
    if (!updateReady) return;
    onBeforeInstall();
    autoUpdater.quitAndInstall(false, true);
  };

  const showUpdateReadyNotification = () => {
    updateReady = true;
    if (!Notification.isSupported()) return;
    const notification = new Notification({
      title: "Dividendenfluss-Update bereit",
      body: "Klicke hier, um neu zu starten und das Update zu installieren.",
    });
    notification.on("click", installReadyUpdate);
    notification.show();
  };

  const finishStartupAfterFailure = () => {
    if (!startupUpdateActive) return;
    setStartupStatus({
      title: "Dividendenfluss startet",
      detail: "Die Updateprüfung ist gerade nicht erreichbar. Du kannst die App trotzdem verwenden.",
      progress: null,
      label: "Offline startbereit",
      canSkip: false,
    });
    finishStartup(700);
  };

  const checkManually = async () => {
    if (!app.isPackaged || isSmokeTest) {
      return {
        state: "current",
        message: "Die Updateprüfung ist in der installierten Version verfügbar.",
      };
    }
    if (updateReady) {
      return {
        ...lastUpdateStatus,
        state: "ready",
        message: "Das Update ist geladen und kann jetzt installiert werden.",
      };
    }
    if (updateCheckInFlight) return updateCheckInFlight;

    broadcast({ state: "checking", message: "Dividendenfluss sucht nach Updates …" });
    updateCheckInFlight = autoUpdater
      .checkForUpdates()
      .then(() => lastUpdateStatus)
      .catch((error) => {
        console.error("Dividendenfluss manual update check failed", error);
        const status = {
          state: "error",
          message: "Die Updateprüfung ist gerade nicht erreichbar. Versuche es später erneut.",
        };
        broadcast(status);
        return status;
      })
      .finally(() => {
        updateCheckInFlight = null;
      });
    return updateCheckInFlight;
  };

  const start = () => {
    if (started || !app.isPackaged || isSmokeTest) return;
    started = true;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    startupUpdateActive = true;

    autoUpdater.on("checking-for-update", () => {
      broadcast({ state: "checking", message: "Dividendenfluss sucht nach Updates …" });
      if (!startupUpdateActive) return;
      setStartupStatus({
        title: "Nach Updates suchen",
        detail: "Dividendenfluss prüft, ob eine neue Version bereitsteht.",
        progress: null,
        label: "Updateprüfung",
        canSkip: true,
      });
    });
    autoUpdater.on("update-available", (info) => {
      broadcast({
        state: "available",
        message: `Version ${info.version} wurde gefunden und wird heruntergeladen.`,
        version: info.version,
      });
      if (!startupUpdateActive) return;
      clearStartupTimeout();
      setStartupStatus({
        title: "Update gefunden",
        detail: `Dividendenfluss ${info.version} wird jetzt sicher heruntergeladen.`,
        progress: 0,
        canSkip: true,
      });
      startupTimeout = setTimeout(skipStartupUpdate, STARTUP_DOWNLOAD_TIMEOUT_MS);
    });
    autoUpdater.on("download-progress", (progress) => {
      broadcast({
        ...lastUpdateStatus,
        state: "downloading",
        message: `Update wird geladen: ${Math.round(progress.percent)} %`,
        progress: progress.percent,
      });
      if (!startupUpdateActive) return;
      setStartupStatus({
        title: "Update wird geladen",
        detail: "Dividendenfluss bleibt nur noch einen Moment im Startfenster.",
        progress: progress.percent,
        canSkip: true,
      });
    });
    autoUpdater.on("update-not-available", () => {
      broadcast({
        state: "current",
        message: "Du verwendest bereits die neueste Version von Dividendenfluss.",
      });
      if (!startupUpdateActive) return;
      setStartupStatus({
        title: "Alles aktuell",
        detail: "Du verwendest bereits die neueste Version von Dividendenfluss.",
        progress: 100,
        canSkip: false,
      });
      finishStartup(500);
    });
    autoUpdater.on("update-downloaded", (info) => {
      updateReady = true;
      broadcast({
        state: "ready",
        message: "Das Update ist geladen und kann jetzt installiert werden.",
        version: info.version,
        progress: 100,
      });
      if (startupUpdateActive && !startupSkipped) {
        clearStartupTimeout();
        startupUpdateActive = false;
        setStartupStatus({
          title: "Update wird installiert",
          detail: "Dividendenfluss startet danach automatisch in der neuen Version.",
          progress: 100,
          canSkip: false,
        });
        setTimeout(() => {
          onBeforeInstall();
          autoUpdater.quitAndInstall(false, true);
        }, 900);
        return;
      }
      showUpdateReadyNotification();
    });
    autoUpdater.on("error", (error) => {
      console.error("Dividendenfluss update check failed", error);
      broadcast({
        state: "error",
        message: "Die Updateprüfung ist gerade nicht erreichbar. Versuche es später erneut.",
      });
      finishStartupAfterFailure();
    });

    startupTimeout = setTimeout(finishStartupAfterFailure, STARTUP_CHECK_TIMEOUT_MS);
    void autoUpdater.checkForUpdates().catch((error) => {
      console.error("Dividendenfluss startup update check failed", error);
      finishStartupAfterFailure();
    });
    recurringCheck = setInterval(() => {
      void autoUpdater.checkForUpdatesAndNotify().catch((error) => {
        console.error("Dividendenfluss recurring update check failed", error);
      });
    }, UPDATE_CHECK_INTERVAL_MS);
  };

  const dispose = () => {
    clearStartupTimeout();
    if (recurringCheck) clearInterval(recurringCheck);
    recurringCheck = null;
  };

  return {
    start,
    dispose,
    finishStartup,
    skipStartupUpdate,
    checkManually,
    installReadyUpdate,
    getStatus: () => lastUpdateStatus,
  };
}
