# 07 — IMPLEMENTATION PLAN & TASK CHECKLIST

> Hướng dẫn AI viết code theo tiến độ, không dừng lại ở một trang HTML trông đẹp nhưng không có logic.

## Phase A — Project scaffold

- [ ] Tạo HTML pages và CSS tokens/components/layout/responsive.
- [ ] Tạo reusable sidebar/header, menu trạng thái active.
- [ ] Tạo responsive desktop/tablet/mobile và các empty/loading/error patterns.
- [ ] Tải `sql-wasm.js` + `sql-wasm.wasm` phiên bản tương thích vào `vendor/` hoặc ghi rõ bước lấy từ nguồn chính thức.
- [ ] Tạo `README.md` của ứng dụng code, nêu mục đích + lệnh chạy static server.
- [ ] Không có API backend, React hoặc cloud service.

**Done:** tất cả trang mở được qua local HTTP server, không lỗi assets console.

## Phase B — Database layer

- [ ] Tạo `indexeddb-store.js`: mở IndexedDB, read/write Sqlite bytes, store/read/delete Blob.
- [ ] Tạo `sqlite-engine.js`: init sql.js, open DB từ IndexedDB hoặc seed, run schema, check version.
- [ ] Tạo SQLite repo cho users/videos/analytics; prepared SQL; `foreign_keys=ON`.
- [ ] Tạo cơ chế `persistDatabase(name)` sau mọi mutation; queue writes, xử lý lỗi quota.
- [ ] Tạo dữ liệu seed categories + videos + daily views theo `09_SEED_DATA.md` chỉ lần đầu.
- [ ] Tạo khả năng export `.db` để verify bằng SQLite GUI; note không bao gồm media Blob.

**Done:** reload vẫn có dữ liệu; SQL `COUNT`, `SUM`, Top10 và trend trả kết quả đúng.

## Phase C — Auth demo

- [ ] Xây form register + validations + email unique.
- [ ] Hash password/recovery code bằng Web Crypto PBKDF2 + salt.
- [ ] Login verify + sessionStorage + route guards + logout.
- [ ] Forgot password bằng recovery code và rotation.
- [ ] Cảnh báo local demo ở auth screens.
- [ ] Không seed tài khoản mật khẩu mặc định.

**Done:** register→login→logout→login, forgot password hoàn chỉnh sau reload.

## Phase D — Video CRUD

- [ ] Render video table từ SQLite và IndexedDB Blob.
- [ ] Add/Edit form với local file OR direct video URL, status, category, thumbnail.
- [ ] Validate input, MIME, kích thước file (demo threshold), URL.
- [ ] Insert/update SQLite + category map + persist; cleanup Blob orphan.
- [ ] Delete confirm + SQL cascade + asset cleanup.
- [ ] Search/filter/sort/pagination đủ các trạng thái.
- [ ] Preview video HTML5; register 1 view khi first `playing` mỗi modal.

**Done:** tất cả hành động có tác dụng thật, reload giữ nội dung.

## Phase E — Analytics dashboard

- [ ] Query 3 KPI từ dữ liệu hiện tại; storage từ IndexedDB assets.
- [ ] Top 10 view chart từ query, tooltip/tên video rõ ràng.
- [ ] Line chart 30 ngày / 12 tháng, zero-fill missing periods.
- [ ] Format số/ngày/dung lượng theo giao diện tiếng Việt.
- [ ] Refresh data khi quay lại dashboard sau CRUD/view event.
- [ ] Empty states cho zero data và less than 10 videos.

**Done:** xóa/preview/edit/add dẫn đến chỉ số và danh sách đúng theo định nghĩa.

## Phase F — QA & polish

- [ ] Chạy toàn bộ `08_TEST_CASES.md`, ghi PASS/FAIL.
- [ ] Kiểm tra keyboard, mobile 375px, tablet 768px, desktop 1440px.
- [ ] Sửa console errors; xử lý blank/missing thumbnails, corrupt database, quota error.
- [ ] Kiểm thử bảo mật cơ bản: XSS title, SQL injection text, password không ở plaintext.
- [ ] Hoàn thiện README: run/dependencies, demo limitations, backup/export, cảnh báo storage.
- [ ] Không gắn nhãn `production-ready`.

## Bảng tự đánh giá bàn giao

| Mốc | Bằng chứng tối thiểu |
|---|---|
| Database | Đăng ký user và lưu video qua reload |
| Auth | Sai password không login, recovery code reset được |
| CRUD | Add/Edit/Delete có SQL và Blob persist |
| Views | Preview tăng đúng 1, không tăng khi pause/resume |
| Dashboard | Sum rows = KPI/chart, chart trend zero-fill |
| UX | Có confirm, toast, empty state, responsive |
| Boundaries | README ghi rõ local demo và không có backend |

## Prompt kiểm tra sau khi agent code xong

```text
Hãy thực hiện audit tất cả tính năng đã code theo 08_TEST_CASES.md.
Đặc biệt kiểm chứng persistence sau reload, SQL aggregate Top 10/trend,
độ chính xác storage KPI, auth recovery-code flow và việc không tồn tại backend.
Báo cáo PASS/FAIL từng nhóm, sửa các lỗi phát hiện rồi kiểm thử lại.
Không chỉ mô tả code; cần chạy website và quan sát kết quả nếu công cụ hỗ trợ.
```
