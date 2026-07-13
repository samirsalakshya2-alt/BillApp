import { getByKey, put } from '../js/db/database.js';
import { BUSINESS_ID, DEFAULT_BUSINESS, DEFAULT_BANKS } from '../config/business.js';

/** Writes the v1 business + its two default banks into IndexedDB, once. */
export async function seedIfNeeded() {
  const existing = await getByKey('businesses', BUSINESS_ID);
  if (existing) return;

  await put('businesses', DEFAULT_BUSINESS);
  await Promise.all(DEFAULT_BANKS.map((bank) => put('banks', bank)));
}
