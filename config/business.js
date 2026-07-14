/**
 * V1 single-business configuration.
 *
 * This is the one place business identity lives in v1 — there is no Business
 * Profile management screen. `data/seed.js` writes this into IndexedDB once
 * (so invoices/banks can still hold a real businessId foreign key), and
 * `invoiceRenderer` reads the seeded record rather than this file directly,
 * which keeps the door open for a future multi-business UI without any
 * renderer/service changes.
 */

export const BUSINESS_ID = 'biz-agrawal-galla-bhandar';

export const DEFAULT_BUSINESS = {
  id: BUSINESS_ID,
  name: 'AGRAWAL GALLA BHANDAR',
  addressLines: ['Kalinath Chowk', 'Gola', 'District Ramgarh', 'Jharkhand', '829110'],
  gstin: '20BMFPA6412G1ZU',
  phones: ['7050401605', '9939427807'],
  email: 'binay677@gmail.com',
  state: 'Jharkhand',
  stateCode: '20',
  invoiceTitle: 'BILL OF SUPPLY',
};

/**
 * The two bank accounts, seeded into IndexedDB on first run. Banks are fixed
 * configuration in v1 — there is no in-app bank editing screen. Update the
 * real account numbers/IFSC directly below (and bump DB_VERSION's seed if
 * already deployed) before the app is used for real invoices.
 */
export const DEFAULT_BANKS = [
  {
    id: 'bank-1',
    businessId: BUSINESS_ID,
    bankName: 'Bank of India',
    accountName: 'Agrawal Galla Bhandar',
    accountNumber: '489720110000160',
    ifsc: 'BKID0004897',
    branch: 'Bantara',
    isDefault: true,
  },
  {
    id: 'bank-2',
    businessId: BUSINESS_ID,
    bankName: 'HDFC',
    accountName: 'Agrawal Galla Bhandar',
    accountNumber: '50200051395857',
    ifsc: 'HDFC0004814',
    branch: 'Gola',
    isDefault: false,
  },
];
