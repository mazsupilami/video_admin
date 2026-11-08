# 02 — TECHNICAL ARCHITECTURE

## 1. Công nghệ chính

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| UI | HTML5, CSS3, Vanilla JS | Trang HTML riêng, JS ES modules |
| Chart | Canvas 2D API hoặc SVG | Không bắt buộc chart framework |
| SQLite Engine | `sql.js` + `sql-wasm.wasm` | Chạy SQLite trong RAM browser |
| SQLite persistence | IndexedDB store `sqliteFiles` | Lưu `Uint8Array` sau `db.export()` |
| Video/Thumbnail file | IndexedDB store `mediaAssets` | Lưu Blob với khóa duy nhất |
| Crypto | Web Crypto API | PBKDF2, salt random; chỉ là auth demo |
| Session | sessionStorage | Auth guard UI, không phải security boundary |
| Local dev | Live Server/HTTP static server | Không có API/backend |

### Lưu ý quan trọng

Browser không thể `UPDATE database/videos.db` trực tiếp. Bản gốc trong thư mục dự án được tải lần đầu như seed nếu có; các thay đổi chỉ nằm trong bản SQLite bytes cất tại IndexedDB. Người dùng phải **Export .db** để tải bản cập nhật xuống thiết bị. SQLite WASM là DB in-memory, cần `db.export()` sau mutation. Nguồn: https://sql.js.org/.

## 2. Folder structure được đề xuất

```text
video-admin/
├── index.html                         # chuyển hướng phù hợp theo session
├── dashboard.html
├── videos.html
├── login.html
├── register.html
├── forgot-password.html
├── README.md
├── css/
│   ├── tokens.css
│   ├── reset.css
│   ├── layout.css
│   ├── components.css
│   ├── auth.css
│   └── responsive.css
├── js/
│   ├── core/
│   │   ├── app-init.js
│   │   ├── router-guard.js
│   │   ├── ui-utils.js
│   │   ├── formatters.js
│   │   └── validators.js
│   ├── db/
│   │   ├── sqlite-engine.js          # khởi tạo Sql.js, mở/seed DB
│   │   ├── indexeddb-store.js        # sqliteFiles, mediaAssets
│   │   ├── persistence.js            # save, export, restore handling
│   │   ├── users-repository.js
│   │   ├── videos-repository.js
│   │   └── analytics-repository.js
│   ├── auth/
│   │   ├── crypto.js
│   │   ├── auth-service.js
│   │   └── auth-pages.js
│   ├── charts/
│   │   ├── top-videos-chart.js
│   │   └── trend-chart.js
│   └── pages/
│       ├── dashboard-page.js
│       └── videos-page.js
├── vendor/
│   ├── sql-wasm.js
│   └── sql-wasm.wasm
├── assets/
│   ├── icons/
│   └── images/                       # SVG placeholder nhỏ nhẹ
└── database/
    ├── users.db                       # seed/backup SQLite hợp lệ
    └── videos.db                      # seed/backup SQLite hợp lệ
```

Nếu chưa có binary `.db` lúc code generation: tạo chúng bằng `new SQL.Database()`, chạy DDL trong `03_DATABASE_DESIGN.md`, cho phép export về file; đặt file xuất vào `database/` làm seed khi cần. **Đừng tạo file rỗng rồi gọi là SQLite DB hợp lệ.**

## 3. Data flow

```text
[Page HTML / user action]
           |
           v
[Page controller / services]
           |
           v
[Repository SQL queries + SQLite in memory (sql.js)]
           |
           | db.export() sau WRITE
           v
[IndexedDB: sqliteFiles: users.db / videos.db]

File upload -> validate -> [IndexedDB: mediaAssets: Blob]
                                           |
                                           v
                              Video metadata ở videos.db

Read dashboard -> aggregate query từ videos.db -> KPI + Canvas charts
```

## 4. Khởi tạo từng database (đúng thứ tự)

1. Khởi tạo `sql.js` và load `sql-wasm.wasm` từ local `vendor/`.
2. Mở IndexedDB `videoAdminLocal`, version 1, object stores:
   - `sqliteFiles` (keyPath `name`, record `{name, bytes, updatedAt}`)
   - `mediaAssets` (keyPath `id`, record `{id, blob, fileName, mimeType, sizeBytes, createdAt}`)
