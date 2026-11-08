# 03 — SQLITE DATABASE DESIGN & QUERIES

## 1. Quy ước

- Có **2 file SQLite riêng**: `users.db`, `videos.db`.
- `video_categories` và `video_category_map` là **tables thuộc `videos.db`**, không phải file `.db` thứ ba. Đây là lựa chọn đơn giản hơn, cho phép foreign keys và JOIN category/video trong cùng DB.
- DB version đầu tiên: `PRAGMA user_version = 1;`.
- ID tạo bằng `crypto.randomUUID()` phía JavaScript, là `TEXT` PK trong SQLite.
- Timestamp lưu dạng ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`); view_date (`YYYY-MM-DD`) theo ngày máy cục bộ.
- Sau mỗi lần mở kết nối: `PRAGMA foreign_keys = ON;`.
- Đừng lưu video binary vào SQLite; lưu trong IndexedDB Blob store `mediaAssets`.
- Không xây database riêng cho analytic vì `video_daily_views` đủ cho MVP.

## 2. DDL — `users.db`

```sql
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 100),
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  recovery_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
PRAGMA user_version = 1;
COMMIT;
```

**Ghi chú:** `password_hash`, `password_salt`, `recovery_hash`, `recovery_salt` nên lưu dạng Base64 của bytes để dễ bảo quản. Không lưu recovery code thuần văn bản trong DB, không log mã này ra console. Không chèn user/password mặc định vào seed.

## 3. DDL — `videos.db`

```sql
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

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
COMMIT;
```

**Local assets:** `video_asset_id` và `thumbnail_asset_id` trỏ đến key string của Blob trong IndexedDB, không phải foreign key SQLite. `source_type='url'` có `video_url` HTTP(S) trực tiếp, không tính storage. Video URL có thể dùng thumbnail Blob. Có thể dùng placeholder khi `thumbnail_url` và `thumbnail_asset_id` đều NULL.

## 4. SQL query quan trọng

### 4.1 Tổng số video

```sql
SELECT COUNT(*) AS total_videos FROM videos;
```

### 4.2 Tổng lượt xem

```sql
SELECT COALESCE(SUM(view_count), 0) AS total_views
FROM video_daily_views;
```

### 4.3 Top 10 videos (bao gồm video 0 view)

```sql
SELECT v.id, v.title,
       COALESCE(SUM(d.view_count), 0) AS views
FROM videos v
LEFT JOIN video_daily_views d ON d.video_id = v.id
GROUP BY v.id, v.title
ORDER BY views DESC, v.title ASC, v.id ASC
LIMIT 10;
```

### 4.4 Line chart theo ngày (JS tự lấp ngày = 0)

```sql
SELECT view_date, SUM(view_count) AS views
FROM video_daily_views
WHERE view_date BETWEEN ? AND ?
GROUP BY view_date
ORDER BY view_date ASC;
```

- Truyền ngày bắt đầu/ngày kết thúc dưới dạng `YYYY-MM-DD` bằng prepared binding.
- Tạo đủ 30 mốc ngày trong JS theo local date; join với kết quả query, mặc định 0.

### 4.5 Line chart theo tháng (JS tự lấp tháng = 0)

```sql
SELECT substr(view_date, 1, 7) AS view_month,
       SUM(view_count) AS views
FROM video_daily_views
WHERE view_date BETWEEN ? AND ?
GROUP BY substr(view_date, 1, 7)
ORDER BY view_month ASC;
```

- 12 tháng gần nhất kể cả tháng hiện tại. `view_date` là `YYYY-MM-DD`, nhóm bằng `YYYY-MM`.

### 4.6 Bảng video + lượt xem

```sql
SELECT v.id, v.title, v.status, v.source_type,
       v.thumbnail_url, v.thumbnail_asset_id,
       v.created_at, v.updated_at,
       COALESCE(SUM(d.view_count), 0) AS views
