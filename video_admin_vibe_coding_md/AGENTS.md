# AGENTS.md — QUY TẮC CHO AI CODING AGENT

Bạn đang code dự án **Video Admin — No Backend**. Đây là nguồn quy tắc ở cấp dự án, ưu tiên khi tạo/sửa file code.

## Bắt buộc

- Công nghệ: HTML5, CSS3, ES6+ vanilla JavaScript, SQLite trong browser qua `sql.js` + WASM, IndexedDB để lưu SQLite bytes và Blob.
- **KHÔNG có backend** (kể cả mock API/Express/json-server/PHP/Firebase/Supabase); không biến SQL thành JSON-only data.
- Chạy được qua static HTTP server; không phụ thuộc Node runtime để phục vụ nghiệp vụ. Có thể dùng npm/chương trình hỗ trợ **chỉ trong quá trình lấy dependency**, không dùng ở runtime.
- Không dùng React/Vue/Angular hoặc đổi stack khi chưa được yêu cầu.
- Ngôn ngữ UI: tiếng Việt; mã nguồn dùng tên biến/hàm tiếng Anh rõ nghĩa.
- Light mode nền trắng, màu theo `04_UI_UX_DESIGN.md`; responsive 375/768/1440px.
- Các file DB: `users.db` và `videos.db`. Tạo bảng `video_categories` trong `videos.db`, không tách category thành `video_categories.db`.
- Mọi mutation phải ghi vào SQLite, `db.export()` rồi persist đến IndexedDB trước khi báo thành công.
- SQL phải có prepared statement/binding; dùng `textContent` thay vì `innerHTML` với input user.
- Auth chỉ là mô phỏng local, thể hiện rõ trên README và trên trang login bằng dòng cảnh báo ngắn. Không giả vờ gửi email reset password.
- Dữ liệu demo được gắn nhãn, không giả làm số liệu thật.
- Thiết kế trang auth đẹp nhưng không hy sinh validate/trạng thái lỗi.
- Có một source of truth cho query KPI, list và chart; không nhúng số liệu tĩnh trong HTML.
- Không tạo chức năng không yêu cầu làm trì hoãn MVP.

## Quy trình khi triển khai

1. Đọc `00_START_HERE.md` và tài liệu liên quan.
2. Tạo cấu trúc thư mục rõ ràng; lập `README.md` cho app code (khác với file hướng dẫn này).
3. Tạo sơ đồ hoặc ghi chú data flow trước khi xây component.
4. Hoàn thành từng vertical slice: DB init → auth → video CRUD → analytics → UI polish.
5. Mỗi giai đoạn chạy và tự test, ghi lỗi đã sửa.
6. Khi có mâu thuẫn trong yêu cầu, ưu tiên: bảo toàn dữ liệu > tính đúng nghiệp vụ > hạn chế no-backend > thẩm mỹ.

## Không được làm

- Không dùng `localStorage` để lưu password thô hay dùng localStorage thay SQLite; session demo dùng `sessionStorage`.
- Không gọi `fetch('/api/...')`/API server tùy ý.
- Không dùng Firebase Auth, OAuth hoặc email reset khi không có backend.
- Không tuyên bố có server-side security, nhiều người dùng đồng bộ, analytics lượt xem toàn Internet.
- Không hardcode số KPI, fake loading, fake Delete/Edit, fake upload hoặc biểu đồ chỉ có dữ liệu tĩnh.
- Không tải video YouTube thông qua giải pháp không được yêu cầu; chỉ URL media trực tiếp hoặc file local.

## Báo cáo bàn giao

Nêu: những file code đã tạo, cách chạy, cách kiểm chứng SQLite persistence, các test pass/fail, tính năng chưa làm, rủi ro bảo mật/dung lượng và hướng nâng cấp production khi cần.
