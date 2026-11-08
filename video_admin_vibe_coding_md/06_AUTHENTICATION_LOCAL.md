# 06 — AUTHENTICATION TRONG MÔ HÌNH KHÔNG BACKEND

## 1. Cảnh báo phạm vi

Website không backend **không thể triển khai bảo mật đăng nhập thực sự cho hệ thống quản trị có dữ liệu dùng chung**. Mã JavaScript, file SQLite seed và logic kiểm tra mật khẩu đều chạy trên trình duyệt mà người dùng kiểm soát. User có thể sửa dữ liệu/session qua DevTools. Vì vậy:

- Tên gọi: **Local demo authentication** — chỉ phù hợp học Vibe Coding/prototype chạy trên cùng thiết bị.
- Không dùng cho dữ liệu khách hàng, nhân sự hay media cần bảo vệ.
- Không tuyên bố `sessionStorage` là giải pháp secure authentication.
- Không gửi email reset vì không có backend/email service.
- Nếu muốn đưa admin public cho nhiều người dùng thật: cần backend/auth service hoặc kiến trúc bảo mật khác, tức phải thay đổi ràng buộc hiện tại.

## 2. Đăng ký

1. Chuẩn hóa email: `trim().toLowerCase()`; name `trim()`.
2. Validate email syntax cơ bản, password >=8 ký tự, confirm trùng.
3. `crypto.getRandomValues()` tạo salt 16 bytes riêng cho password.
4. `crypto.subtle.importKey('raw', TextEncoder.encode(password), 'PBKDF2', false, ['deriveBits'])`.
5. `deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256)`.
6. Lưu bytes Base64 của hash và salt trong users.db; không lưu password plaintext.
7. Sinh recovery code bằng CSPRNG; ví dụ 16 bytes random mã hóa base32/hex để người dùng tự lưu. Hash recovery code bằng salt riêng và PBKDF2 tương tự.
8. Insert user qua prepared SQL; persist `users.db` xuống IndexedDB.
9. Chỉ hiển thị recovery code plaintext một lần trong màn hình thành công, có Copy và checkbox `Tôi đã lưu mã khôi phục`.

**Lưu ý**: Số vòng PBKDF2 là tham số demo, có thể điều chỉnh theo hiệu năng thiết bị; không tự quảng cáo là bảo mật production.

## 3. Đăng nhập

1. Validate input, tìm user qua email unique case-insensitive.
2. Hash password nhập bằng salt đã lưu của user.
3. Compare hash (ưu tiên constant-time byte comparison trong JS nếu agent triển khai; client-only vẫn không phải boundary bảo mật).
4. Nếu đúng: `sessionStorage.setItem('videoAdminSession', JSON.stringify({ userId, issuedAt }))` và redirect.
5. Auth guard kiểm tra session có user còn tồn tại trong users.db; nếu không → logout.
6. Logout xóa session và chuyển login.
7. Không tạo cookie auth, JWT tự ký phía client, API server giả.

## 4. Forgot Password bằng Recovery Code

1. Người dùng nhập email, recovery code, password mới/confirm.
2. Lấy user record theo email; check recovery hash đã lưu.
3. Sai thì trả thông báo chung `Thông tin khôi phục không hợp lệ`.
4. Đúng: tạo salt/password hash mới, sinh recovery code mới và hash mới.
5. UPDATE user trong transaction, export/persist users.db.
6. Chỉ sau khi persist thành công mới hiển thị `Đã đổi mật khẩu` cùng recovery code mới một lần.
7. Recovery code cũ phải trở nên vô hiệu sau reset.

**Edge case:** người dùng quên cả recovery code sẽ không có cách khôi phục an toàn không cần backend. Không tự ý thêm nút “reset bất kỳ tài khoản” vào UI chính. Trong demo có thể dùng Clear Site Data để bắt đầu lại, nhưng sẽ xóa cả videos nếu storage dùng chung origin; cảnh báo thật rõ.

## 5. Các rủi ro cần hiện rõ

| Rủi ro | Biện pháp / Giới hạn |
|---|---|
| User sửa DB/session bằng DevTools | Chấp nhận trong local demo; không dùng production |
| Người khác dùng cùng trình duyệt/profile | Có thể truy cập dữ liệu local; không có cách cô lập thật |
| Xóa browser storage | Có thể mất users/videos/Blob; cần backup và cảnh báo |
| Thay đổi localhost port/host | Origin mới ⇒ không còn nhìn thấy IndexedDB cũ |
| Password bị lộ trong logs | Không log password, không log recovery code |
| Brute force offline | Không ngăn chặn được thực sự khi kẻ tấn công kiểm soát dữ liệu local |
| Forgot email | Không có gửi email thật; flow bằng recovery code |

## 6. UI copy đề xuất

- Login note: `Phiên bản demo: tài khoản và dữ liệu chỉ được lưu trên trình duyệt này.`
- Register: `Hãy lưu mã khôi phục. Đây là cách duy nhất để đặt lại mật khẩu trong bản demo không có máy chủ.`
- Forgot: `Nhập mã khôi phục đã nhận khi đăng ký. Hệ thống không gửi email.`
- Dashboard note: `Lượt xem chỉ phản ánh dữ liệu demo và những lần xem trước trên thiết bị này.`