FROM videos v
LEFT JOIN video_daily_views d ON d.video_id = v.id
GROUP BY v.id
ORDER BY v.created_at DESC, v.id ASC
LIMIT ? OFFSET ?;
```

Để **search/category/status/sort/pagination**, xây dựng SQL bằng whitelist cho cột sort/direction (không bind tên cột, mà chọn từ whitelist), và bind giá trị search bằng prepared statement. Tạo query `COUNT(DISTINCT v.id)` riêng cho tổng kết quả sau filter. Đừng join category vào query rồi làm nhân view qua many-to-many: dùng `EXISTS` để lọc category, ví dụ:

```sql
SELECT v.id, v.title, COALESCE(SUM(d.view_count), 0) AS views
FROM videos v
LEFT JOIN video_daily_views d ON d.video_id = v.id
WHERE (? = '' OR lower(v.title) LIKE '%' || lower(?) || '%')
  AND (? = '' OR v.status = ?)
  AND (? = '' OR EXISTS (
    SELECT 1 FROM video_category_map m
    WHERE m.video_id = v.id AND m.category_id = ?
  ))
GROUP BY v.id
ORDER BY views DESC, v.title ASC
LIMIT ? OFFSET ?;
```

### 4.7 Tăng 1 view khi video bắt đầu phát

```sql
INSERT INTO video_daily_views(video_id, view_date, view_count)
VALUES (?, ?, 1)
ON CONFLICT(video_id, view_date)
DO UPDATE SET view_count = view_count + 1;
```

- Chỉ chạy 1 lần cho mỗi lần mở preview **khi nhận `playing` event đầu tiên thành công**; không cộng tiếp khi pause/resume trong cùng modal.
- Dữ liệu này **chỉ đo local preview**, không phải lượt xem từ ngoài website.

### 4.8 Xóa video

```sql
DELETE FROM videos WHERE id = ?;
```

Khi `foreign_keys=ON`, category map và view records xóa cascade. Sau khi SQL persist mới cleanup Blob/thumbnail nếu không còn video nào sử dụng cùng `asset_id` (tránh xóa file dùng chung).

## 5. Storage KPI — không tính bằng SQL thuần

Asset bytes được lưu trong **IndexedDB `mediaAssets`**, không phải trong SQLite. Khi tính storage:

1. Đọc danh sách `video_asset_id`/`thumbnail_asset_id` khác NULL từ bảng `videos`.
2. Dedupe bằng `Set`.
3. Tra `mediaAssets` tương ứng trong IndexedDB, cộng `sizeBytes` từ Blob thực tế.
4. Nếu asset missing, hiển thị cảnh báo + nút sửa dữ liệu/hủy tham chiếu (không dựng số giả).
5. Định dạng base 1024 (MiB/GiB) hoặc ghi rõ nếu hiển thị MB/GB theo base 1000; nhất quán xuyên app.

**Không dùng `navigator.storage.estimate().usage` làm KPI media** vì con số gồm nhiều thành phần lưu trữ của origin và chỉ là ước tính.

## 6. Quan hệ dữ liệu

```text
users.db
└── users

videos.db
├── videos
│   ├── 1--N video_daily_views
│   └── 1--N video_category_map N--1 video_categories
└── video_categories

IndexedDB
├── sqliteFiles: "users.db", "videos.db" (SQLite bytes)
└── mediaAssets: key -> Blob (file video/thumbnail)
```

## 7. Kỹ thuật cần lưu ý

- Dùng `db.prepare(sql).bind([...])`/`getAsObject()` hoặc API tương đương, `free()` sau dùng.
- SQL injection: không nối raw user input vào query. `ORDER BY` whitelist.
- Đóng/commit transaction SQLite trước persist và xử lý rollback khi lỗi.
- `PRAGMA foreign_keys` cần bật mỗi lần mở DB, không chỉ lúc tạo schema.
- Tạo migration version `PRAGMA user_version` khi thay schema; không chạy seed khi đã có DB.
- Từ HTML có thể render `v.id` viết tắt, click/copy ID đầy đủ.
