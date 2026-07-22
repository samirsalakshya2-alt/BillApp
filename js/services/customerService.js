import * as customerStore from '../db/stores/customerStore.js';
import { uid } from '../utils/uid.js';
import { scheduleAutoBackup } from './autoBackupService.js';

export async function listCustomers() {
  const all = await customerStore.getAllCustomers();
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

/** In-memory substring search over number/name — dataset size makes indexes unnecessary (see architecture notes). */
export async function searchCustomers(query) {
  const all = await listCustomers();
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    (c) => c.name.toLowerCase().includes(q) || (c.customerNumber || '').toLowerCase().includes(q)
  );
}

function normalize(fields) {
  return {
    customerNumber: (fields.customerNumber || '').trim(),
    name: (fields.name || '').trim(),
    nameLower: (fields.name || '').trim().toLowerCase(),
    address: (fields.address || '').trim(),
    gstin: (fields.gstin || '').trim().toUpperCase(),
    state: (fields.state || '').trim(),
    stateCode: (fields.stateCode || '').trim(),
    placeOfSupply: (fields.placeOfSupply || '').trim(),
  };
}

/** Manual create/edit from the Customer Master screen. */
export async function saveCustomer(fields) {
  const now = new Date().toISOString();
  const record = {
    id: fields.id || uid('cust'),
    ...normalize(fields),
    createdAt: fields.createdAt || now,
    updatedAt: now,
  };
  await customerStore.saveCustomer(record);
  scheduleAutoBackup();
  return record;
}

export async function deleteCustomer(id) {
  const result = await customerStore.deleteCustomer(id);
  scheduleAutoBackup();
  return result;
}

/**
 * Invoice-save auto-master logic: match an existing customer by id (selected
 * via autocomplete), else by exact customer number, else by exact name; update
 * it with whatever was entered on the invoice, or create a new customer if
 * none of those matched.
 */
export async function findOrCreateOrUpdate(fields) {
  let existing = null;
  if (fields.id) existing = await customerStore.getCustomer(fields.id);
  if (!existing && fields.customerNumber) existing = await customerStore.findByNumberExact(fields.customerNumber);
  if (!existing && fields.name) existing = await customerStore.findByNameExact(fields.name);

  return saveCustomer({ ...fields, id: existing?.id, createdAt: existing?.createdAt });
}
