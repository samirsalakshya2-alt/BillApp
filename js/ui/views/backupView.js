import { el, mount } from '../../utils/domHelpers.js';
import { confirmDialog } from '../components/modal.js';
import { createIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { exportBackup, parseBackupFile, importBackupMerge, restoreBackupReplace } from '../../services/backupService.js';
import {
  isBackupSupported,
  getBackupFolderStatus,
  chooseBackupFolder,
  manualBackupNow,
  listBackups,
  restoreFromBackupEntry,
} from '../../services/autoBackupService.js';

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
    const input = el('input', { type: 'file', accept: 'application/json,.json,.billapp', class: 'visually-hidden' });
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

async function onRestoreFromFile() {
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

function backupMetaCard(entry, onRestore) {
  const m = entry.meta;
  const badgeClass = m.backupType === 'Manual' ? 'badge badge--accent' : 'badge';
  return el('div', { class: 'card u-flex-col u-gap-2' }, [
    el('div', { class: 'u-flex u-items-center u-justify-between' }, [
      el('div', { class: 'u-font-semibold' }, [`Backup #${m.backupNumber}`]),
      el('span', { class: badgeClass }, [m.backupType]),
    ]),
    el('div', { class: 'u-text-sm u-text-muted' }, [`${m.backupDate} ${m.backupTime} · App v${m.appVersion}`]),
    el('div', { class: 'u-text-sm u-text-muted' }, [
      `${m.totalBills} Bills · ${m.totalCustomers} Customers · ${m.totalItems} Items`,
    ]),
    el('button', { class: 'btn btn--outline btn--sm', type: 'button', onclick: () => onRestore(entry) }, ['Restore this backup']),
  ]);
}

async function onRestoreEntry(entry) {
  const m = entry.meta;
  const confirmed = await confirmDialog({
    title: `Restore Backup #${m.backupNumber}?`,
    message: `This will ERASE all data currently on this device and replace it with the ${m.backupDate} ${m.backupTime} snapshot (${m.totalBills} Bills, ${m.totalCustomers} Customers, ${m.totalItems} Items). This cannot be undone.`,
    confirmLabel: 'Erase & Restore',
    danger: true,
  });
  if (!confirmed) return;

  try {
    await restoreFromBackupEntry(entry);
    showToast('Data restored.', { type: 'success' });
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    console.error(err);
    showToast('Could not restore that backup.', { type: 'error' });
  }
}

export async function render(container) {
  mount(container, el('div', { class: 'u-text-muted u-text-center', style: 'padding:48px 0;' }, ['Loading backup settings…']));

  const root = el('div', { class: 'u-flex-col u-gap-4' });
  mount(container, root);

  async function draw() {
    root.innerHTML = '';
    const status = await getBackupFolderStatus();

    // ---- Backup Folder status / setup ----
    if (!status.supported) {
      root.appendChild(el('div', { class: 'card u-flex-col u-gap-2' }, [
        el('div', { class: 'u-font-semibold' }, ['Automatic Backup Folder']),
        el('div', { class: 'u-text-sm u-text-muted' }, [
          'Automatic folder backups need Chrome or Edge (desktop or Android). You can still use Export/Import/Restore below on any browser.',
        ]),
      ]));
    } else {
      const folderLine = !status.configured
        ? 'No backup folder selected yet.'
        : status.granted
          ? `Backups are saved into "${status.name}".`
          : `Access to "${status.name}" needs to be re-granted (e.g. after reinstalling the app).`;

      root.appendChild(el('div', { class: 'card u-flex-col u-gap-2' }, [
        el('div', { class: 'u-font-semibold' }, ['Automatic Backup Folder']),
        el('div', { class: 'u-text-sm u-text-muted' }, [folderLine]),
        el('button', {
          class: 'btn btn--outline btn--block',
          type: 'button',
          onclick: async () => {
            try {
              await chooseBackupFolder();
              showToast('Backup folder set.', { type: 'success' });
              draw();
            } catch (err) {
              console.error(err);
              showToast(err.message || 'Could not set backup folder.', { type: 'error' });
            }
          },
        }, [status.configured ? 'Change Backup Folder' : 'Choose Backup Folder']),
      ]));

      if (status.configured) {
        root.appendChild(actionCard(
          'backup',
          'Backup Now',
          'Create a manual backup in your backup folder right now. Manual backups are never auto-deleted.',
          'Backup Now',
          async () => {
            try {
              const meta = await manualBackupNow();
              showToast(`Backup #${meta.backupNumber} created.`, { type: 'success' });
              draw();
            } catch (err) {
              console.error(err);
              showToast(err.message || 'Could not create backup.', { type: 'error' });
            }
          }
        ));
      }
    }

    // ---- Restore screen: list backups from the folder ----
    if (status.supported && status.configured) {
      root.appendChild(el('div', { class: 'u-font-semibold' }, ['Restore']));

      if (!status.granted) {
        root.appendChild(el('div', { class: 'card u-flex-col u-gap-2' }, [
          el('div', { class: 'u-text-sm u-text-muted' }, ['Grant access to view and restore backups from this folder.']),
          el('button', {
            class: 'btn btn--outline btn--block',
            type: 'button',
            onclick: async () => {
              const list = await listBackups({ interactive: true });
              if (!list.length) {
                showToast('Could not access the backup folder, or it has no backups yet.', { type: 'error' });
              }
              draw();
            },
          }, ['Grant Access']),
        ]));
      } else {
        const backups = await listBackups();
        if (!backups.length) {
          root.appendChild(el('div', { class: 'empty-state' }, [el('div', {}, ['No backups yet — they’ll appear here once one is created.'])]));
        } else {
          for (const entry of backups) {
            root.appendChild(backupMetaCard(entry, onRestoreEntry));
          }
        }
      }
    }

    // ---- Fallback: plain file-based export/import/restore (works on any browser/device) ----
    root.appendChild(el('div', { class: 'u-font-semibold' }, ['Manual File Backup (any browser)']));
    root.appendChild(actionCard('download', 'Export Backup', 'Save a complete copy of all your bills, customers, items and settings as a downloaded file.', 'Export Backup', onExport));
    root.appendChild(actionCard('backup', 'Import Backup', 'Add records from a backup file into your current data.', 'Choose File to Import', onImport));
    root.appendChild(actionCard('trash', 'Restore from File', 'Erase everything on this device and replace it with a backup file.', 'Choose File to Restore', onRestoreFromFile, { danger: true }));
  }

  await draw();
}
