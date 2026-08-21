import { normalizeSnapshot, type Snapshot } from "./model";
import { createProfileStore, normalizeProfileStore, type ProfileStore } from "./profiles";

const DB_NAME = "dividendenfluss-local";
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "primary";
const PROFILE_STORE_KEY = "profiles-v1";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadSnapshot(): Promise<Snapshot | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
    request.onsuccess = () => {
      const snapshot = request.result as Snapshot | undefined;
      resolve(snapshot ? normalizeSnapshot(snapshot) : null);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(snapshot, SNAPSHOT_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function readValue<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function writeValue(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadProfileStore(fallbackSnapshot: Snapshot): Promise<ProfileStore> {
  const stored = await readValue<ProfileStore>(PROFILE_STORE_KEY);
  if (stored) return normalizeProfileStore(stored);

  const legacy = await loadSnapshot();
  return createProfileStore(legacy ?? fallbackSnapshot);
}

export async function saveProfileStore(store: ProfileStore): Promise<void> {
  await writeValue(PROFILE_STORE_KEY, normalizeProfileStore(store));
}
