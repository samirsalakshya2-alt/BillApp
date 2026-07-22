import { STORE_NAMES, getAll, putMany, clearStore } from './database.js';

const FORMAT_VERSION = 1;

/** Settings keys that hold device-local, non-JSON-serializable objects (e.g. a FileSystemDirectoryHandle) — never part of a portable backup. */
const NON_PORTABLE_SETTINGS_KEYS = new Set(['backupDirHandle']);

function portableSettings(records) {
  return (records || []).filter((r) => !NON_PORTABLE_SETTINGS_KEYS.has(r.key));
}

export async function exportAllData() {
  const data = {};
  for (const store of STORE_NAMES) {
    data[store] = await getAll(store);
  }
  data.settings = portableSettings(data.settings);
  return { formatVersion: FORMAT_VERSION, exportedAt: new Date().toISOString(), data };
}

export function backupFileName() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `BillApp-Backup-${stamp}.json`;
}

function validateBackup(payload) {
  if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
    throw new Error('That file doesn’t look like a BillApp backup.');
  }
}

/** Record counts per store, for a confirmation summary before import/restore. */
export function summarizeBackup(payload) {
  validateBackup(payload);
  const summary = {};
  for (const store of STORE_NAMES) {
    summary[store] = Array.isArray(payload.data[store]) ? payload.data[store].length : 0;
  }
  return summary;
}

/** Adds/overwrites records from the backup into the current database — anything not in the file is left untouched. */
export async function importMerge(payload) {
  validateBackup(payload);
  for (const store of STORE_NAMES) {
    const records = store === 'settings' ? portableSettings(payload.data[store]) : payload.data[store];
    if (Array.isArray(records) && records.length) {
      await putMany(store, records);
    }
  }
}

/** Wipes every store, then loads the backup exactly — a full, destructive rollback to that snapshot. The device's own backup-folder handle is device-local config, not app data, so it survives the wipe untouched. */
export async function restoreReplace(payload) {
  validateBackup(payload);
  const existingSettings = await getAll('settings');
  const deviceLocalSettings = existingSettings.filter((r) => NON_PORTABLE_SETTINGS_KEYS.has(r.key));

  for (const store of STORE_NAMES) {
    await clearStore(store);
    const records = store === 'settings' ? portableSettings(payload.data[store]) : payload.data[store];
    if (Array.isArray(records) && records.length) {
      await putMany(store, records);
    }
  }

  if (deviceLocalSettings.length) {
    await putMany('settings', deviceLocalSettings);
  }
}
