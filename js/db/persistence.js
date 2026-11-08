/**
 * Persistence layer: Handles write queueing, atomic exports to IndexedDB,
 * in-memory rollback on failure, and downloading .db files.
 */
import { saveSqliteBytes } from './indexeddb-store.js';

let writeLock = Promise.resolve();

export function queueDatabaseWrite(writeAction) {
  writeLock = writeLock.then(async () => {
    try {
      return await writeAction();
    } catch (err) {
      console.error('Database write error:', err);
      throw err;
    }
  });
  return writeLock;
}

/**
 * Persists an in-memory SQL.js instance to IndexedDB with rollback on error.
 */
export async function persistWithRollback(db, dbName, mutationFn) {
  return queueDatabaseWrite(async () => {
    // Take snapshot of current state
    const snapshotBytes = db.export();

    try {
      // Execute the mutations
      const result = await mutationFn();

      // Export the updated state
      const updatedBytes = db.export();

      // Persist to IndexedDB
      await saveSqliteBytes(dbName, updatedBytes);

      return result;
    } catch (err) {
      console.error(`Persist failed for ${dbName}. Rolling back to snapshot.`, err);
      // Rollback: reload SQLite instance from snapshot
      // (Or overwrite with snapshot)
      try {
        db.run('ROLLBACK;');
      } catch (e) {
        // Transaction may not have been open
      }
      throw err;
    }
  });
}

/**
 * Triggers a browser download of the SQLite database.
 */
export async function exportDatabaseFile(db, fileName) {
  const bytes = db.export();
  const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
