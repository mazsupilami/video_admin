# 01 — PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 1. Tổng quan

**Tên dự án:** Video Admin Dashboard  
**Đối tượng:** người quản trị nội dung video (demo local, 1 trình duyệt/thiết bị)  
**Mục tiêu:** quản lý danh mục video; xem KPI, biểu đồ và đăng nhập nội bộ ở mức MVP.  
**Thiết kế:** web admin sáng, tối giản, dễ dùng, tiếng Việt.

## 2. Phạm vi MVP

| Nhóm | Chức năng | Mức độ |
|---|---|---|
| Dashboard | Tổng video, tổng view, dung lượng video local được lưu | Must |
| Dashboard | Top 10 video theo view (bar chart) | Must |
| Dashboard | Xu hướng view theo ngày/tháng (line chart) | Must |
| Videos | Danh sách ID, title, thumbnail, views, Edit/Delete | Must |
| Videos | Add, Preview, Search, Filter category/status, Sort, Pagination | Must |
| Videos | Upload file cục bộ **hoặc** URL trực tiếp tới MP4/WebM | Must |
| Auth | Register, Login, Logout | Must |
| Auth | Forgot Password qua recovery code local | Must |
| Database | users.db, videos.db, video_categories + relationship + view aggregates | Must |
| Persistence | Sau reload dữ liệu không mất (trong cùng origin và browser profile) | Must |
| Data | Demo seed 15 video và chuỗi dữ liệu xu hướng đủ xem biểu đồ | Must |
| Backup | Export riêng `.db`; giải thích media Blob không nằm trong DB | Should |
| General | Empty/loading/error states, toast, responsive | Must |
| Extra | Quản lý user role và phân quyền thực sự | Out of scope |
| Extra | Multi-user real-time / cloud sync | Out of scope |
| Extra | Video transcoding, streaming, CDN, HLS, storage server | Out of scope |
| Extra | Forgot Password qua email | Out of scope |
| Extra | Đếm view khách truy cập Internet | Out of scope |

## 3. Personas & user journeys

**Admin demo:**

1. Mở website, lần đầu chưa có user → được hướng dẫn đăng ký.
2. Đăng ký bằng name/email/password; nhận recovery code xuất hiện một lần và tự lưu vào nơi an toàn.
3. Đăng nhập → Dashboard; xem dữ liệu mẫu có badge `Dữ liệu demo`.
4. Vào Videos → tìm kiếm → Edit một video → save → dashboard cập nhật.
5. Add video bằng file MP4/WebM cục bộ hoặc URL media trực tiếp, chọn category, thumbnail.
6. Preview video phát trong modal; lượt xem local tăng đúng một lần khi video bắt đầu phát thành công.
7. Delete video → modal confirm → record và assets liên quan được xóa; KPI cập nhật.
8. Logout → quay về Login; refresh và đăng nhập lại, dữ liệu đã thay đổi vẫn còn.
9. Nếu quên mật khẩu, vào Forgot Password → nhập email + recovery code → reset password + nhận mã mới.

## 4. Định nghĩa KPI (không được đổi tùy tiện)

- **Tổng số video**: `COUNT(*)` của record trong bảng `videos` (MVP xóa cứng nên không có record deleted; tính cả draft/published/archived).
- **Tổng lượt xem**: `SUM(video_daily_views.view_count)` của mọi video còn tồn tại. View seed = dữ liệu mô phỏng, view mới = nội bộ browser này ghi nhận khi playback bắt đầu.
- **Dung lượng storage**: tổng số byte của video/thumbnail **được lưu dạng Blob trong IndexedDB** cho các record còn tồn tại (đếm asset khác nhau một lần), đổi sang MB/GB. URL bên ngoài **không** chiếm storage local; không cộng `video_url` và cũng không gọi đây là dung lượng cloud.
- **Top 10**: 10 video có tổng view từ `video_daily_views` cao nhất, sắp giảm dần; tie-break bằng title hoặc ID ổn định; video không có view vẫn xếp được.
- **Line chart Ngày**: 30 ngày gần nhất (kể cả hôm nay), theo timezone của máy; ngày không có view = 0.
- **Line chart Tháng**: 12 tháng gần nhất (kể cả tháng hiện tại), tháng không có view = 0.
- **Khi Delete**: số video, view và storage phải phản ánh record bị xóa; vì cascade nên view của video bị xóa cũng biến mất. Hỏi xác nhận trước khi Delete.

## 5. Business rules

- Email unique, kiểm tra không phân biệt hoa/thường.
- Password tối thiểu 8 ký tự; xác nhận mật khẩu trùng; không lưu plaintext.
- ID video là UUID, không dùng index bảng làm ID.
- Title bắt buộc, 3–120 ký tự.
- Source video là `local` hoặc `url`; chọn đúng một loại trên mỗi video.
- URL media trực tiếp chỉ chấp nhận `http:`/`https:` và định dạng có thể phát trong browser (ưu tiên MP4/WebM); YouTube watch URL không tự nhúng vào `<video>`.
- Thumbnail không bắt buộc; thiếu thì hiển thị placeholder SVG nhẹ.
- Cần ít nhất 1 category khi video published; draft có thể chưa chọn.
- Delete yêu cầu modal xác nhận, không có undo ở MVP; gợi ý Export DB trước khi xóa quan trọng.
- Khi IndexedDB QuotaExceededError, không được báo save thành công và không được làm mất dữ liệu hiện có.
- Khi user đăng ký mới trên cùng origin, các tài khoản demo dùng chung `videos.db`; không cam kết cô lập dữ liệu theo người dùng.

## 6. Non-functional requirements

- Browser: Chrome/Edge bản hiện hành; Firefox bản hiện hành nếu khả thi.
- Layout không tràn ngang tại width 375px; các bảng cuộn ngang có kiểm soát.
- Hiển thị số theo `vi-VN`; ngày theo `dd/MM/yyyy`; timezone local.
- Các thao tác quan trọng có `try/catch` và thông báo lỗi hữu ích.
- Input ảnh/video kiểm tra MIME, giới hạn demo cấu hình (khuyến nghị video tối đa **30 MB/file** để giảm nguy cơ hết quota; không phải giới hạn cố định của nền tảng).
- Không tự phụ thuộc CDN khi offline; nếu dùng thư viện, lưu file vendor có nguồn rõ ràng.

## 7. Definition of Done

- Tất cả nút và form có chức năng thật.
- Không dùng dữ liệu KPI hardcode sau khi app khởi tạo.
- Có thể đăng ký, đăng nhập, khôi phục qua recovery code, logout.
- Có thể thêm, sửa, xóa, lọc, tìm kiếm, preview video.
- Reload vẫn có record, account và Blob (trừ khi browser xóa site data).
- Chart ngày/tháng và Top 10 phản ánh SQL.
- Không xuất hiện lỗi console gây gián đoạn luồng chính.
- Bộ test `08_TEST_CASES.md` được chạy và có kết quả.
