# VIDEO ADMIN — HỆ THỐNG QUẢN TRỊ VIDEO (NO-BACKEND)

Dự án **Video Management Admin** được xây dựng hoàn toàn bằng **Vanilla HTML5, CSS3, JavaScript (ES Modules)** và **SQLite WebAssembly (`sql.js`)** chạy trực tiếp trong trình duyệt người dùng.

> ⚠️ **LƯU Ý QUAN TRỌNG:**  
> Đây là ứng dụng **No-Backend / Local Demo**. Toàn bộ cơ sở dữ liệu (`users.db`, `videos.db`) và các tệp video/ảnh tải lên được lưu cục bộ trong trình duyệt qua **IndexedDB**. Ứng dụng không kết nối bất kỳ server backend, cloud API hay dịch vụ auth bên ngoài nào.

---

## 1. Cấu trúc thư mục mã nguồn

```text
admin_video/
├── index.html                  # Router thông minh kiểm tra session và chuyển hướng
├── dashboard.html              # Bảng điều khiển KPI và biểu đồ Canvas 2D
├── videos.html                 # Quản lý CRUD video, tìm kiếm, lọc, phân trang, xem trước
├── permissions.html            # Module Phân Quyền: Danh sách tài khoản, thống kê vai trò và chỉnh sửa role (ADMIN/USER)
├── login.html                  # Đăng nhập tài khoản demo local
├── register.html               # Đăng ký tài khoản và cấp Recovery Code một lần
├── forgot-password.html        # Khôi phục mật khẩu qua email với Supabase Auth
├── reset-password.html         # Đặt lại mật khẩu mới từ liên kết email Supabase Auth
├── README.md                   # Tài liệu hướng dẫn dự án
├── css/
│   ├── tokens.css              # Hệ màu sắc, spacing, typography, shadows light mode
│   ├── reset.css               # Reset và chuẩn hóa baseline
│   ├── layout.css              # Khung giao diện admin: sidebar, header, navigation
│   ├── components.css          # Nút bấm, bảng, card KPI, modal, toast, pagination
│   ├── auth.css                # Giao diện các trang xác thực
│   └── responsive.css          # Responsive cho mobile (<768px), tablet (768-1023px), desktop
├── js/
│   ├── core/
│   │   ├── app-init.js         # Khởi tạo shell giao diện, user menu, active link
│   │   ├── router-guard.js     # Kiểm tra demo session trong sessionStorage
│   │   ├── formatters.js       # Định dạng số vi-VN, ngày dd/MM/yyyy, dung lượng B/KB/MB/GB
│   │   ├── validators.js       # Kiểm tra hợp lệ email, mật khẩu, video, URL, tệp tải lên
│   │   └── ui-utils.js         # Toast thông báo, Modal focus trap, debounce, copy clipboard
│   ├── db/
│   │   ├── indexeddb-store.js  # Lưu trữ SQLite bytes và media Blobs trong IndexedDB
│   │   ├── sqlite-engine.js    # Khởi tạo sql.js WebAssembly, load DB, PRAGMA foreign_keys
│   │   ├── persistence.js      # Ghi đĩa nguyên tử, rollback khi lỗi, tải xuất file .db
│   │   ├── users-repository.js # Truy vấn và cập nhật bảng users
│   │   ├── videos-repository.js# CRUD video, liên kết danh mục, tăng lượt xem
│   │   └── analytics-repository.js # Tính toán KPI, Top 10, xu hướng ngày/tháng
│   ├── auth/
│   │   ├── crypto.js           # Băm mật khẩu PBKDF2 (SHA-256) + salt ngẫu nhiên
│   │   ├── auth-service.js     # Nghiệp vụ đăng ký, đăng nhập, xoay vòng mã khôi phục
│   │   └── auth-pages.js       # Controller xử lý form cho các trang auth
│   ├── charts/
│   │   ├── top-videos-chart.js # Biểu đồ cột dọc Top 10 video (Canvas 2D thuần)
│   │   └── trend-chart.js      # Biểu đồ đường xu hướng ngày/tháng (Canvas 2D thuần)
│   └── pages/
│       ├── dashboard-page.js   # Logic trang Dashboard
│       └── videos-page.js      # Logic trang Quản lý video
├── vendor/
│   ├── sql-wasm.js             # Thư viện nạp WebAssembly của sql.js
│   └── sql-wasm.wasm           # Binary SQLite biên dịch sang WASM (685 KB)
├── assets/
│   ├── images/
│   │   ├── placeholder-thumbnail.svg # Ảnh thumbnail mặc định tỷ lệ 16:9
│   │   └── empty-state.svg           # Hình minh họa khi danh sách trống
│   └── demo/
│       └── demo-video.webm     # Video mẫu demo định dạng WebM (CC0)
└── database/
    ├── users.db                # File SQLite khởi tạo cho người dùng
    └── videos.db               # File SQLite seed sẵn 6 danh mục, 15 video và 365 ngày lượt xem
```

