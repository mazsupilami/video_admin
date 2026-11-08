/**
 * IndexedDB Store for SQLite database files and binary media assets (Blob).
 * Database name: videoAdminLocal
 */

const DB_NAME = 'videoAdminLocal';
const DB_VERSION = 1;
const STORE_SQLITE = 'sqliteFiles';
const STORE_MEDIA = 'mediaAssets';

let dbInstance = null;

export function openIndexedDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SQLITE)) {
        db.createObjectStore(STORE_SQLITE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
      }
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    request.onerror = (e) => {
      console.error('IndexedDB open error:', e.target.error);
      reject(e.target.error);
    };
  });
}

export async function getSqliteBytes(name) {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SQLITE, 'readonly');
    const store = tx.objectStore(STORE_SQLITE);
    const req = store.get(name);
    req.onsuccess = () => {
      if (req.result && req.result.bytes) {
        resolve(req.result.bytes);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveSqliteBytes(name, uint8Array) {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SQLITE, 'readwrite');
    const store = tx.objectStore(STORE_SQLITE);
    const record = {
      name,
      bytes: uint8Array,
      updatedAt: new Date().toISOString()
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = (e) => {
      if (e.target.error && e.target.error.name === 'QuotaExceededError') {
        reject(new Error('Dung lượng lưu trữ của trình duyệt đã đầy (QuotaExceededError).'));
      } else {
        reject(e.target.error);
      }
    };
  });
}

export async function saveMediaAsset(id, blob, fileName, mimeType) {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    const store = tx.objectStore(STORE_MEDIA);
    const record = {
      id,
      blob,
      fileName: fileName || 'file',
      mimeType: mimeType || blob.type,
      sizeBytes: blob.size,
      createdAt: new Date().toISOString()
    };
    const req = store.put(record);
    req.onsuccess = () => resolve(id);
    req.onerror = (e) => {
      if (e.target.error && e.target.error.name === 'QuotaExceededError') {
        reject(new Error('Trình duyệt không đủ dung lượng để lưu file (QuotaExceededError).'));
      } else {
        reject(e.target.error);
      }
    };
  });
}

export async function getMediaAsset(id) {
  if (!id) return null;
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readonly');
    const store = tx.objectStore(STORE_MEDIA);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMediaAsset(id) {
  if (!id) return;
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    const store = tx.objectStore(STORE_MEDIA);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllMediaAssetIds() {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readonly');
    const store = tx.objectStore(STORE_MEDIA);
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function calculateStorageForAssets(assetIdsSet) {
  if (!assetIdsSet || assetIdsSet.size === 0) return 0;
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readonly');
    const store = tx.objectStore(STORE_MEDIA);
    let totalBytes = 0;
    const req = store.openCursor();

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (assetIdsSet.has(cursor.key)) {
          totalBytes += (cursor.value.sizeBytes || (cursor.value.blob ? cursor.value.blob.size : 0));
        }
        cursor.continue();
      } else {
        resolve(totalBytes);
      }
    };

    req.onerror = () => reject(req.error);
  });
}
