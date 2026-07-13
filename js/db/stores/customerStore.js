import { getAll, getAllByIndex, getByKey, put, remove } from '../database.js';

export async function getAllCustomers() {
  return getAll('customers');
}

export async function getCustomer(id) {
  return getByKey('customers', id);
}

export async function findByNumberExact(customerNumber) {
  if (!customerNumber) return null;
  const matches = await getAllByIndex('customers', 'customerNumber', customerNumber);
  return matches[0] || null;
}

export async function findByNameExact(name) {
  if (!name) return null;
  const matches = await getAllByIndex('customers', 'nameLower', name.trim().toLowerCase());
  return matches[0] || null;
}

export async function saveCustomer(customer) {
  await put('customers', customer);
  return customer;
}

export async function deleteCustomer(id) {
  return remove('customers', id);
}