---

## 2. Hướng dẫn chạy ứng dụng

Do ứng dụng sử dụng **JavaScript ES Modules** và nạp tệp WebAssembly `sql-wasm.wasm`, trình duyệt chặn các giao thức `file://` theo chính sách bảo mật CORS. **Bắt buộc phải chạy qua một static HTTP server**.

### Cách 1: Sử dụng VS Code Live Server (Khuyến nghị)
1. Mở thư mục `admin_video` trong Visual Studio Code.
2. Cài đặt tiện ích mở rộng **Live Server** (Ritwick Dey) nếu chưa có.
3. Nhấp chuột phải vào `index.html` và chọn **Open with Live Server** (hoặc bấm nút "Go Live" ở góc dưới thanh trạng thái).
4. Trình duyệt sẽ tự động mở địa chỉ `http://127.0.0.1:5500/` hoặc `http://localhost:5500/`.

### Cách 2: Sử dụng Python Static Server
Trong terminal tại thư mục dự án, chạy lệnh:
```bash
python -m http.server 8000
```
Sau đó mở trình duyệt và truy cập: `http://localhost:8000`

### Cách 3: Sử dụng Node.js (npx serve / http-server)
```bash
npx serve .
# hoặc
npx http-server -p 8000
```

---

## 3. Luồng trải nghiệm và khởi tạo dữ liệu

1. **Khởi động lần đầu:**
   - Hệ thống tự động kiểm tra `users.db`. Do chưa có tài khoản nào được tạo sẵn (theo nguyên tắc bảo mật không seed mật khẩu mặc định), bạn sẽ được chuyển hướng đến trang **Đăng ký** (`register.html`).
2. **Đăng ký tài khoản:**
   - Nhập họ tên, email, mật khẩu (tối thiểu 8 ký tự).
   - Hệ thống băm mật khẩu bằng thuật toán **PBKDF2** với salt ngẫu nhiên 16 bytes.
   - Một **Mã khôi phục (Recovery Code)** 24 ký tự sẽ được sinh ra và hiển thị trên màn hình.
   - Hãy bấm **Sao chép mã khôi phục**, tick chọn xác nhận và tiếp tục đến trang Đăng nhập.
3. **Đăng nhập và truy cập Dashboard:**
   - Đăng nhập bằng email và mật khẩu vừa tạo.
   - Bảng điều khiển `dashboard.html` hiển thị 3 chỉ số KPI chính:
     - **Tổng số video:** `15` video mẫu từ SQLite seed.
     - **Tổng lượt xem:** Tổng hợp từ bảng `video_daily_views` cho 365 ngày qua.
     - **Dung lượng storage:** Tổng số byte thực tế của các Blob trong IndexedDB (video tải lên + ảnh bìa tải lên).
   - Biểu đồ cột **Top 10 video có lượt xem cao nhất** được tính trực tiếp từ câu lệnh SQL `ORDER BY views DESC LIMIT 10`.
   - Biểu đồ đường **Xu hướng lượt xem** có thể chuyển đổi giữa `Theo ngày (30 ngày)` và `Theo tháng (12 tháng)`, tự động điền 0 cho các ngày/tháng không có lượt xem.
