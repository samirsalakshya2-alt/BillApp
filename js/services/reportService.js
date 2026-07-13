import { getAllInvoices } from '../db/stores/invoiceStore.js';
import { todayIso } from '../ui/formatters.js';

function sumTotals(invoices) {
  return invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
}

/** All bills issued today, newest invoice number first, plus the day's total. */
export async function getTodaysBills() {
  const all = await getAllInvoices();
  const today = todayIso();
  const invoices = all.filter((inv) => inv.invoiceDate === today).sort((a, b) => b.invoiceNumber - a.invoiceNumber);
  return { invoices, total: sumTotals(invoices), count: invoices.length };
}

/** Bills for a given 'YYYY-MM' month (defaults to the current month). */
export async function getMonthlyBills(yearMonth = todayIso().slice(0, 7)) {
  const all = await getAllInvoices();
  const invoices = all
    .filter((inv) => (inv.invoiceDate || '').startsWith(yearMonth))
    .sort((a, b) => b.invoiceNumber - a.invoiceNumber);
  return { invoices, total: sumTotals(invoices), count: invoices.length, yearMonth };
}

/** Sales grouped by customer, sorted by total descending. */
export async function getCustomerWiseSales() {
  const all = await getAllInvoices();
  const byCustomer = new Map();

  for (const inv of all) {
    const key = inv.customerId || inv.customerSnapshot?.name || 'unknown';
    const name = inv.customerSnapshot?.name || 'Unknown customer';
    const entry = byCustomer.get(key) || { name, billCount: 0, total: 0 };
    entry.billCount += 1;
    entry.total += Number(inv.totalAmount) || 0;
    byCustomer.set(key, entry);
  }

  return Array.from(byCustomer.values()).sort((a, b) => b.total - a.total);
}

/** Sales grouped by item name, sorted by total amount descending. */
export async function getItemWiseSales() {
  const all = await getAllInvoices();
  const byItem = new Map();

  for (const inv of all) {
    for (const row of inv.items || []) {
      const key = (row.name || 'Unknown item').toLowerCase();
      const entry = byItem.get(key) || { name: row.name || 'Unknown item', qty: 0, total: 0, billCount: 0 };
      entry.qty += Number(row.qty) || 0;
      entry.total += Number(row.amount) || 0;
      entry.billCount += 1;
      byItem.set(key, entry);
    }
  }

  return Array.from(byItem.values()).sort((a, b) => b.total - a.total);
}
