import { getAll, getByKey, getMaxIndexValue, put, remove } from '../database.js';

export async function getAllInvoices() {
  return getAll('invoices');
}

export async function getInvoice(id) {
  return getByKey('invoices', id);
}

/** Highest invoiceNumber currently stored, or 0 if there are no invoices yet. */
export async function getHighestInvoiceNumber() {
  const max = await getMaxIndexValue('invoices', 'invoiceNumber');
  return max || 0;
}

export async function saveInvoice(invoice) {
  await put('invoices', invoice);
  return invoice;
}

export async function deleteInvoice(id) {
  return remove('invoices', id);
}