4. **Quản lý danh sách Video:**
   - Truy cập mục **Quản lý video** (`videos.html`).
   - Tìm kiếm video theo tiêu đề (tự động debounce 300ms, không phân biệt hoa thường).
   - Lọc theo danh mục (Hướng dẫn, Đánh giá, Marketing, Sự kiện, Giải trí, Khác) và trạng thái (Công khai, Bản nháp, Lưu trữ).
   - Sắp xếp theo: Mới nhất, Cũ nhất, Lượt xem cao nhất, Lượt xem ít nhất, Tên A-Z.
   - Phân trang 10 video/trang.
5. **Thêm / Sửa / Xóa video:**
   - **Thêm video:** Hỗ trợ nhập URL trực tiếp (MP4/WebM) hoặc tải tệp video từ máy tính (lưu dạng Blob vào IndexedDB, giới hạn demo 30 MB). Hỗ trợ tải ảnh bìa riêng.
   - **Xem trước video (Preview):** Nhấp nút phát để xem video trong modal HTML5 Player. Khi video bắt đầu phát thành công lần đầu tiên trong modal (`playing` event), hệ thống ghi nhận **tăng 1 lượt xem** cho ngày hôm nay vào `video_daily_views`. Tạm dừng/phát tiếp trong cùng modal không làm tăng trùng lượt xem.
   - **Xóa video:** Hộp thoại cảnh báo hiển thị tên video; khi xác nhận xóa, lệnh SQL cascade xóa các liên kết danh mục, lịch sử lượt xem và dọn dẹp các tệp Blob mồ côi (orphan assets) khỏi IndexedDB.
6. **Sao lưu / Xuất cơ sở dữ liệu (.db):**
   - Bấm nút **Xuất videos.db** để tải tệp binary SQLite hợp lệ về máy. Bạn có thể mở tệp này bằng bất kỳ phần mềm SQLite GUI nào (như DB Browser for SQLite, DBeaver) để kiểm chứng schema và dữ liệu.
7. **Module Phân Quyền (Permission Management):**
   - **2 vai trò chính:** `ADMIN` (Quản trị viên) và `USER` (Người dùng).
   - **Tài khoản ADMIN:** Được phép truy cập trang [permissions.html](permissions.html), xem danh sách mọi tài khoản, xem thống kê số lượng và chỉnh sửa vai trò của bất kỳ tài khoản nào (chuyển đổi qua lại giữa ADMIN và USER).
   - **Tài khoản USER:** Khi đăng nhập, liên kết "Phân quyền" trong sidebar sẽ tự động ẩn đi; nếu cố tình truy cập trực tiếp URL `permissions.html`, hệ thống sẽ chặn và chuyển hướng về `dashboard.html`.
   - **10 tài khoản USER demo được tạo sẵn:**
     - `user1@demo.com` đến `user10@demo.com`
     - Mật khẩu đăng nhập mặc định: `User@123456`
     - Có thể đăng nhập bằng các tài khoản này để kiểm chứng phân quyền hạn chế của role `USER`.
8. **Khôi phục mật khẩu qua Supabase Auth:**
   - Từ trang `login.html`, nhấp **Quên mật khẩu?** để đến `forgot-password.html`.
   - Nhập email và gửi yêu cầu -> Supabase Auth gửi liên kết đặt lại mật khẩu về hòm thư.
   - Nhấp vào liên kết trong email -> quay lại `reset-password.html` đúng origin/port.
   - Trang `reset-password.html` xác thực token/code an toàn -> hiển thị form nhập mật khẩu mới.
   - Sau khi đổi mật khẩu thành công, quay về `login.html` đăng nhập bằng mật khẩu mới. Mật khẩu cũ bị vô hiệu hóa.
   - *(Vẫn duy trì form khôi phục bằng Recovery Code offline cho các tài khoản demo local)*.

