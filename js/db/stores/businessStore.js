import { getByKey } from '../database.js';
import { BUSINESS_ID } from '../../../config/business.js';

/**
 * V1 is single-business: this store only ever reads the one record `seed.js`
 * writes on first run. No create/update here on purpose — see config/business.js.
 */
export async function getActiveBusiness() {
  return getByKey('businesses', BUSINESS_ID);
}
