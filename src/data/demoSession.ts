import { openDB, type IDBPDatabase } from "idb";
import { DEMO_SEED_PROFILE } from "./demoSeed";
import { buildSeed, loadSeedBundle } from "./seed";
import { STORE_NAMES, connect, type StoreName } from "./store";
import { notify } from "./live";
import { DEFAULT_SYNC_SETTINGS, useSyncSettings } from "./sync";

/**
 * The guide demo writes into the real stores, so the real screens run on practice data.
 * Before it starts, every store and the Earth link settings are copied to a separate database.
 * When it ends (or is skipped) the copy is written back and deleted, so no demo row survives.
 * If the tab closes mid-demo, initData restores the copy on the next load.
 */
const BACKUP_DB = "pulseframe-demo-backup";
const BACKUP_STORE = "snapshot";
const BACKUP_KEY = "before-demo";
/** localStorage keys that hold app state the demo may change. */
const LOCAL_KEYS = ["pf-sync"] as const;

/** Earth link while the demo runs: a short delay so a send is seen to finish. */
export const DEMO_SYNC = { delaySec: 2, linkUp: true, dropRate: 0 } as const;

export interface DemoBackup {
  takenAt: string;
  stores: Partial<Record<StoreName, unknown[]>>;
  local: Record<string, string | null>;
}

let backupDb: Promise<IDBPDatabase> | undefined;

function backup(): Promise<IDBPDatabase> {
  return (backupDb ??= openDB(BACKUP_DB, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(BACKUP_STORE)) db.createObjectStore(BACKUP_STORE);
    },
  }));
}

function readLocal(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage blocked: nothing to restore.
  }
}

export async function readDemoBackup(): Promise<DemoBackup | undefined> {
  return (await (await backup()).get(BACKUP_STORE, BACKUP_KEY)) as DemoBackup | undefined;
}

/** True while practice data is loaded (also after a reload that interrupted a demo). */
export async function demoDataActive(): Promise<boolean> {
  return (await readDemoBackup()) !== undefined;
}

async function takeSnapshot(): Promise<DemoBackup> {
  const db = await connect();
  const tx = db.transaction([...STORE_NAMES], "readonly");
  const stores: DemoBackup["stores"] = {};
  for (const name of STORE_NAMES) stores[name] = await tx.objectStore(name).getAll();
  await tx.done;
  const local: DemoBackup["local"] = {};
  for (const key of LOCAL_KEYS) local[key] = readLocal(key);
  return { takenAt: new Date().toISOString(), stores, local };
}

/**
 * Saves the crew's data aside and loads the practice week. Safe to call twice in a row:
 * an existing backup is kept, so a replay never backs up demo rows.
 */
export async function beginDemoData(now = new Date()): Promise<void> {
  const bk = await backup();
  if (!(await bk.get(BACKUP_STORE, BACKUP_KEY))) {
    await bk.put(BACKUP_STORE, await takeSnapshot(), BACKUP_KEY);
  }
  await loadSeedBundle(buildSeed(now, DEMO_SEED_PROFILE));
  useSyncSettings.getState().set({ ...DEMO_SYNC });
}

/**
 * Wipes every demo row by writing the backup back in one transaction, then deletes the backup.
 * Returns false when no demo data was loaded.
 */
export async function endDemoData(): Promise<boolean> {
  const bk = await backup();
  const saved = (await bk.get(BACKUP_STORE, BACKUP_KEY)) as DemoBackup | undefined;
  if (!saved) return false;

  const db = await connect();
  const tx = db.transaction([...STORE_NAMES], "readwrite");
  for (const name of STORE_NAMES) {
    const os = tx.objectStore(name);
    await os.clear();
    for (const row of saved.stores[name] ?? []) await os.put(row);
  }
  await tx.done;

  for (const key of LOCAL_KEYS) writeLocal(key, saved.local[key] ?? null);
  await useSyncSettings.persist?.rehydrate();
  if (saved.local["pf-sync"] == null) useSyncSettings.getState().set({ ...DEFAULT_SYNC_SETTINGS });

  await bk.delete(BACKUP_STORE, BACKUP_KEY);
  notify();
  return true;
}