3. Với từng `users.db` và `videos.db`:
   - Nếu có bytes trong IndexedDB: `new SQL.Database(new Uint8Array(bytes))`.
   - Nếu chưa có: thử `fetch('/database/<file>.db')` từ static origin nếu có và hợp lệ; nếu không có, tạo `new SQL.Database()` rồi chạy schema SQL.
   - Bật `PRAGMA foreign_keys = ON` trên connection (đặc biệt videos.db).
   - Quản lý `PRAGMA user_version` để migrate về sau.
   - Nếu DB mới, seed **chỉ** videos.db, không seed password mặc định.
   - Export và lưu vào `sqliteFiles` ngay sau khởi tạo.
4. Khi app sẵn sàng: render UI; nếu chưa có users thì dẫn tới Register.
5. Khi mở lại app: ưu tiên IndexedDB, không ghi đè bằng seed file.

### Mã minh họa (chỉ là pseudocode cho agent triển khai)

```js
// vendor/sql-wasm.js cung cấp global initSqlJs; cần load script trước module.
const SQL = await initSqlJs({ locateFile: f => `/vendor/${f}` });
const previousBytes = await getSqliteBytesFromIndexedDB('videos.db');
const db = previousBytes
  ? new SQL.Database(new Uint8Array(previousBytes))
  : new SQL.Database();

db.run('PRAGMA foreign_keys = ON;');
// Nếu DB mới: db.run(SCHEMA_VIDEOS_SQL); db.run(SEED_SQL);
// Sau mutation thành công:
await saveSqliteBytesToIndexedDB('videos.db', db.export());
```

## 5. Consistency cho SQLite và media Blob

SQLite và IndexedDB có cơ chế transaction khác nhau, vì thế:

- Khi upload: validate file → tạo media key → ghi Blob vào IDB → insert SQLite → export SQL DB sang IDB. Nếu lỗi ở bước insert/export, xóa asset vừa tạo (best-effort) và thông báo thất bại.
- Khi edit đổi file: ghi file mới → update SQL DB → persist → xóa file cũ. Nếu thất bại, xóa file mới.
- Khi delete: xóa SQL record (cascade categories/views) → persist SQLite → xóa media Blob không còn tham chiếu. Nếu xóa Blob thất bại, đánh dấu cleanup orphan ở lần init sau.
- Nếu ghi SQLite thành công trong RAM nhưng persist IndexedDB thất bại, **phải phục hồi SQLite in-memory từ snapshot bytes trước mutation** (hoặc một cơ chế rollback tương đương). Không để thay đổi chưa được lưu len lỏi vào lần save kế tiếp.
- Tránh race condition: serialization/queue mọi database write; sau `await persist`, mới báo `Đã lưu` hoặc chuyển trang.
- Không `db.export()` khi statement chưa finalized hoặc transaction SQL chưa commit; đóng statement `free()`.
- Có hàm dọn `orphan assets` và kiểm tra media key không tồn tại.

## 6. Storage và quota

- `mediaAssets` chứa file video (Blob) và thumbnail thực tế; `users.db`/`videos.db` chứa metadata.
- KPI Storage = tổng dung lượng Blob còn được các video hiện tại tham chiếu. Không tính URL video ngoài website.
- Có thể hiển thị dòng phụ `Bộ nhớ trình duyệt đang dùng (ước tính)` lấy `navigator.storage.estimate()` nhưng không thay KPI chính, vì API chỉ ước tính toàn bộ origin.
- Bắt `QuotaExceededError`, cảnh báo và không giữ dữ liệu ở trạng thái nửa thành công.
- Thử `navigator.storage.persist()` trên tương tác người dùng nếu phù hợp; không hứa browser luôn chấp thuận.
- Trình duyệt/profile khác, private mode, đổi port/host hoặc clear site data có thể làm mất/không thấy dữ liệu cũ.

## 7. Auth/data separation

- `users.db` giữ user + password hash + recovery hash.
- `videos.db` giữ video, category, tổng hợp views.
- **Không JOIN SQL giữa hai file** ở MVP; các service độc lập.
- Mọi user đã đăng ký trên **cùng origin** cùng nhìn thấy `videos.db`; không phải hệ thống phân quyền thực sự.

## 8. Dev / deployment

- Dùng VS Code Live Server hoặc static HTTP host; `file://` không được hỗ trợ.
- Web Crypto cần secure context; `localhost` được trình duyệt xem như trustworthy; production web tĩnh dùng HTTPS.
- Chỉ dùng assets JS/CSS/WASM tĩnh, không có endpoint server.
- Mọi chức năng chỉ vận hành trong origin browser riêng; đăng trên GitHub Pages vẫn là mỗi người có **bản dữ liệu cục bộ của riêng mình**, không phải database chung.
