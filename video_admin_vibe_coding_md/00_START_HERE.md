# VIDEO ADMIN — HƯỚNG DẪN BẮT ĐẦU / MASTER PROMPT

> Dự án: Video Management Admin (Vanilla HTML + CSS + JavaScript + SQLite, không backend)  
> Mục đích: Đưa toàn bộ thư mục Markdown này vào Antigravity hoặc công cụ Vibe Coding để AI triển khai website chạy thật trên trình duyệt.  
> Ngôn ngữ sản phẩm: Tiếng Việt. Giao diện: Light mode, nền trắng.

## 1. Mục tiêu cuối cùng

Xây dựng ứng dụng quản trị video **có tương tác và lưu dữ liệu thực trên một trình duyệt/một thiết bị**. Gồm:

1. `dashboard.html`: KPI tổng video, lượt xem, dung lượng lưu trữ; biểu đồ cột Top 10; biểu đồ đường theo ngày/tháng.
2. `videos.html`: bảng danh sách có ID, thumbnail, title, views, actions Edit/Delete; có Add, Search, Filter, Pagination, Preview.
3. `login.html`: đăng nhập tài khoản demo lưu cục bộ.
4. `register.html`: đăng ký tài khoản mới.
5. `forgot-password.html`: khôi phục mật khẩu **bằng recovery code cục bộ**, không giả lập tính năng gửi email.
6. Hai cơ sở dữ liệu SQLite **`users.db`** và **`videos.db`**; categories là bảng bên trong `videos.db`, không tạo file DB thứ ba nếu chưa có lý do kỹ thuật.

**Cấm backend**: không Node/Express, PHP, Python/Flask, Firebase, Supabase, REST API server, dịch vụ auth, database trên cloud. Có thể dùng một **static HTTP server chỉ để mở file HTML/JS/WASM trong quá trình phát triển** (VS Code Live Server hoặc `python -m http.server`); static server không xử lý nghiệp vụ và không phải backend của ứng dụng.

## 2. Quyết định kỹ thuật không được bỏ qua

Một website HTML/CSS/JS thuần không thể cập nhật trực tiếp file `.db` trên ổ đĩa máy người dùng hoặc chạy SQLite native trong browser. Dùng:

- `sql.js` (SQLite biên dịch thành WebAssembly): đọc, tạo và truy vấn SQLite ngay trong trình duyệt.
- `IndexedDB`: lưu **bản xuất (`db.export()`)** của `users.db` và `videos.db` sau mỗi thay đổi; lưu `Blob` video/thumbnail cục bộ trong object store riêng.
- Web Crypto API: PBKDF2 + salt ngẫu nhiên cho password và recovery code.
- `sessionStorage`: session demo phía client. **Không coi đây là bảo mật thật.**
- Vanilla JavaScript ES modules; HTML/CSS thuần; biểu đồ tự vẽ bằng Canvas/SVG hoặc Chart.js thuần JS chạy client (ưu tiên Canvas/SVG để ít dependency).
- Không sử dụng React, Vue, Angular, Next.js, server, bundler bắt buộc hoặc backend API.

**Phạm vi dữ liệu**: dữ liệu chỉ hiện trên trình duyệt/profile và origin (`http://localhost:...`) đang sử dụng. Không tự đồng bộ giữa thiết bị, không thể bảo vệ tài khoản trước người có quyền mở Developer Tools. SQLite nằm trong IndexedDB; hai file `.db` trong dự án chỉ là bản seed/backup, không phải DB server đang được ghi trực tiếp.

## 3. MASTER PROMPT — dán nguyên phần sau vào Antigravity

