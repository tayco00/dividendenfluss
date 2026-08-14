import assert from "node:assert/strict";
import test from "node:test";
import { createEmptySnapshot, normalizeSnapshot, type Snapshot } from "../lib/model";

test("uses the readable standard size for new data", () => {
  const settings = createEmptySnapshot().settings;
  assert.equal(settings.textSize, "standard");
  assert.equal(settings.startView, "dashboard");
});

test("adds the standard size to existing local snapshots", () => {
  const current = createEmptySnapshot();
  const legacy = {
    ...current,
    settings: {
      currency: current.settings.currency,
      annualGoal: current.settings.annualGoal,
      theme: current.settings.theme,
    },
  } as unknown as Snapshot;

  const normalized = normalizeSnapshot(legacy);
  assert.equal(normalized.settings.textSize, "standard");
  assert.equal(normalized.settings.startView, "dashboard");
  assert.deepEqual(normalized.holdings, legacy.holdings);
  assert.deepEqual(normalized.payments, legacy.payments);
});

test("preserves a chosen start view", () => {
  const snapshot = createEmptySnapshot();
  snapshot.settings.startView = "payments";
  assert.equal(normalizeSnapshot(snapshot).settings.startView, "payments");
});
