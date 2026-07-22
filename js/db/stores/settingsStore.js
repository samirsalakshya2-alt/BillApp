import { getByKey, put, remove } from '../database.js';

async function getSetting(key, fallback = null) {
  const record = await getByKey('settings', key);
  return record ? record.value : fallback;
}

async function setSetting(key, value) {
  await put('settings', { key, value });
}

// Invoice numbering counter -------------------------------------------------
export async function getInvoiceCounter() {
  return getSetting('invoiceCounter', 0);
}

export async function setInvoiceCounter(value) {
  return setSetting('invoiceCounter', value);
}

// Draft in-progress invoice ---------------------------------------------------
export async function getDraftInvoice() {
  return getSetting('draftInvoice', null);
}

export async function setDraftInvoice(draft) {
  return setSetting('draftInvoice', draft);
}

export async function clearDraftInvoice() {
  return remove('settings', 'draftInvoice');
}

// Automatic backup ------------------------------------------------------------
/** The user-picked FileSystemDirectoryHandle backups are written into (Chrome/Edge only). */
export async function getBackupDirHandle() {
  return getSetting('backupDirHandle', null);
}

export async function setBackupDirHandle(handle) {
  return setSetting('backupDirHandle', handle);
}

/** Ever-increasing counter — the next backup's number is always this + 1, and it's never reset by pruning old backups. */
export async function getBackupCounter() {
  return getSetting('backupCounter', 0);
}

export async function setBackupCounter(value) {
  return setSetting('backupCounter', value);
}
