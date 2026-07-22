import * as invoiceStore from '../db/stores/invoiceStore.js';
import * as settingsStore from '../db/stores/settingsStore.js';
import * as customerService from './customerService.js';
import * as itemService from './itemService.js';
import { getActiveBusiness } from '../db/stores/businessStore.js';
import { getBank } from '../db/stores/bankStore.js';
import { amountToWords } from './numberToWords.js';
import { uid } from '../utils/uid.js';
import { scheduleAutoBackup } from './autoBackupService.js';

/**
 * Invoice numbering: plain sequential integers. The suggested next number is
 * always one past whichever is higher — the highest invoiceNumber actually
 * saved, or the manual counter override set in Settings — so a manual edit
 * (or a deliberate "jump to 5000" in Settings) is always respected.
 */
export async function getNextInvoiceNumber() {
  const [highestSaved, counter] = await Promise.all([
    invoiceStore.getHighestInvoiceNumber(),
    settingsStore.getInvoiceCounter(),
  ]);
  return Math.max(highestSaved, counter) + 1;
}

/** Called after any invoice save so a manually-typed high number keeps numbering moving forward. */
export async function recordInvoiceNumberUsed(invoiceNumber) {
  const n = Number(invoiceNumber);
  if (!Number.isFinite(n)) return;
  const counter = await settingsStore.getInvoiceCounter();
  if (n > counter) {
    await settingsStore.setInvoiceCounter(n);
  }
}

/** Settings → "Invoice Numbering" override: force the next suggested number. */
export async function setInvoiceCounterOverride(nextNumber) {
  const n = Number(nextNumber);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('Invoice number must be a whole number.');
  }
  await settingsStore.setInvoiceCounter(n - 1);
  scheduleAutoBackup();
}

/**
 * Quantity units selectable per invoice line. "Quintal" is the default; more
 * units can be appended here without touching form/renderer code.
 */
export const QUANTITY_UNITS = ['Quintal'];
export const DEFAULT_QUANTITY_UNIT = QUANTITY_UNITS[0];

export function computeItemAmount(qty, rate) {
  const q = Number(qty) || 0;
  const r = Number(rate) || 0;
  return Math.round(q * r * 100) / 100;
}

export function computeTotalAmount(items) {
  return Math.round(items.reduce((sum, row) => sum + computeItemAmount(row.qty, row.rate), 0) * 100) / 100;
}

/**
 * Turns validated invoice-form state into a persisted invoice: creates/updates
 * the customer and every line item in their master tables, snapshots
 * business/bank/customer details onto the invoice (so history never changes
 * retroactively if a master record is edited later), and keeps invoice
 * numbering moving forward past whatever number was actually used.
 */
export async function saveInvoiceFromForm(formState) {
  const business = await getActiveBusiness();
  const bank = await getBank(formState.bankId);

  const customer = await customerService.findOrCreateOrUpdate({
    id: formState.customerId,
    customerNumber: formState.customerNumber,
    name: formState.customerName,
    address: formState.customerAddress,
    gstin: formState.customerGstin,
    state: formState.customerState,
    stateCode: formState.customerStateCode,
    placeOfSupply: formState.placeOfSupply,
  });

  const items = [];
  for (const row of formState.items) {
    const item = await itemService.findOrCreateItem({ name: row.name, hsn: row.hsn, unit: row.unit });
    items.push({
      itemId: item.id,
      name: item.name,
      hsn: item.hsn,
      bags: row.bags || '',
      qty: Number(row.qty) || 0,
      unit: item.unit || DEFAULT_QUANTITY_UNIT,
      rate: Number(row.rate) || 0,
      amount: computeItemAmount(row.qty, row.rate),
    });
  }

  const totalAmount = computeTotalAmount(items);
  const now = new Date().toISOString();
  const invoiceNumber = Number(formState.invoiceNumber);

  const invoice = {
    id: formState.id || uid('inv'),
    invoiceNumber,
    invoiceDate: formState.invoiceDate,
    transportMode: formState.transportMode || '',
    vehicleNumber: formState.vehicleNumber || '',
    dateOfSupply: formState.dateOfSupply || formState.invoiceDate,
    customerId: customer.id,
    customerSnapshot: {
      customerNumber: customer.customerNumber,
      name: customer.name,
      address: customer.address,
      gstin: customer.gstin,
      state: customer.state,
      stateCode: customer.stateCode,
      placeOfSupply: customer.placeOfSupply,
    },
    driverName: formState.driverName || '',
    driverContact: formState.driverContact || '',
    brokerName: formState.brokerName || '',
    items,
    totalAmount,
    amountInWords: amountToWords(totalAmount),
    bankId: bank.id,
    bankSnapshot: {
      bankName: bank.bankName,
      accountName: bank.accountName,
      accountNumber: bank.accountNumber,
      ifsc: bank.ifsc,
      branch: bank.branch,
    },
    remarks: formState.remarks || '',
    businessId: business.id,
    createdAt: formState.createdAt || now,
    updatedAt: now,
  };

  await invoiceStore.saveInvoice(invoice);
  await recordInvoiceNumberUsed(invoiceNumber);
  scheduleAutoBackup();
  return invoice;
}

/**
 * A persisted invoice record -> editable form state. Shared by the "edit an
 * existing bill" flow and "duplicate a bill" (which reuses this then blanks
 * out the id/number/dates so it saves as a brand new invoice).
 */
export function formStateFromInvoice(invoice) {
  return {
    id: invoice.id,
    createdAt: invoice.createdAt,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    transportMode: invoice.transportMode || '',
    vehicleNumber: invoice.vehicleNumber || '',
    dateOfSupply: invoice.dateOfSupply || invoice.invoiceDate,
    customerId: invoice.customerId || null,
    customerNumber: invoice.customerSnapshot?.customerNumber || '',
    customerName: invoice.customerSnapshot?.name || '',
    customerAddress: invoice.customerSnapshot?.address || '',
    customerGstin: invoice.customerSnapshot?.gstin || '',
    customerState: invoice.customerSnapshot?.state || '',
    customerStateCode: invoice.customerSnapshot?.stateCode || '',
    placeOfSupply: invoice.customerSnapshot?.placeOfSupply || '',
    driverName: invoice.driverName || '',
    driverContact: invoice.driverContact || '',
    brokerName: invoice.brokerName || '',
    items: (invoice.items || []).map((it) => ({
      rowId: uid('row'), itemId: it.itemId, name: it.name, hsn: it.hsn,
      bags: it.bags || '', qty: it.qty, unit: it.unit || DEFAULT_QUANTITY_UNIT, rate: it.rate,
    })),
    bankId: invoice.bankId,
    remarks: invoice.remarks || '',
  };
}

export async function listInvoices() {
  const all = await invoiceStore.getAllInvoices();
  return all.sort((a, b) => b.invoiceNumber - a.invoiceNumber);
}

/** In-memory search across invoice number, customer name, vehicle, driver, broker, and date (see architecture notes). */
export async function searchInvoices(query) {
  const all = await listInvoices();
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((inv) => {
    const haystacks = [
      String(inv.invoiceNumber),
      inv.customerSnapshot?.name || '',
      inv.vehicleNumber || '',
      inv.driverName || '',
      inv.brokerName || '',
      inv.invoiceDate || '',
    ];
    return haystacks.some((h) => h.toLowerCase().includes(q));
  });
}

export async function deleteInvoice(id) {
  return invoiceStore.deleteInvoice(id);
}

export async function getInvoiceById(id) {
  return invoiceStore.getInvoice(id);
}
