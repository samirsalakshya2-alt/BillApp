import { exportAllData, backupFileName, summarizeBackup, importMerge, restoreReplace } from '../db/backup.js';
import { downloadBlob } from './shareService.js';

/** Downloads the full app database as a single JSON file. */
export async function exportBackup() {
  const payload = await exportAllData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, backupFileName());
  return payload;
}

export async function parseBackupFile(file) {
  const text = await file.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  const counts = summarizeBackup(payload); // throws if the shape is wrong
  return { payload, counts };
}

export async function importBackupMerge(payload) {
  return importMerge(payload);
}

export async function restoreBackupReplace(payload) {
  return restoreReplace(payload);
}
