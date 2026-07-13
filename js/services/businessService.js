import { getActiveBusiness } from '../db/stores/businessStore.js';
import { getBanksForBusiness, getBank, getDefaultBank } from '../db/stores/bankStore.js';

/**
 * Business + bank data for the active (v1: single, config-seeded) business.
 * Views must go through here rather than importing db/stores directly, so
 * persistence details stay swappable behind one layer — see architecture
 * notes in config/business.js.
 */
export async function getBusiness() {
  return getActiveBusiness();
}

export async function getBanks() {
  const business = await getActiveBusiness();
  return getBanksForBusiness(business.id);
}

export async function getDefaultBankForBusiness() {
  const business = await getActiveBusiness();
  return getDefaultBank(business.id);
}

export async function getBankById(id) {
  return getBank(id);
}