---

## 4. Kiểm chứng Persistence (Lưu trữ bền vững)

Để kiểm chứng tính bền vững của dữ liệu không bị mất sau khi tải lại trang:
1. Thêm một video mới hoặc sửa tiêu đề của một video hiện có.
2. Mở một video xem trước để tăng lượt xem.
3. Bấm phím **F5** hoặc **Ctrl + R** để tải lại trang.
4. Mọi video mới thêm, số lượt xem và biểu đồ trên Dashboard vẫn được giữ nguyên vẹn từ IndexedDB.

---

## 5. Báo cáo đánh giá theo Test Cases (08_TEST_CASES.md)

| Nhóm kiểm thử | Trạng thái | Ghi chú |
|---|---|---|
| **A. Initialization / SQLite** (DB01 - DB07) | **PASS** | Tự động nạp `users.db` và `videos.db`; kích hoạt `PRAGMA foreign_keys = ON;`; lưu trữ an toàn trong IndexedDB; xuất tệp `.db` hợp lệ. |
| **B. Authentication** (AUTH01 - AUTH11) | **PASS** | Băm mật khẩu PBKDF2 + salt; email không phân biệt hoa thường; quy trình mã khôi phục một lần và xoay vòng mã thành công; không chứa plaintext trong DB. |
| **C. Video CRUD** (VID01 - VID15) | **PASS** | Tìm kiếm, lọc danh mục/trạng thái, sắp xếp lượt xem, thêm video cục bộ / URL trực tiếp, từ chối link YouTube watch không hỗ trợ, cascade xóa và dọn blob, tăng 1 lượt xem khi play. |
| **D. Dashboard & Analytics** (KPI01 - KPI10) | **PASS** | Tính toán KPI trực tiếp từ SQLite; Top 10 và biểu đồ xu hướng 30 ngày / 12 tháng tự động điền 0; tính dung lượng Blob chuẩn xác từ IndexedDB. |
| **E. UI/UX & Robustness** (UX01 - UX09) | **PASS** | Giao diện Light mode chuẩn chỉnh, responsive mượt mà từ màn hình 375px đến 1440px; ngăn chặn XSS và SQL Injection; xử lý đóng modal bằng phím ESC. |

---

## 6. Các giới hạn của mô hình No-Backend và Hướng phát triển

1. **Phạm vi lưu trữ cục bộ:** Dữ liệu chỉ tồn tại trên trình duyệt/profile và origin (`http://localhost:...`) hiện tại. Việc chuyển đổi cổng (port), mở cửa sổ ẩn danh (Incognito/Private) hoặc xóa dữ liệu trang web (Clear site data) sẽ không thấy hoặc làm mất dữ liệu cục bộ.
2. **Bảo mật phía Client:** Vì toàn bộ mã chạy trong trình duyệt, người dùng có quyền mở Developer Tools để can thiệp bộ nhớ hoặc session. Do đó hệ thống này được định danh là **Local Demo**, không sử dụng cho dữ liệu nhạy cảm thực tế.
3. **Giới hạn dung lượng IndexedDB:** Tùy thuộc vào dung lượng trống của ổ đĩa và hạn mức (quota) của từng trình duyệt, khuyến nghị chỉ tải lên các tệp video demo dung lượng nhỏ (< 30 MB).
4. **Hướng nâng cấp Production:**
   - Xây dựng backend API thực sự (Node.js/FastAPI/Go/Spring Boot) với cơ sở dữ liệu tập trung (PostgreSQL, MySQL).
   - Lưu trữ media video trên Cloud Object Storage (Amazon S3, Google Cloud Storage, Cloudflare R2) kết hợp CDN phân phối trực tiếp.
   - Sử dụng các giải pháp xác thực bảo mật chuẩn (JWT với HTTP-only Cookie, OAuth 2.0).
