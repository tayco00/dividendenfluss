"use client";

import { useEffect, useState } from "react";
import type { DesktopUpdateStatus } from "./desktop-api";

const initialStatus: DesktopUpdateStatus = {
  state: "idle",
  message: "Updates werden beim Start und regelmäßig im Hintergrund geprüft.",
};

export function UpdateCard() {
  const [status, setStatus] = useState<DesktopUpdateStatus>(initialStatus);
  const [version, setVersion] = useState("Web-Version");
  const desktop = typeof window === "undefined" ? undefined : window.dividendenflussDesktop;

  useEffect(() => {
    const bridge = window.dividendenflussDesktop;
    if (!bridge) return;
    void bridge.getAppInfo().then((info) => {
      setVersion(`Version ${info.version}`);
      setStatus(info.updateStatus);
    });
    return bridge.onUpdateStatus(setStatus);
  }, []);

  async function handleUpdate() {
    const bridge = window.dividendenflussDesktop;
    if (!bridge) return;
    if (status.state === "ready") {
      bridge.installReadyUpdate();
      return;
    }
    setStatus({ state: "checking", message: "Dividendenfluss sucht nach Updates …" });
    setStatus(await bridge.checkForUpdates());
  }

  const busy = status.state === "checking" || status.state === "downloading";

  return (
    <section className="settings-card update-card" aria-labelledby="update-title">
      <div className="settings-heading">
        <div><span className="eyebrow">PROGRAMM</span><h2 id="update-title">Updates</h2></div>
        <span className="settings-icon">↻</span>
      </div>
      <p className="settings-intro">
        Neue Versionen kommen sicher über den öffentlichen GitHub-Release-Kanal. Portfolio- und Profildaten werden dabei nie übertragen.
      </p>
      <div className="update-meta">
        <span>{version}</span>
        {status.version ? <strong>Neu: Version {status.version}</strong> : null}
      </div>
      {status.state === "downloading" && status.progress !== undefined ? (
        <progress max="100" value={status.progress} aria-label="Downloadfortschritt">
          {Math.round(status.progress)} %
        </progress>
      ) : null}
      <p className={`update-status ${status.state}`} aria-live="polite">{status.message}</p>
      <button
        type="button"
        className="button dark update-button"
        onClick={() => void handleUpdate()}
        disabled={busy || !desktop}
      >
        {status.state === "ready" ? "Installieren & neu starten" : "Nach Updates suchen"}
      </button>
      {!desktop ? <small className="settings-hint">Die Updatefunktion ist in der installierten Windows-App verfügbar.</small> : null}
    </section>
  );
}
