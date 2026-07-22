import { exportAllData, restoreReplace } from '../db/backup.js';
import {
  getBackupDirHandle,
  setBackupDirHandle,
  getBackupCounter,
  setBackupCounter,
} from '../db/stores/settingsStore.js';
import { getAllInvoices } from '../db/stores/invoiceStore.js';
import { getAllCustomers } from '../db/stores/customerStore.js';
import { getAllItems } from '../db/stores/itemStore.js';
import { APP_VERSION } from '../../config/appVersion.js';

/**
 * Folder-based automatic backup system. Uses the File System Access API
 * (Chrome/Edge desktop + Android) to write timestamped, numbered snapshots
 * into a user-chosen folder that lives on the real filesystem — so the
 * backups themselves survive an app uninstall/reinstall even though the
 * browser's *remembered handle* to that folder does not, and the user may
 * need to re-grant access once after a fresh install. Unsupported browsers
 * (Firefox, Safari) simply never have a folder configured, so every
 * function here quietly no-ops rather than throwing into normal app flow.
 */

const FILE_EXT = '.billapp';
const FILE_PREFIX = 'Backup_';
const BACKUP_FILE_RE = /^Backup_(\d+)_.*\.billapp$/;
const AUTO_BACKUP_DEBOUNCE_MS = 1500;

