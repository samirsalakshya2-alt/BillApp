/**
 * IndexedDB access layer. One database, opened once, with a small set of
 * generic promise-based helpers that every store/*.js module builds on —
 * keeps IDBRequest/transaction boilerplate in exactly one place.
 */

const DB_NAME = 'BillAppDB';
const DB_VERSION = 1;

/** @type {Promise<IDBDatabase>|null} */
let dbPromise = null;

function upgrade(db) {
  db.createObjectStore('businesses', { keyPath: 'id' });

  const banks = db.createObjectStore('banks', { keyPath: 'id' });
  banks.createIndex('businessId', 'businessId', { unique: false });

  const customers = db.createObjectStore('customers', { keyPath: 'id' });
  customers.createIndex('customerNumber', 'customerNumber', { unique: false });
  customers.createIndex('nameLower', 'nameLower', { unique: false });

  const items = db.createObjectStore('items', { keyPath: 'id' });
  items.createIndex('nameLower', 'nameLower', { unique: true });

  const invoices = db.createObjectStore('invoices', { keyPath: 'id' });
  invoices.createIndex('invoiceNumber', 'invoiceNumber', { unique: true });
  invoices.createIndex('invoiceDate', 'invoiceDate', { unique: false });
  invoices.createIndex('customerId', 'customerId', { unique: false });

  db.createObjectStore('settings', { keyPath: 'key' });
}

/** Opens (or returns the cached open promise for) the app database. */
export function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      upgrade(event.target.result);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database upgrade blocked by another open tab.'));
  });

  return dbPromise;
}

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(storeName) {
  const db = await openDatabase();
  return wrap(tx(db, storeName, 'readonly').getAll());
}

export async function getByKey(storeName, key) {
  const db = await openDatabase();
  return wrap(tx(db, storeName, 'readonly').get(key));
}

export async function getByIndex(storeName, indexName, value) {
  const db = await openDatabase();
  return wrap(db.transaction(storeName, 'readonly').objectStore(storeName).index(indexName).get(value));
}

export async function getAllByIndex(storeName, indexName, value) {
  const db = await openDatabase();
  return wrap(db.transaction(storeName, 'readonly').objectStore(storeName).index(indexName).getAll(value));
}

export async function put(storeName, value) {
  const db = await openDatabase();
  return wrap(tx(db, storeName, 'readwrite').put(value));
}

export async function putMany(storeName, values) {
  const db = await openDatabase();
  const store = tx(db, storeName, 'readwrite');
  await Promise.all(values.map((value) => wrap(store.put(value))));
}

export async function remove(storeName, key) {
  const db = await openDatabase();
  return wrap(tx(db, storeName, 'readwrite').delete(key));
}

export async function clearStore(storeName) {
  const db = await openDatabase();
  return wrap(tx(db, storeName, 'readwrite').clear());
}

/** Returns the largest indexed value in a store (e.g. highest invoiceNumber), or null if empty. */
export async function getMaxIndexValue(storeName, indexName) {
  const db = await openDatabase();
  const index = db.transaction(storeName, 'readonly').objectStore(storeName).index(indexName);
  return new Promise((resolve, reject) => {
    const request = index.openCursor(null, 'prev');
    request.onsuccess = () => resolve(request.result ? request.result.key : null);
    request.onerror = () => reject(request.error);
  });
}

export const STORE_NAMES = ['businesses', 'banks', 'customers', 'items', 'invoices', 'settings'];