```text
Bạn là Senior Frontend Engineer, UI/UX Designer và SQLite Data Architect.

NHIỆM VỤ: Code một website Video Admin hoàn chỉnh, chỉ dùng HTML, CSS, vanilla JavaScript và SQLite chạy trong browser nhờ sql.js WebAssembly. KHÔNG được tạo backend dưới bất kỳ hình thức nào.

Hãy đọc toàn bộ các tài liệu:
- AGENTS.md
- 01_PRODUCT_REQUIREMENTS.md
- 02_TECHNICAL_ARCHITECTURE.md
- 03_DATABASE_DESIGN.md
- 04_UI_UX_DESIGN.md
- 05_PAGE_AND_FEATURE_SPEC.md
- 06_AUTHENTICATION_LOCAL.md
- 07_IMPLEMENTATION_TASKS.md
- 08_TEST_CASES.md
- 09_SEED_DATA.md

Yêu cầu:
1. Tạo mã nguồn thật, có thể chạy qua VS Code Live Server/HTTP static server, không chỉ mockup.
2. Tạo đủ dashboard, videos, login, register, forgot-password. Form và nút đều phải hoạt động.
3. Dùng sql.js WebAssembly và IndexedDB để SQLite users.db/videos.db có persistence qua reload.
4. Tạo schema, index và dữ liệu mẫu theo tài liệu; đảm bảo SQL query tính KPI/biểu đồ thật.
5. Đăng ký/đăng nhập/khôi phục mật khẩu hoạt động ở chế độ LOCAL DEMO; không có email/reset link giả.
6. Bảng Video có thêm/sửa/xóa/tìm kiếm/lọc/phân trang, modal xác nhận xóa, preview video.
7. Thống kê và hai biểu đồ thay đổi tương ứng sau khi dữ liệu thay đổi. Không hardcode KPI trong UI.
8. Thiết kế light mode chuyên nghiệp, responsive và accessibility cơ bản.
9. Có trạng thái loading/empty/error/success; tránh XSS, SQL injection, rò rỉ password.
10. Đưa hướng dẫn chạy, cách khởi tạo DB, cách kiểm thử và các giới hạn của no-backend vào README của dự án code.

TRÌNH TỰ LÀM VIỆC:
- Bước 1: Đọc tài liệu, tóm tắt kiến trúc và cấu trúc thư mục dự kiến.
- Bước 2: Tạo HTML/CSS, layout và navigation.
- Bước 3: Xây DB layer, sql.js/IndexedDB và seed data.
- Bước 4: Xây auth local và các trang auth.
- Bước 5: Xây video CRUD và upload demo cục bộ.
- Bước 6: Xây Dashboard và biểu đồ bằng dữ liệu query.
- Bước 7: Chạy ứng dụng, tự kiểm thử theo 08_TEST_CASES.md, sửa lỗi, ghi rõ tính năng chưa hoàn thiện.

KHÔNG tự ý thay yêu cầu sang backend/cloud DB. Nếu gặp hạn chế trình duyệt, triển khai giải pháp client-side hợp lý và ghi rõ hạn chế.
```

## 4. Thứ tự file hướng dẫn

| File | Đọc để làm gì |
|---|---|
| `AGENTS.md` | Quy tắc bắt buộc cho AI coding agent |
| `01_PRODUCT_REQUIREMENTS.md` | Mục tiêu, MVP, vai trò người dùng, acceptance criteria |
| `02_TECHNICAL_ARCHITECTURE.md` | Cấu trúc dự án, SQLite WASM, IndexedDB, luồng dữ liệu |
| `03_DATABASE_DESIGN.md` | DDL cho `users.db`/`videos.db`, quan hệ và query |
| `04_UI_UX_DESIGN.md` | Design system, màu, bố cục, responsive |
| `05_PAGE_AND_FEATURE_SPEC.md` | Chi tiết UI, business logic, hành vi các trang |
| `06_AUTHENTICATION_LOCAL.md` | Auth demo, hash password, recovery code và giới hạn bảo mật |
| `07_IMPLEMENTATION_TASKS.md` | Task từng giai đoạn, chuẩn hoàn thành |
| `08_TEST_CASES.md` | Test chức năng, nghiệp vụ, bảo mật, storage |
| `09_SEED_DATA.md` | Quy tắc seed và yêu cầu đồng nhất số liệu |

## 5. Chạy ứng dụng (sau khi AI sinh code)

1. Mở thư mục code bằng VS Code.
2. Tải/bundled hai file thư viện `sql-wasm.js`, `sql-wasm.wasm` từ bản phát hành `sql.js` tương thích; đặt vào `vendor/` theo tài liệu kiến trúc. Không nhúng các script không rõ nguồn gốc.
3. Mở `index.html` bằng **VS Code Live Server** hoặc dùng một static HTTP server. **Không mở bằng `file://`** vì việc tải module, WASM và `.db` dễ bị chặn.
4. Vào Register, tạo tài khoản đầu tiên và lưu recovery code; đăng nhập.
5. Kiểm tra dashboard và bảng videos; thêm/sửa/xóa một video; tải lại trang để xác nhận persistence.
6. Trong mục Settings/Backup (nếu được triển khai), dùng Export DB để tải bản sao `.db` về máy. Lưu ý video Blob không tự nằm trong file `.db`.

## 6. Tiêu chuẩn bàn giao code

Ứng dụng chỉ được coi là hoàn thành khi vượt qua checklist ở `08_TEST_CASES.md`; có dữ liệu seed với nhãn DEMO, có lỗi/empty states rõ ràng, không có nút trang trí không thực hiện chức năng, và không tuyên bố auth client-side phù hợp production.

### Tài liệu tham khảo kỹ thuật

- sql.js: https://sql.js.org/
- MDN IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- MDN Storage quota: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- MDN Web Crypto: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
