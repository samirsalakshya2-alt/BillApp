import { computeItemAmount, computeTotalAmount, DEFAULT_QUANTITY_UNIT } from './invoiceService.js';
import { amountToWords } from './numberToWords.js';

/** The one official seal + authorized signature image, used unmodified on every invoice. */
export const SEAL_SIGNATURE_SRC = 'assets/SignedSeal.png';

function normalizeBusiness(business) {
  return {
    name: business.name,
    addressLines: business.addressLines || [],
    gstin: business.gstin || '',
    phones: business.phones || [],
    email: business.email || '',
    invoiceTitle: business.invoiceTitle || 'BILL OF SUPPLY',
  };
}

function normalizeBank(bank) {
  return {
    bankName: bank.bankName || '',
    accountName: bank.accountName || '',
    accountNumber: bank.accountNumber || '',
    ifsc: bank.ifsc || '',
    branch: bank.branch || '',
  };
}

/** Not-yet-saved invoice form state -> renderer view model (customer/bank fields are still raw form inputs). */
export function viewModelFromFormState(formState, { business, bank }) {
  const items = formState.items.map((row) => ({
    name: row.name,
    hsn: row.hsn,
    bags: row.bags || '',
    qty: Number(row.qty) || 0,
    unit: row.unit || DEFAULT_QUANTITY_UNIT,
    rate: Number(row.rate) || 0,
    amount: computeItemAmount(row.qty, row.rate),
  }));
  const totalAmount = computeTotalAmount(formState.items);

  return {
    business: normalizeBusiness(business),
    invoiceNumber: formState.invoiceNumber,
    invoiceDate: formState.invoiceDate,
    dateOfSupply: formState.dateOfSupply,
    transportMode: formState.transportMode,
    vehicleNumber: formState.vehicleNumber,
    driverName: formState.driverName,
    driverContact: formState.driverContact,
    brokerName: formState.brokerName,
    customer: {
      customerNumber: formState.customerNumber,
      name: formState.customerName,
      address: formState.customerAddress,
      gstin: formState.customerGstin,
      state: formState.customerState,
      stateCode: formState.customerStateCode,
      placeOfSupply: formState.placeOfSupply,
    },
    items,
    totalAmount,
    amountInWords: amountToWords(totalAmount),
    bank: normalizeBank(bank),
    remarks: formState.remarks || '',
    sealSignatureSrc: SEAL_SIGNATURE_SRC,
  };
}

/** A persisted invoice record (already has snapshots + computed totals) -> renderer view model. */
export function viewModelFromInvoice(invoice, { business }) {
  return {
    business: normalizeBusiness(business),
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dateOfSupply: invoice.dateOfSupply,
    transportMode: invoice.transportMode,
    vehicleNumber: invoice.vehicleNumber,
    driverName: invoice.driverName,
    driverContact: invoice.driverContact,
    brokerName: invoice.brokerName,
    customer: { ...invoice.customerSnapshot },
    items: invoice.items,
    totalAmount: invoice.totalAmount,
    amountInWords: invoice.amountInWords,
    bank: { ...invoice.bankSnapshot },
    remarks: invoice.remarks || '',
    sealSignatureSrc: SEAL_SIGNATURE_SRC,
  };
}
