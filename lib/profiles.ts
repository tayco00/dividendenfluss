import { createEmptySnapshot, normalizeSnapshot, type Snapshot } from "./model";

export const PROFILE_STORE_VERSION = 1 as const;
export const MAX_PROFILES = 6;

export const profileAccents = ["lime", "teal", "purple", "orange"] as const;
export type ProfileAccent = (typeof profileAccents)[number];

export type LocalProfile = {
  id: string;
  name: string;
  accent: ProfileAccent;
  createdAt: string;
  snapshot: Snapshot;
};

export type ProfileStore = {
  version: typeof PROFILE_STORE_VERSION;
  activeProfileId: string;
  profiles: LocalProfile[];
};

export function cleanProfileName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 40);
}

function profileId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createProfile(
  name: string,
  snapshot = createEmptySnapshot(),
  accent: ProfileAccent = "lime",
  now = new Date(),
): LocalProfile {
  return {
    id: profileId(),
    name: cleanProfileName(name) || "Investor",
    accent,
    createdAt: now.toISOString(),
    snapshot: normalizeSnapshot(snapshot),
  };
}

export function createProfileStore(snapshot: Snapshot, name = "Investor"): ProfileStore {
  const profile = createProfile(name, snapshot);
  return {
    version: PROFILE_STORE_VERSION,
    activeProfileId: profile.id,
    profiles: [profile],
  };
}

function normalizeProfile(value: unknown, index: number): LocalProfile | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LocalProfile>;
  const id = typeof candidate.id === "string" ? candidate.id.slice(0, 100) : "";
  const name = cleanProfileName(typeof candidate.name === "string" ? candidate.name : "");
  if (!id || !name || !candidate.snapshot || typeof candidate.snapshot !== "object") return null;
  const accent = profileAccents.includes(candidate.accent as ProfileAccent)
    ? candidate.accent as ProfileAccent
    : profileAccents[index % profileAccents.length];
  return {
    id,
    name,
    accent,
    createdAt: typeof candidate.createdAt === "string"
      ? candidate.createdAt
      : new Date(0).toISOString(),
    snapshot: normalizeSnapshot(candidate.snapshot as Snapshot),
  };
}

export function normalizeProfileStore(value: unknown): ProfileStore {
  if (!value || typeof value !== "object") {
    return createProfileStore(createEmptySnapshot());
  }
  const candidate = value as Partial<ProfileStore>;
  const seen = new Set<string>();
  const profiles = (Array.isArray(candidate.profiles) ? candidate.profiles : [])
    .map(normalizeProfile)
    .filter((profile): profile is LocalProfile => {
      if (!profile || seen.has(profile.id)) return false;
      seen.add(profile.id);
      return true;
    })
    .slice(0, MAX_PROFILES);

  if (!profiles.length) return createProfileStore(createEmptySnapshot());
  const requestedId = typeof candidate.activeProfileId === "string"
    ? candidate.activeProfileId
    : "";
  return {
    version: PROFILE_STORE_VERSION,
    activeProfileId: profiles.some((profile) => profile.id === requestedId)
      ? requestedId
      : profiles[0].id,
    profiles,
  };
}

export function activeProfile(store: ProfileStore) {
  return store.profiles.find((profile) => profile.id === store.activeProfileId)
    ?? store.profiles[0];
}

export function updateActiveSnapshot(
  store: ProfileStore,
  update: (snapshot: Snapshot) => Snapshot,
): ProfileStore {
  return {
    ...store,
    profiles: store.profiles.map((profile) => profile.id === store.activeProfileId
      ? { ...profile, snapshot: normalizeSnapshot(update(profile.snapshot)) }
      : profile),
  };
}
