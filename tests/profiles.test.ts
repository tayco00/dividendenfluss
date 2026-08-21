import assert from "node:assert/strict";
import test from "node:test";
import { createEmptySnapshot } from "../lib/model";
import {
  MAX_PROFILES,
  activeProfile,
  createProfile,
  createProfileStore,
  normalizeProfileStore,
  updateActiveSnapshot,
} from "../lib/profiles";

test("migrates the existing local snapshot into the first profile without changing data", () => {
  const snapshot = createEmptySnapshot();
  snapshot.holdings.push({
    id: "local-only",
    name: "Lokale Testposition",
    ticker: "",
    isin: "",
    quantity: 0,
    purchasePrice: 0,
    currentPrice: 0,
    annualDividendPerShare: 0,
    frequency: "Jährlich",
    sector: "Nicht zugeordnet",
    account: "Test",
    createdAt: new Date(0).toISOString(),
  });
  const store = createProfileStore(snapshot);
  assert.equal(store.profiles.length, 1);
  assert.equal(activeProfile(store).name, "Investor");
  assert.equal(activeProfile(store).snapshot.holdings[0].name, "Lokale Testposition");
});

test("keeps profile portfolios separate when the active profile changes", () => {
  const first = createProfile("Erstes Profil");
  const second = createProfile("Zweites Profil");
  const store = normalizeProfileStore({ version: 1, activeProfileId: first.id, profiles: [first, second] });
  const updated = updateActiveSnapshot(store, (snapshot) => ({ ...snapshot, settings: { ...snapshot.settings, annualGoal: 5000 } }));
  assert.equal(updated.profiles[0].snapshot.settings.annualGoal, 5000);
  assert.equal(updated.profiles[1].snapshot.settings.annualGoal, 1200);
});

test("normalizes imported profile stores and enforces the profile limit", () => {
  const profiles = Array.from({ length: MAX_PROFILES + 3 }, (_, index) => createProfile(` Profil   ${index + 1} `));
  const store = normalizeProfileStore({ version: 99, activeProfileId: "missing", profiles });
  assert.equal(store.version, 1);
  assert.equal(store.profiles.length, MAX_PROFILES);
  assert.equal(store.profiles[0].name, "Profil 1");
  assert.equal(store.activeProfileId, store.profiles[0].id);
});
