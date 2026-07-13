/** Converts a rupee amount into words using the Indian numbering system (lakh/crore). */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsToWords(n) {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return TENS[tens] + (ones ? ` ${ONES[ones]}` : '');
}

function threeDigitsToWords(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(' ');
}

function integerToWords(value) {
  if (value === 0) return 'Zero';

  let n = value;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;

  const parts = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));
  return parts.join(' ');
}

/** e.g. amountToWords(123456.75) -> "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Seventy Five Paise Only" */
export function amountToWords(amount) {
  const normalized = Math.round((Number(amount) || 0) * 100) / 100;
  const rupees = Math.floor(normalized);
  const paise = Math.round((normalized - rupees) * 100);

  let words = `${integerToWords(rupees)} Rupees`;
  if (paise > 0) {
    words += ` and ${twoDigitsToWords(paise)} Paise`;
  }
  return `${words} Only`;
}
