import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TrackerApp from "../app/tracker-app";
import "../app/globals.css";
import "../app/position-entry-v2.css";
import "../app/typography.css";
import "./window.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Dividendenfluss konnte nicht gestartet werden.");
}

createRoot(root).render(
  <StrictMode>
    <TrackerApp />
  </StrictMode>,
);
