/** Formatting helpers for currency/date display — shared by views and the invoice renderer. */

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_PLAIN_FORMATTER = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount) {
  return INR_FORMATTER.format(Number(amount) || 0);
}

/** Same Indian digit grouping as formatCurrency but without the ₹ symbol. */
export function formatAmount(amount) {
  return INR_PLAIN_FORMATTER.format(Number(amount) || 0);
}

/** ISO 'yyyy-mm-dd' (from <input type="date">) -> 'dd-Mon-yyyy' for display/print. */
export function formatDateDisplay(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d).padStart(2, '0')}-${months[m - 1]}-${y}`;
}

/** Today's date as an ISO string suitable for <input type="date"> value. */
export function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function formatDateTimeDisplay(isoDateTime) {
  if (!isoDateTime) return '';
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
