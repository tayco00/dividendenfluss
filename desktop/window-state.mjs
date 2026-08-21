import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_STATE = { width: 1440, height: 900, maximized: false };

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function createWindowStateStore({ app, screen }) {
  const statePath = path.join(app.getPath("userData"), "window-state.json");

  function isVisible(state) {
    if (!isFiniteNumber(state.x) || !isFiniteNumber(state.y)) return true;
    return screen.getAllDisplays().some(({ workArea }) => {
      const right = state.x + state.width;
      const bottom = state.y + state.height;
      return right > workArea.x + 80
        && state.x < workArea.x + workArea.width - 80
        && bottom > workArea.y + 60
        && state.y < workArea.y + workArea.height - 60;
    });
  }

  function load() {
    try {
      const value = JSON.parse(readFileSync(statePath, "utf8"));
      const state = {
        width: isFiniteNumber(value.width) ? Math.max(900, value.width) : DEFAULT_STATE.width,
        height: isFiniteNumber(value.height) ? Math.max(650, value.height) : DEFAULT_STATE.height,
        x: isFiniteNumber(value.x) ? value.x : undefined,
        y: isFiniteNumber(value.y) ? value.y : undefined,
        maximized: value.maximized === true,
      };
      return isVisible(state) ? state : { ...DEFAULT_STATE };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  function save(window) {
    if (!window || window.isDestroyed()) return;
    const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds();
    const state = { ...bounds, maximized: window.isMaximized() };
    const temporaryPath = `${statePath}.tmp`;
    try {
      writeFileSync(temporaryPath, JSON.stringify(state), "utf8");
      renameSync(temporaryPath, statePath);
    } catch (error) {
      console.error("Dividendenfluss window state could not be saved", error);
    }
  }

  return { load, save, path: statePath };
}
