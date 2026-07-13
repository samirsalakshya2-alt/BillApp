import * as itemStore from '../db/stores/itemStore.js';
import { uid } from '../utils/uid.js';

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

/** Manual create/edit from the Item Master screen. Price is never part of this record — it's entered fresh on every invoice line. */
export async function saveItem(fields) {
  const name = (fields.name || '').trim();
  const id = fields.id || uid('item');

  const duplicate = await itemStore.findByNameExact(name);
  if (duplicate && duplicate.id !== id) {
    throw new Error(`An item named "${name}" already exists.`);
  }

  const record = { id, name, nameLower: name.toLowerCase(), hsn: (fields.hsn || '').trim() };
  await itemStore.saveItem(record);
  return record;
}

export async function deleteItem(id) {
  return itemStore.deleteItem(id);
}

/** Invoice-line auto-master logic: same-name item (case-insensitive) is the same item; HSN can be refreshed, new items are created on the fly. */
export async function findOrCreateItem({ name, hsn }) {
  const existing = await itemStore.findByNameExact(name);
  return saveItem({ id: existing?.id, name, hsn: hsn || existing?.hsn });
}
