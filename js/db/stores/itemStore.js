import { getAll, getByIndex, put, remove } from '../database.js';

export async function getAllItems() {
  return getAll('items');
}

/** Item identity is its name (case-insensitive) — HSN and everything else can change, price is never stored. */
export async function findByNameExact(name) {
  if (!name) return null;
  return (await getByIndex('items', 'nameLower', name.trim().toLowerCase())) || null;
}

export async function saveItem(item) {
  await put('items', item);
  return item;
}

export async function deleteItem(id) {
  return remove('items', id);
}
