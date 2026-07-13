import { el, mount } from '../../utils/domHelpers.js';
import { confirmDialog } from '../components/modal.js';
import { createIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { exportBackup, parseBackupFile, importBackupMerge, restoreBackupReplace } from '../../services/backupService.js';

const STORE_LABELS = {
  businesses: 'Business',
  banks: 'Banks',
  customers: 'Customers',
  items: 'Items',
  invoices: 'Bills',
  settings: 'Settings',
};

function summaryText(counts) {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([store, n]) => `${n} ${STORE_LABELS[store] || store}`)
    .join(', ') || 'No records';
}

function actionCard(icon, title, description, buttonLabel, onClick, { danger = false } = {}) {
  return el('div', { class: 'card u-flex-col u-gap-2' }, [
    el('div', { class: 'u-flex u-items-center u-gap-3' }, [
      el('div', { class: 'nav-tile__icon' }, [createIcon(icon, { size: 22 })]),
      el('div', {}, [
        el('div', { class: 'u-font-semibold' }, [title]),
        el('div', { class: 'u-text-sm u-text-muted' }, [description]),
      ]),
    ]),
    el('button', { class: `btn ${danger ? 'btn--danger' : 'btn--outline'} btn--block`, type: 'button', onclick: onClick }, [buttonLabel]),
  ]);
}

function pickJsonFile() {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden' });
    input.addEventListener('change', () => resolve(input.files[0] || null), { once: true });
    document.body.appendChild(input);
    input.click();
    input.remove();
  });
}

async function onExport() {
  try {
    await exportBackup();
    showToast('Backup file downloaded.', { type: 'success' });
  } catch (err) {
    console.error(err);
    showToast('Could not export backup.', { type: 'error' });
  }
}

async function onImport() {
  const file = await pickJsonFile();
  if (!file) return;

  try {
    const { payload, counts } = await parseBackupFile(file);
    const confirmed = await confirmDialog({
      title: 'Import backup?',
      message: `This file contains: ${summaryText(counts)}. These records will be added to (or updated in) your current data. Nothing else is removed.`,
      confirmLabel: 'Import',
    });
    if (!confirmed) return;

    await importBackupMerge(payload);
    showToast('Backup imported.', { type: 'success' });
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Could not import that file.', { type: 'error' });
  }
}

async function onRestore() {
  const file = await pickJsonFile();
  if (!file) return;

  try {
    const { payload, counts } = await parseBackupFile(file);
    const confirmed = await confirmDialog({
      title: 'Restore from backup?',
      message: `This will ERASE all data currently on this device and replace it with: ${summaryText(counts)}. This cannot be undone.`,
      confirmLabel: 'Erase & Restore',
      danger: true,
    });
    if (!confirmed) return;

    await restoreBackupReplace(payload);
    showToast('Data restored.', { type: 'success' });
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Could not restore that file.', { type: 'error' });
  }
}

export async function render(container) {
  mount(container, el('div', { class: 'u-flex-col u-gap-4' }, [
    actionCard('download', 'Export Backup', 'Save a complete copy of all your bills, customers, items and settings as a file.', 'Export Backup', onExport),
    actionCard('backup', 'Import Backup', 'Add records from a backup file into your current data.', 'Choose File to Import', onImport),
    actionCard('trash', 'Restore Backup', 'Erase everything on this device and replace it with a backup file.', 'Choose File to Restore', onRestore, { danger: true }),
  ]));
}
