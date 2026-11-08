# 04 — UI/UX DESIGN SYSTEM (LIGHT MODE)

## 1. Concept

**Style:** Minimal SaaS admin, tươi sáng, nhiều khoảng trắng, hình khối bo nhẹ, dễ quét thông tin. Không dùng dark mode. Tránh gradient, đổ bóng mạnh, icon/ảnh nặng làm rối dashboard.

### Color tokens

```css
:root {
  --bg: #f7f9fc;             /* app canvas: gần trắng */
  --surface: #ffffff;        /* panel/card trắng */
  --surface-muted: #f1f5f9;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --brand: #2563eb;
  --brand-hover: #1d4ed8;
  --brand-subtle: #eff6ff;
  --success: #16a34a;
  --warning: #d97706;
  --danger: #dc2626;
  --focus: #93c5fd;
  --radius-card: 16px;
  --radius-control: 10px;
  --shadow-card: 0 4px 24px rgba(15,23,42,0.04);
  --sidebar-width: 248px;
}
```

Nền chính của trang có thể dùng `#f7f9fc` để tạo phân lớp; **card, bảng, form có nền trắng**, đúng định hướng light mode. Nếu người dùng muốn nền trắng tuyệt đối toàn bộ, chỉ cần đổi `--bg` sang `#fff`.

## 2. Typography & spacing

- Font stack: `Inter, system-ui, -apple-system, 'Segoe UI', sans-serif`; chạy được không cần tải font ngoài.
- H1 trang: 28px / 700; tiêu đề card: 18px / 650; body: 14–15px; label: 13px.
- Spacing hệ 4/8/12/16/24/32.
- Card KPI: padding 24px; icon nhỏ trong ô màu nhẹ; số KPI khoảng 26–30px.
- Input/buttons: cao 42–44px, border 1px, focus ring rõ.
- Video thumbnail trong bảng: tỷ lệ 16:9, ví dụ 96x54px, border-radius 8px.
- Bảng: header xám nhạt, row height tối thiểu 72px, hover background rất nhẹ.

## 3. Layout admin

```text
┌──────────────────────┬──────────────────────────────────────────────────────┐
│  ▶ VideoAdmin        │  Header: Breadcrumb       Search?   User menu        │
│                      ├──────────────────────────────────────────────────────┤
│  ▦ Dashboard         │  Page title + description                             │
│  ▷ Videos            │                                                      │
│                      │  [ Total videos ] [ Total views ] [ Storage ]        │
│                      │                                                      │
│                      │  [ BAR CHART: Top 10 ]                                │
│                      │                                                      │
│                      │  [ LINE: Ngày | Tháng ]                               │
│                      │                                                      │
│  Local Demo warning  │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

- Desktop >=1024px: sidebar cố định rộng ~248px, main area linh hoạt.
- Tablet 768–1023px: sidebar thu nhỏ hoặc off-canvas có nút mở.
- Mobile <768px: off-canvas navigation; KPI card stack; chart horizontal scroll/resize hợp lý; table có horizontal overflow và vẫn đọc được title/actions.
- Sticky header chỉ khi không che nội dung/form.
- Sidebar active item nổi bằng nền `--brand-subtle`, chữ `--brand`.

## 4. Dashboard

- Top: `Dashboard` + mô tả `Tổng quan hiệu quả thư viện video`.
- Nhãn nhỏ `Dữ liệu demo — lưu trên trình duyệt này`, không có màu cảnh báo quá mạnh.
- KPI grid 3 cột desktop; mobile 1 cột.
- Chart Top 10: **biểu đồ cột dọc (vertical column chart)** đúng yêu cầu. Hiển thị 10 cột, tên video rút gọn trên trục X và tooltip đầy đủ. Trên màn hình hẹp cho chart cuộn ngang bên trong card hoặc xoay nhãn hợp lý, không làm tràn toàn trang.
- Chart trend: line chart toàn chiều ngang, toggle `Theo ngày | Theo tháng`, trục và tooltip rõ; ngày không dữ liệu = 0.
- Loading skeleton ngắn; empty chart có giải thích `Chưa có dữ liệu lượt xem`.

## 5. Video List

- H1 `Quản lý video`, bên cạnh primary CTA `+ Thêm video`.
- Toolbar: Search title, dropdown category, dropdown status, sort views/date, reset filters.
- Table columns bắt buộc: `ID`, `Video` (thumbnail + title), `Lượt xem`, `Thao tác`.
- Columns bổ sung đề xuất: `Danh mục`, `Trạng thái`, `Ngày tạo`.
- Actions `Xem trước`, `Sửa`, `Xóa` với icon + accessible label; Delete icon đỏ nhưng không dùng màu là tín hiệu duy nhất.
- Empty result: illustration SVG nhỏ + `Không tìm thấy video phù hợp` và button reset filter.
- Pagination: 10 rows/page; hiển thị `1–10 / 45 video`.

## 6. Auth screens

- Nền `#f7f9fc`, card trắng max-width ~420px, logo dạng chữ + biểu tượng play.
- Các trang `Login`, `Register`, `Forgot Password` thống nhất logo, layout, button.
- Form validation inline (không dùng alert của trình duyệt cho toàn bộ UX).
- Login: Email, password, Remember? **không thêm Remember Me persistent auth** trong MVP; Forgot Password link; CTA Register.
- Register: full name, email, password, confirm password; sau đăng ký hiển thị recovery code trong màn hình riêng có nút Copy và xác nhận đã lưu.
- Forgot: email + recovery code + password mới + confirm; sau reset hiển thị recovery code mới, buộc người dùng tự lưu.
- Mỗi trang auth có footer note `Phiên bản demo: dữ liệu chỉ lưu trên trình duyệt này.`

## 7. Interaction states

- Loading: disable submit + spinner, không cho submit lặp.
- Success: toast xanh nhạt, text `Đã lưu video` / `Đã cập nhật`.
- Errors: inline alert có cách xử lý; ví dụ `Không đủ dung lượng trình duyệt để lưu tệp`.
- Delete: modal dialog có tên video và 2 nút `Hủy` / `Xóa video`.
- Modal ESC close (trừ khi dữ liệu đang ghi), focus trap hợp lý và trả focus về nút trước đó.
- Form trước khi thoát khi dirty: confirm tránh mất công sửa.

## 8. Accessibility & performance

- Labels kết nối input, thông báo lỗi dùng `aria-describedby`; dialog có role/aria-label phù hợp.
- Tương phản chữ/nền đủ cao; focus visible; icon button có aria-label.
- Hỗ trợ navigation bằng keyboard, không chỉ mouse.
- Images `loading="lazy"`, `<img>` có `alt` thích hợp; `object-fit: cover`.
- Video preview dùng `<video controls preload="metadata">`, không autoplay có tiếng ngoài ý muốn.
- Chart có textual summary/accessible table hoặc danh sách số tương ứng, vì Canvas đơn thuần khó đọc bằng screen reader.
