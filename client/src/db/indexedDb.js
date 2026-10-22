import { openDB } from 'idb';

const DB_NAME = 'FormOfflineCache';
const STORE_NAME = 'pending_submissions';
const DB_VERSION = 1;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'localId', autoIncrement: true });
    }
  },
});

export async function addOfflineSubmission(data) {
  const db = await dbPromise;
  return db.add(STORE_NAME, data);
}

export async function getOfflineSubmissions() {
  const db = await dbPromise;
  return db.getAll(STORE_NAME);
}

export async function deleteOfflineSubmission(id) {
  const db = await dbPromise;
  return db.delete(STORE_NAME, id);
}