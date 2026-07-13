import { getAllByIndex, getByKey } from '../database.js';

export async function getBanksForBusiness(businessId) {
  return getAllByIndex('banks', 'businessId', businessId);
}

export async function getBank(id) {
  return getByKey('banks', id);
}

export async function getDefaultBank(businessId) {
  const banks = await getBanksForBusiness(businessId);
  return banks.find((b) => b.isDefault) || banks[0] || null;
}
