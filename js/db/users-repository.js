/**
 * Repository for Users in users.db
 */
import { getUsersDatabase, queryOne, queryAll, runStatement } from './sqlite-engine.js';
import { persistWithRollback } from './persistence.js';
import { syncUserToSupabase, updateSupabaseUserRole } from './supabase-client.js';

export async function countUsers() {
  const db = await getUsersDatabase();
  const row = queryOne(db, 'SELECT COUNT(*) as total FROM users;');
  return row ? row.total : 0;
}

export async function getUserByEmail(email) {
  if (!email) return null;
  const db = await getUsersDatabase();
  const normalized = email.trim().toLowerCase();
  return queryOne(db, 'SELECT * FROM users WHERE lower(email) = ?;', [normalized]);
}

export async function getUserById(id) {
  if (!id) return null;
  const db = await getUsersDatabase();
  return queryOne(db, 'SELECT * FROM users WHERE id = ?;', [id]);
}

export async function createUser(userData) {
  const db = await getUsersDatabase();
  const now = new Date().toISOString();

  const created = await persistWithRollback(db, 'users.db', () => {
    runStatement(db, `
      INSERT INTO users (
        id, full_name, email, password_hash, password_salt,
        recovery_hash, recovery_salt, role, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      userData.id,
      userData.full_name.trim(),
      userData.email.trim().toLowerCase(),
      userData.password_hash,
      userData.password_salt,
      userData.recovery_hash,
      userData.recovery_salt,
      userData.role || 'user',
      now,
      now
    ]);

    return { ...userData, created_at: now, updated_at: now };
  });

  // Sync to Supabase in background
  syncUserToSupabase(created).catch(e => console.warn('[Supabase] Auto-sync createUser error:', e));

  return created;
}

export async function updateUserPasswordAndRecovery(userId, passwordHash, passwordSalt, recoveryHash, recoverySalt) {
  const db = await getUsersDatabase();
  const now = new Date().toISOString();

  return persistWithRollback(db, 'users.db', () => {
    runStatement(db, `
      UPDATE users SET
        password_hash = ?,
        password_salt = ?,
        recovery_hash = ?,
        recovery_salt = ?,
        updated_at = ?
      WHERE id = ?;
    `, [passwordHash, passwordSalt, recoveryHash, recoverySalt, now, userId]);

    return true;
  });
}

export async function updateLastLogin(userId) {
  const db = await getUsersDatabase();
  const now = new Date().toISOString();

  return persistWithRollback(db, 'users.db', () => {
    runStatement(db, 'UPDATE users SET last_login_at = ? WHERE id = ?;', [now, userId]);
  });
}

export async function countAllUsers({ search = '', role = '' } = {}) {
  const db = await getUsersDatabase();
  const searchPattern = search ? `%${search.trim().toLowerCase()}%` : '';

  let sql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
  const params = [];

  if (searchPattern) {
    sql += ' AND (lower(full_name) LIKE ? OR lower(email) LIKE ?)';
    params.push(searchPattern, searchPattern);
  }
  if (role) {
    sql += ' AND role = ?';
    params.push(role);
  }

  const row = queryOne(db, sql, params);
  return row ? row.total : 0;
}

export async function getAllUsers({
  search = '',
  role = '',
  page = 1,
  limit = 10
} = {}) {
  const db = await getUsersDatabase();
  const searchPattern = search ? `%${search.trim().toLowerCase()}%` : '';
  const offset = Math.max(0, (page - 1) * limit);

  let sql = `
    SELECT id, full_name, email, role, created_at, updated_at, last_login_at
    FROM users
    WHERE 1=1
  `;
  const params = [];

  if (searchPattern) {
    sql += ' AND (lower(full_name) LIKE ? OR lower(email) LIKE ?)';
    params.push(searchPattern, searchPattern);
  }
  if (role) {
    sql += ' AND role = ?';
    params.push(role);
  }

  // Order: admins first, then newest created
  sql += `
    ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END ASC,
             created_at DESC, id ASC
    LIMIT ? OFFSET ?;
  `;
  params.push(limit, offset);

  return queryAll(db, sql, params);
}

export async function getUserRoleCounts() {
  const db = await getUsersDatabase();
  const total = queryOne(db, 'SELECT COUNT(*) as cnt FROM users;')?.cnt || 0;
  const admins = queryOne(db, "SELECT COUNT(*) as cnt FROM users WHERE role = 'admin';")?.cnt || 0;
  const users = queryOne(db, "SELECT COUNT(*) as cnt FROM users WHERE role = 'user';")?.cnt || 0;

  return { total, admins, users };
}

export async function updateUserRole(userId, newRole) {
  if (newRole !== 'admin' && newRole !== 'user') {
    throw new Error('Vai trò không hợp lệ. Chỉ chấp nhận admin hoặc user.');
  }

  const db = await getUsersDatabase();
  const now = new Date().toISOString();

  const result = await persistWithRollback(db, 'users.db', () => {
    runStatement(db, 'UPDATE users SET role = ?, updated_at = ? WHERE id = ?;', [newRole, now, userId]);
    return true;
  });

  // Sync to Supabase in background
  updateSupabaseUserRole(userId, newRole).catch(e => console.warn('[Supabase] Auto-sync role update error:', e));

  return result;
}

export async function syncAllLocalUsersToSupabase() {
  const db = await getUsersDatabase();
  const users = queryAll(db, 'SELECT * FROM users;');
  let successCount = 0;
  for (const u of users) {
    const ok = await syncUserToSupabase(u);
    if (ok) successCount++;
  }
  return { total: users.length, synced: successCount };
}

/**
 * Pull and sync users from Supabase public.users to local SQLite
 */
export async function syncUsersFromSupabase() {
  try {
    const { getSupabase, initSupabase } = await import('./supabase-client.js');
    const client = getSupabase() || await initSupabase();
    if (!client) return false;

    const { data: remoteUsers, error } = await client.from('users').select('*');
    if (error || !remoteUsers || remoteUsers.length === 0) return false;

    const db = await getUsersDatabase();
    for (const ru of remoteUsers) {
      const existing = queryOne(db, 'SELECT id, role, updated_at FROM users WHERE lower(email) = ?;', [ru.email.toLowerCase()]);
      if (!existing) {
        runStatement(db, `
          INSERT INTO users (
            id, full_name, email, password_hash, password_salt,
            recovery_hash, recovery_salt, role, created_at, updated_at, last_login_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
          ru.id,
          ru.full_name,
          ru.email.toLowerCase(),
          ru.password_hash || 'SYNCED_FROM_SUPABASE',
          ru.password_salt || 'SYNCED_FROM_SUPABASE',
          ru.recovery_hash || 'SYNCED_FROM_SUPABASE',
          ru.recovery_salt || 'SYNCED_FROM_SUPABASE',
          ru.role || 'user',
          ru.created_at || new Date().toISOString(),
          ru.updated_at || new Date().toISOString(),
          ru.last_login_at || null
        ]);
      } else if (existing.role !== ru.role) {
        runStatement(db, 'UPDATE users SET role = ?, updated_at = ? WHERE id = ?;', [ru.role, ru.updated_at, existing.id]);
      }
    }
    return true;
  } catch (err) {
    console.warn('[Sync users from Supabase warning]', err);
    return false;
  }
}