export function isBackupSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function timestampParts(date) {
  const backupDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const backupTime = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const fileStamp = `${backupDate}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
  return { backupDate, backupTime, fileStamp };
}

function backupFileName(number, date) {
  return `${FILE_PREFIX}${number}_${timestampParts(date).fileStamp}${FILE_EXT}`;
}

/** Ask the user to pick (or change) the folder all backups are written into. Must be called from a click handler (needs a user gesture). */
export async function chooseBackupFolder() {
  if (!isBackupSupported()) {
    throw new Error('Choosing a backup folder isn’t supported in this browser — use Chrome or Edge.');
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await setBackupDirHandle(handle);
  return handle;
}

/** Resolves the stored folder handle if read/write permission is (or, when interactive, can be) confirmed — else null. */
export async function getReadyBackupFolder({ interactive = false } = {}) {
  const handle = await getBackupDirHandle();
  if (!handle) return null;
  const opts = { mode: 'readwrite' };
  let perm = await handle.queryPermission(opts);
  if (perm !== 'granted' && interactive) {
    perm = await handle.requestPermission(opts);
  }
  return perm === 'granted' ? handle : null;
}

/** Status summary for the Backup settings screen — never prompts. */
export async function getBackupFolderStatus() {
  if (!isBackupSupported()) return { supported: false, configured: false, name: null, granted: false };
  const handle = await getBackupDirHandle();
  if (!handle) return { supported: true, configured: false, name: null, granted: false };
  const granted = (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';
  return { supported: true, configured: true, name: handle.name, granted };
}

async function gatherCounts() {
  const [invoices, customers, items] = await Promise.all([getAllInvoices(), getAllCustomers(), getAllItems()]);
  return { totalBills: invoices.length, totalCustomers: customers.length, totalItems: items.length };
}

async function nextBackupNumber() {
  const next = (await getBackupCounter()) + 1;
  await setBackupCounter(next);
  return next;
}

async function writeBackupFile(dirHandle, name, payload) {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(payload));
  await writable.close();
}

async function readEntryMeta(fileHandle) {
  try {
    const file = await fileHandle.getFile();
    const parsed = JSON.parse(await file.text());
    return parsed.meta || null;
  } catch {
    return null;
  }
}

async function listBackupEntries(dirHandle) {
  const entries = [];
  for await (const [name, entryHandle] of dirHandle.entries()) {
    if (entryHandle.kind !== 'file') continue;
    const match = name.match(BACKUP_FILE_RE);
    if (!match) continue;
    entries.push({ name, number: Number(match[1]), handle: entryHandle });
  }
  return entries;
}

/**
 * Retention rule (applied only to Automatic backups; Manual ones are never
 * auto-deleted): keep the latest, the second latest, the latest number
 * divisible by 20, the latest divisible by 50, and the latest 5 divisible by
 * 100 — among whichever automatic backup numbers currently still exist.
 * Operating on "currently exist" rather than "ever existed" is what lets the
 * counter keep climbing forever without the retention set ever growing.
 */
function computeNumbersToKeep(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => b - a);
  const keep = new Set();
  if (sorted.length > 0) keep.add(sorted[0]);
  if (sorted.length > 1) keep.add(sorted[1]);
  const latestDivisibleBy = (n) => sorted.find((v) => v % n === 0);
  const by20 = latestDivisibleBy(20);
  if (by20 !== undefined) keep.add(by20);
  const by50 = latestDivisibleBy(50);
  if (by50 !== undefined) keep.add(by50);
  sorted.filter((v) => v % 100 === 0).slice(0, 5).forEach((v) => keep.add(v));
  return keep;
}

async function pruneAutomaticBackups(dirHandle) {
  const entries = await listBackupEntries(dirHandle);
  const automatic = [];
  for (const entry of entries) {
    const meta = await readEntryMeta(entry.handle);
    if (meta?.backupType === 'Automatic') automatic.push(entry);
  }
  const keep = computeNumbersToKeep(automatic.map((e) => e.number));
  await Promise.all(
    automatic
      .filter((e) => !keep.has(e.number))
      .map((e) => dirHandle.removeEntry(e.name).catch(() => {}))
  );
}

/** Builds and writes one backup snapshot. Quietly returns null if no folder is configured/authorized yet — never throws into an unrelated save flow. */
export async function createBackup(type, { interactive = false } = {}) {
  const dirHandle = await getReadyBackupFolder({ interactive });
  if (!dirHandle) return null;

  const number = await nextBackupNumber();
  const now = new Date();
  const { backupDate, backupTime } = timestampParts(now);
  const meta = {
    backupNumber: number,
    backupDate,
    backupTime,
    appVersion: APP_VERSION,
    ...(await gatherCounts()),
    backupType: type === 'manual' ? 'Manual' : 'Automatic',
  };
  const { data } = await exportAllData();

  await writeBackupFile(dirHandle, backupFileName(number, now), { formatVersion: 1, meta, data });
  if (meta.backupType === 'Automatic') {
    await pruneAutomaticBackups(dirHandle);
  }
  return meta;
}

let debounceTimer = null;
/** Fire-and-forget: bursts of related saves (a bill plus its customer plus its items) collapse into a single backup a moment later. Never slows down the caller. */
export function scheduleAutoBackup() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    createBackup('automatic').catch((err) => console.warn('Automatic backup failed:', err));
  }, AUTO_BACKUP_DEBOUNCE_MS);
}

/** User-triggered "Backup Now" — awaited so the UI can confirm success/failure, and allowed to prompt for folder permission since it's a real click. */
export async function manualBackupNow() {
  const meta = await createBackup('manual', { interactive: true });
  if (!meta) throw new Error('Choose a backup folder first.');
  return meta;
}

/** Every backup file in the configured folder, newest first, with parsed metadata — for the Restore screen. */
export async function listBackups({ interactive = false } = {}) {
  const dirHandle = await getReadyBackupFolder({ interactive });
  if (!dirHandle) return [];
  const entries = await listBackupEntries(dirHandle);
  const withMeta = await Promise.all(
    entries.map(async (entry) => ({ ...entry, meta: await readEntryMeta(entry.handle) }))
  );
  return withMeta.filter((e) => e.meta).sort((a, b) => b.number - a.number);
}

/** Reads a backup entry (from listBackups) and completely replaces the local database with its contents. */
export async function restoreFromBackupEntry(entry) {
  const file = await entry.handle.getFile();
  const payload = JSON.parse(await file.text());
  await restoreReplace(payload);
  return payload.meta;
}
