/**
 * SQLite Engine: WebAssembly sql.js loader and DB connection lifecycle.
 */
import { getSqliteBytes, saveSqliteBytes } from './indexeddb-store.js';

let SQL = null;
let usersDbInstance = null;
let videosDbInstance = null;
let initPromise = null;

export async function initSqlEngine() {
  if (SQL) return SQL;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // vendor/sql-wasm.js provides window.initSqlJs
    if (typeof window.initSqlJs !== 'function') {
      throw new Error('Thư viện sql.js chưa được tải. Vui lòng kiểm tra script vendor/sql-wasm.js.');
    }

    SQL = await window.initSqlJs({
      locateFile: (file) => `vendor/${file}`
    });

    return SQL;
  })();

  return initPromise;
}

export async function getUsersDatabase() {
  if (usersDbInstance) return usersDbInstance;
  const sql = await initSqlEngine();

  // 1. Check IndexedDB
  const bytes = await getSqliteBytes('users.db');
  if (bytes && bytes.length > 0) {
    usersDbInstance = new sql.Database(new Uint8Array(bytes));
    usersDbInstance.run('PRAGMA foreign_keys = ON;');
    await migrateAndSeedUsers(usersDbInstance);
    return usersDbInstance;
  }

  // 2. Try fetch seed database/users.db
  try {
    const res = await fetch('database/users.db');
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 0) {
        usersDbInstance = new sql.Database(new Uint8Array(buf));
        usersDbInstance.run('PRAGMA foreign_keys = ON;');
        await migrateAndSeedUsers(usersDbInstance);
        await saveSqliteBytes('users.db', usersDbInstance.export());
        return usersDbInstance;
      }
    }
  } catch (err) {
    console.warn('Could not fetch seed database/users.db, fallback to schema creation', err);
  }

  // 3. Fallback: Initialize schema
  usersDbInstance = new sql.Database();
  usersDbInstance.run(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 100),
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      recovery_hash TEXT NOT NULL,
      recovery_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    PRAGMA user_version = 2;
  `);

  await seed10DemoUsers(usersDbInstance);
  await saveSqliteBytes('users.db', usersDbInstance.export());
  return usersDbInstance;
}

async function migrateAndSeedUsers(db) {
  try {
    const row = queryOne(db, 'PRAGMA user_version;');
    const v = row ? Object.values(row)[0] : 1;
    if (v < 2) {
      db.run(`
        CREATE TABLE IF NOT EXISTS users_v2 (
          id TEXT PRIMARY KEY,
          full_name TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 100),
          email TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          recovery_hash TEXT NOT NULL,
          recovery_salt TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_login_at TEXT
        );
        INSERT INTO users_v2 SELECT * FROM users;
        DROP TABLE users;
        ALTER TABLE users_v2 RENAME TO users;
        CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
        PRAGMA user_version = 2;
      `);
    }

    // Always seed missing demo users and sync their password hashes
    await seed10DemoUsers(db);

    // Sync demo passwords to ensure they match User@123456 and Admin@123456
    const salt = 'ZGVtb1NhbHQxMjM0NTY3OA==';
    const userHash = 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=';
    const adminHash = 'xD0833rh9/9AAOHi0alYFrLWlN5yo5Ce7z3VsVdVfBg=';

    runStatement(db, `
      UPDATE users SET password_hash = ?, password_salt = ?
      WHERE lower(email) IN (
        'user1@demo.com', 'user2@demo.com', 'user3@demo.com', 'user4@demo.com', 'user5@demo.com',
        'user6@demo.com', 'user7@demo.com', 'user8@demo.com', 'user9@demo.com', 'user10@demo.com'
      );
    `, [userHash, salt]);

    runStatement(db, `
      UPDATE users SET password_hash = ?, password_salt = ?
      WHERE lower(email) = 'admin@demo.com';
    `, [adminHash, salt]);

    await saveSqliteBytes('users.db', db.export());
  } catch (err) {
    console.warn('User migration check warning:', err);
  }
}

async function seed10DemoUsers(db) {
  const now = new Date();
  const salt = 'ZGVtb1NhbHQxMjM0NTY3OA=='; // 16 bytes base64
  const userHash = 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y='; // User@123456
  const adminHash = 'xD0833rh9/9AAOHi0alYFrLWlN5yo5Ce7z3VsVdVfBg='; // Admin@123456

  // 1. Seed demo Admin if not present
  const adminExists = queryOne(db, "SELECT id FROM users WHERE lower(email) = 'admin@demo.com';");
  if (!adminExists) {
    const adminId = crypto.randomUUID ? crypto.randomUUID() : `admin-demo-${Date.now()}`;
    const adminCreated = new Date(now.getTime() - 15 * 3600000 * 24).toISOString();
    runStatement(db, `
      INSERT INTO users (
        id, full_name, email, password_hash, password_salt,
        recovery_hash, recovery_salt, role, created_at, updated_at
      ) VALUES (?, 'Quản trị viên Demo', 'admin@demo.com', ?, ?, ?, ?, 'admin', ?, ?);
    `, [adminId, adminHash, salt, adminHash, salt, adminCreated, adminCreated]);
  }

  // 2. Seed 10 Users
  const demoUsers = [
    { name: 'Nguyễn Văn An', email: 'user1@demo.com' },
    { name: 'Trần Thị Bích', email: 'user2@demo.com' },
    { name: 'Lê Hoàng Cường', email: 'user3@demo.com' },
    { name: 'Phạm Minh Dũng', email: 'user4@demo.com' },
    { name: 'Hoàng Hải Yến', email: 'user5@demo.com' },
    { name: 'Đỗ Quốc Khánh', email: 'user6@demo.com' },
    { name: 'Vũ Thùy Linh', email: 'user7@demo.com' },
    { name: 'Bùi Quang Minh', email: 'user8@demo.com' },
    { name: 'Ngô Phương Nga', email: 'user9@demo.com' },
    { name: 'Đặng Tuấn Phong', email: 'user10@demo.com' }
  ];

  for (let idx = 0; idx < demoUsers.length; idx++) {
    const u = demoUsers[idx];
    const exists = queryOne(db, 'SELECT id FROM users WHERE lower(email) = ?;', [u.email]);
    if (!exists) {
      const id = crypto.randomUUID ? crypto.randomUUID() : `user-${idx + 1}-${Date.now()}`;
      const createdAt = new Date(now.getTime() - (10 - idx) * 3600000 * 24).toISOString();
      const recCode = `REC${idx + 1}-DEMO-USER-CODE-SAFE`;
      runStatement(db, `
        INSERT INTO users (
          id, full_name, email, password_hash, password_salt,
          recovery_hash, recovery_salt, role, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'user', ?, ?);
      `, [id, u.name, u.email, userHash, salt, userHash, salt, createdAt, createdAt]);
    }
  }
}

export async function getVideosDatabase() {
  if (videosDbInstance) return videosDbInstance;
  const sql = await initSqlEngine();

  // 1. Check IndexedDB
  const bytes = await getSqliteBytes('videos.db');
  if (bytes && bytes.length > 0) {
    videosDbInstance = new sql.Database(new Uint8Array(bytes));
    videosDbInstance.run('PRAGMA foreign_keys = ON;');
    return videosDbInstance;
  }

  // 2. Try fetch seed database/videos.db
  try {
    const res = await fetch('database/videos.db');
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 0) {
        videosDbInstance = new sql.Database(new Uint8Array(buf));
        videosDbInstance.run('PRAGMA foreign_keys = ON;');
        await saveSqliteBytes('videos.db', videosDbInstance.export());
        return videosDbInstance;
      }
    }
  } catch (err) {
    console.warn('Could not fetch seed database/videos.db, fallback to client-side seed', err);
  }

  // 3. Fallback: create schema and seed client-side
  videosDbInstance = new sql.Database();
  videosDbInstance.run(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 120),
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
      source_type TEXT NOT NULL CHECK (source_type IN ('local', 'url')),
      video_url TEXT,
      video_asset_id TEXT,
      thumbnail_url TEXT,
      thumbnail_asset_id TEXT,
      duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
      is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        (source_type = 'local' AND video_asset_id IS NOT NULL AND video_url IS NULL)
        OR
        (source_type = 'url' AND video_url IS NOT NULL AND video_asset_id IS NULL)
      )
    );

    CREATE TABLE IF NOT EXISTS video_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS video_category_map (
      video_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      PRIMARY KEY (video_id, category_id),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES video_categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS video_daily_views (
      video_id TEXT NOT NULL,
      view_date TEXT NOT NULL CHECK (length(view_date) = 10),
      view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
      PRIMARY KEY (video_id, view_date),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_videos_title ON videos(title);
    CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
    CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at);
    CREATE INDEX IF NOT EXISTS idx_video_map_category ON video_category_map(category_id);
    CREATE INDEX IF NOT EXISTS idx_views_date ON video_daily_views(view_date);
    PRAGMA user_version = 1;
  `);

  // Client-side seed logic if fallback was needed
  const categories = [
    { slug: 'tutorials', name: 'Hướng dẫn' },
    { slug: 'reviews', name: 'Đánh giá' },
    { slug: 'marketing', name: 'Marketing' },
    { slug: 'events', name: 'Sự kiện' },
    { slug: 'entertainment', name: 'Giải trí' },
    { slug: 'others', name: 'Khác' }
  ];

  const now = new Date().toISOString();
  const catMap = {};

  for (const c of categories) {
    const cid = crypto.randomUUID();
    catMap[c.slug] = cid;
    videosDbInstance.run('INSERT INTO video_categories (id, name, slug, created_at) VALUES (?, ?, ?, ?);', [cid, c.name, c.slug, now]);
  }

  // 15 Videos seed
  const seedVideos = [
    { title: 'Hướng dẫn tạo video giới thiệu sản phẩm', slug: 'tutorials', status: 'published', desc: 'Quy trình sản xuất video giới thiệu tính năng sản phẩm một cách chuyên nghiệp.' },
    { title: 'Quy trình quay video bằng điện thoại', slug: 'tutorials', status: 'published', desc: 'Các bước chuẩn bị, cài đặt thông số và góc máy khi quay video trên smartphone.' },
    { title: 'Mẹo thiết kế thumbnail hấp dẫn', slug: 'marketing', status: 'published', desc: 'Cách phối màu, chọn phông chữ và bố cục để tăng tỷ lệ click (CTR) cho video.' },
    { title: 'Video review sản phẩm mẫu A', slug: 'reviews', status: 'published', desc: 'Trải nghiệm thực tế, đánh giá ưu nhược điểm của dòng sản phẩm công nghệ phiên bản A.' },
    { title: 'Video review sản phẩm mẫu B', slug: 'reviews', status: 'published', desc: 'So sánh chi tiết thông số, thời lượng pin và hiệu năng của phiên bản B.' },
    { title: 'Tổng hợp sự kiện mùa hè', slug: 'events', status: 'published', desc: 'Những khoảnh khắc đáng nhớ nhất trong chuỗi hoạt động team building và workshop mùa hè.' },
    { title: 'Kịch bản video quảng cáo 30 giây', slug: 'marketing', status: 'published', desc: 'Cấu trúc kịch bản Hook - Story - Offer chuẩn chỉnh dành cho video ngắn.' },
    { title: 'Hướng dẫn ánh sáng khi quay video', slug: 'tutorials', status: 'published', desc: 'Thiết lập mô hình chiếu sáng 3 điểm (Key, Fill, Back light) với chi phí tiết kiệm.' },
    { title: 'Hậu trường sản xuất nội dung', slug: 'entertainment', status: 'published', desc: 'Hậu trường vui nhộn và các cảnh quay hỏng đằng sau chuỗi video viral.' },
    { title: 'Tổng kết hoạt động tháng', slug: 'events', status: 'published', desc: 'Báo cáo tổng kết các chỉ số truyền thông và dự án trọng điểm trong tháng vừa qua.' },
    { title: 'Cách thu âm giọng nói rõ ràng', slug: 'tutorials', status: 'published', desc: 'Kỹ thuật xử lý âm thanh, lọc tạp âm và chọn microphone phù hợp phòng thu tại nhà.' },
    { title: 'Video giới thiệu website', slug: 'marketing', status: 'published', desc: 'Giới thiệu giao diện mới và các tính năng tương tác nổi bật trên website chính thức.' },
    { title: 'Phỏng vấn khách mời', slug: 'entertainment', status: 'draft', desc: 'Buổi trò chuyện thân mật về hành trình sáng tạo nội dung số cùng khách mời đặc biệt.' },
    { title: 'Bản dựng video thử nghiệm', slug: 'others', status: 'draft', desc: 'Bản cut nháp thử nghiệm hiệu ứng chuyển cảnh và phân màu (Color Grading).' },
    { title: 'Nội dung đã lưu trữ', slug: 'others', status: 'archived', desc: 'Các tư liệu truyền thông cũ đã hoàn thành chiến dịch và được đưa vào lưu trữ.' }
  ];

  const today = new Date();
  seedVideos.forEach((v, index) => {
    const vid = crypto.randomUUID();
    const vUrl = 'assets/demo/demo-video.webm';
    const createdAt = new Date(today.getTime() - (seedVideos.length - index) * 86400000 * 2).toISOString();

    videosDbInstance.run(`
      INSERT INTO videos (
        id, title, description, status, source_type, video_url,
        video_asset_id, thumbnail_url, thumbnail_asset_id, duration_seconds,
        is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'url', ?, NULL, NULL, NULL, 60, 1, ?, ?);
    `, [vid, v.title, v.desc, v.status, vUrl, createdAt, createdAt]);

    if (catMap[v.slug]) {
      videosDbInstance.run('INSERT INTO video_category_map (video_id, category_id) VALUES (?, ?);', [vid, catMap[v.slug]]);
    }

    // Daily views
    for (let d = 364; d >= 0; d--) {
      const dDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - d);
      const yyyy = dDate.getFullYear();
      const mm = String(dDate.getMonth() + 1).padStart(2, '0');
      const dd = String(dDate.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const i = index + 1;
      const base = Math.max(0, 34 - 2 * i);
      const weekdayBoost = (dDate.getDay() === 0 || dDate.getDay() === 6) ? 7 : 0;
      const wave = (d * 7 + i * 11) % 13;
      const views = Math.max(0, base + weekdayBoost + wave - 5);

      if (views > 0) {
        videosDbInstance.run(
          'INSERT INTO video_daily_views (video_id, view_date, view_count) VALUES (?, ?, ?);',
          [vid, dateStr, views]
        );
      }
    }
  });

  await saveSqliteBytes('videos.db', videosDbInstance.export());
  return videosDbInstance;
}

/**
 * Execute a parameterized SELECT query and return an array of objects.
 */
export function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    return results;
  } finally {
    stmt.free();
  }
}

/**
 * Execute a parameterized SELECT query expecting a single row.
 */
export function queryOne(db, sql, params = []) {
  const results = queryAll(db, sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Execute an INSERT/UPDATE/DELETE statement with params.
 */
export function runStatement(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    stmt.step();
  } finally {
    stmt.free();
  }
}
