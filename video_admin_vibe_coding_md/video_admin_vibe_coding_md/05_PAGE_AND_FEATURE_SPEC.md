# 05 — PAGE / FEATURE SPECIFICATIONS

## 1. Navigation & auth guard

| URL | Access | Nhiệm vụ |
|---|---|---|
| `/index.html` | Public | Chuyển tới login/dashboard dựa trên session demo |
| `/login.html` | Guest | Đăng nhập demo local |
| `/register.html` | Guest | Đăng ký tài khoản local |
| `/forgot-password.html` | Guest | Reset bằng recovery code |
| `/dashboard.html` | Demo auth | KPI + charts |
| `/videos.html` | Demo auth | CRUD + preview |

- Chuyển hướng guest vào dashboard/videos → login.
- Đăng nhập thành công → dashboard.
- Đã đăng nhập vào login/register → dashboard (trừ khi logout).
- Auth guard chỉ là UX client, không phải bảo mật.
- Sidebar nav `Dashboard`, `Videos`; user menu `Tài khoản demo` và `Đăng xuất`.

## 2. Dashboard — chi tiết

### KPI cards

1. `Tổng số video` — count record.
2. `Tổng lượt xem` — aggregate daily view count.
3. `Dung lượng storage` — tổng Blob videos + thumbnail **ở trình duyệt này**, hiển thị phù hợp MB/GB.

Mỗi card có icon, tiêu đề, số thực query, một dòng phụ giải thích ngắn. Nếu không có dữ liệu: `0`, không `—` giả.

### Bar chart Top 10

- Dữ liệu từ SQL ở `03_DATABASE_DESIGN.md`.
- Bắt buộc chọn top 10 thật của data hiện tại; label title; tooltip view.
- Top 10 ít hơn 10 video thì render số hiện có.
- Sau Add/Delete/tracking view phải cập nhật khi trở lại Dashboard.
- Không lấy data từ mảng hardcoded độc lập với SQLite.

### Line chart theo ngày/tháng

- Tab/segmented control: `Theo ngày` / `Theo tháng`.
- Ngày: 30 ngày; Tháng: 12 tháng; zero-filled dates.
- Hiển thị đơn vị `Lượt xem`; format `vi-VN`.
- Không gộp dữ liệu từ các mốc date khác timezone một cách tùy ý.
- Tooltip tại điểm với thời gian và lượt xem.
- Không animation quá mức gây chậm; tôn trọng reduced motion nếu có.

## 3. Videos — list

### Table + filters

Các cột hiển thị mặc định:

| ID | Thumbnail & Title | Category | Views | Status | Actions |
|---|---|---|---:|---|---|
| ID ngắn + Copy | ảnh 16:9 + title | tags | tổng views | Draft/Published/Archived | Preview, Edit, Delete |

- Search debounced 250–350ms theo `title` (MVP), case-insensitive.
- Filter category và status; sort by created desc, views desc/asc, title A→Z.
- Pagination 10 items/trang; thay filter quay về trang 1.
- Query tổng record và query rows dùng cùng filter.
- Mở video preview không tăng view nếu file/URL không phát được.

### Add Video modal/page

Các trường:

- `Tiêu đề` (required 3–120 ký tự).
- `Mô tả` (optional, <=2000 ký tự).
- `Nguồn video`: radio `Tải file` / `URL trực tiếp`.
- Với `Tải file`: file input video/mp4, video/webm; giới hạn demo cấu hình 30 MB; hiện tên/dung lượng file, lỗi MIME.
- Với `URL`: phải là http(s) direct playable resource; kiểm tra URL syntax và hỗ trợ play, không nhận mặc định YouTube watch URL.
- `Ảnh thumbnail`: file image (jpeg/png/webp, khuyến nghị <=2MB) hoặc URL http(s), hoặc placeholder.
- `Danh mục`: multi-select từ `video_categories`, có thể chọn nhiều; required nếu Published.
- `Trạng thái`: Draft/Published/Archived.
- `Lưu` và `Hủy`.

**Sau Save**: validate → write Blob nếu local → insert SQL metadata + category mapping trong SQLite transaction → persist .db bytes → UI update/toast. Nếu fail, hiển thị lỗi, cleanup Blob mới, không reset form làm mất dữ liệu đã nhập.

### Edit Video

- Load đúng record theo ID, điền form.
- Cho phép đổi title, description, category, status, thumbnail/source.
- Nếu user không thay local video, giữ nguyên Blob id.
- Nếu đổi local→URL, cập nhật source_type/video_url và cleanup Blob cũ khi commit thành công.
- Có trạng thái dirty; confirm khi cancel với dữ liệu chưa lưu.

### Delete Video

- Bấm Delete → dialog xác nhận `Xóa “{title}”? Video, lượt xem thống kê và file đã lưu trên trình duyệt sẽ bị xóa.`
- `Hủy` → không thay đổi dữ liệu.
- `Xóa video` → SQL DELETE (cascade) → persist → cleanup assets không còn tham chiếu → refresh table/KPI.
- Nếu user delete hàng cuối trang, tự điều chỉnh về trang trước hợp lệ.

### Preview Video

- Với source_type local: load Blob qua `URL.createObjectURL()` và revoke khi close.
- Với source_type url: đặt URL vào `<video src>`; không dùng iframe tùy ý; kiểm tra failed load và timeout UI phù hợp.
- Khi video phát thành công, xử lý `playing` lần đầu của mỗi lần mở preview → SQL increment view của hôm nay → persist.
- Pause/play lặp trong cùng modal **không** tăng nhiều view. Mở lại preview và phát sẽ tính lượt mới (chỉ tại browser này).
- Thông báo `Lượt xem là dữ liệu demo/local, không phải lượt xem công khai` tại khu Analytics/README.

## 4. Login

- Full page auth layout; email, password, submit.
- Validation email + password không rỗng; không cho submit lặp.
- Lookup user by email normalized; hash password với salt của user bằng Web Crypto, so sánh bytes.
- Sai thông tin: một thông báo chung `Email hoặc mật khẩu chưa chính xác` để hạn chế tiết lộ tài khoản (dù chỉ demo).
- Khi thành công, update last_login_at + persist users.db; tạo sessionStorage demo record; redirect.
- CTA: `Chưa có tài khoản? Đăng ký`, `Quên mật khẩu?`.

## 5. Register

- Full name, email, password, confirm; validate.
- Hash PBKDF2 và tạo recovery code ngẫu nhiên, chỉ hiển thị plaintext đúng một lần.
- Kiểm tra email unique trên SQLite.
- Save users.db và hiển thị recovery code trước khi sang login.
- Không auto-login trước khi người dùng xem/đồng ý đã lưu mã khôi phục (để không mất mã).

## 6. Forgot Password

- Không yêu cầu email thật hay giả lập gửi thư.
- Form: email, recovery code, new password, confirm.
- Verify email + code hash; reset password hash/salt; rotate recovery code và hash/salt; persist users.db.
- Hiển thị recovery code mới đúng một lần, button Copy, ghi rõ mã cũ không còn hiệu lực.
- Mất recovery code = không có self-service account recovery ở MVP. Nêu rõ trước khi người dùng dùng tính năng này.

## 7. Other UI behavior

- Logout xóa `sessionStorage` app record, chuyển login.
- `Esc`/focus handling cho modal.
- Không render raw HTML từ title/description.
- Date/number format `vi-VN`, size format consistent.
- Error state: DB corrupted, browser IndexedDB blocked, WASM load fail, quota reached, asset missing, invalid video type.
- Trên footer/sidebar hiển thị `Local demo · No backend` để tránh người dùng hiểu lầm.
