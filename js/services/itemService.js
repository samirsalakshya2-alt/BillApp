import * as itemStore from '../db/stores/itemStore.js';
import { uid } from '../utils/uid.js';
import { scheduleAutoBackup } from './autoBackupService.js';

export async function listItems() {
  const all = await itemStore.getAllItems();
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function searchItems(query) {
  const all = await listItems();
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((i) => i.name.toLowerCase().includes(q) || (i.hsn || '').includes(q));
}

/** The only unit item master currently supports; every new item defaults to it. */
export const DEFAULT_ITEM_UNIT = 'Quintal';

/** Manual create/edit from the Item Master screen. Price/quantity/bags/amount are never part of this record — those are entered fresh on every invoice line. */
export async function saveItem(fields) {
  const name = (fields.name || '').trim();
  const id = fields.id || uid('item');

  const duplicate = await itemStore.findByNameExact(name);
  if (duplicate && duplicate.id !== id) {
    throw new Error(`An item named "${name}" already exists.`);
  }

  const record = {
    id,
    name,
    nameLower: name.toLowerCase(),
    hsn: (fields.hsn || '').trim(),
    unit: fields.unit || DEFAULT_ITEM_UNIT,
  };
  await itemStore.saveItem(record);
  scheduleAutoBackup();
  return record;
}

export async function deleteItem(id) {
  const result = await itemStore.deleteItem(id);
  scheduleAutoBackup();
  return result;
}

/**
 * Invoice-line auto-master logic: same-name item (case-insensitive) is the
 * same item; a new item defaults to the standard unit, and an existing
 * item's HSN/unit are refreshed with whatever was (possibly edited) on the
 * bill line.
 */
export async function findOrCreateItem({ name, hsn, unit }) {
  const existing = await itemStore.findByNameExact(name);
  return saveItem({
    id: existing?.id,
    name,
    hsn: hsn || existing?.hsn,
    unit: unit || existing?.unit || DEFAULT_ITEM_UNIT,
  });
}
