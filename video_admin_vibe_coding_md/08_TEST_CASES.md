# 08 — QA TEST CASES & ACCEPTANCE CRITERIA

## Cách dùng

- Chạy app qua static HTTP server (không mở file://).
- Test trong browser profile thông thường và sau reload.
- Đánh dấu `PASS`, `FAIL`, `BLOCKED`; ghi lỗi, thao tác tái hiện, ảnh chụp màn hình nếu cần.
- Không coi pass khi chỉ nhìn UI mà chưa thử lưu/đọc dữ liệu.

## A. Initialization / SQLite

| ID | Steps | Expected |
|---|---|---|
| DB01 | Mở app lần đầu | 2 DB được tạo/tải; dashboard/video seed hợp lệ; chưa có user thì yêu cầu register |
| DB02 | Tạo user và Add video rồi reload | User/video còn nguyên, không reset seed |
| DB03 | Export users.db/videos.db | Tải được file SQLite hợp lệ, mở được bằng SQLite viewer |
| DB04 | Refresh nhiều lần | Không nhân đôi video/category/view seed |
| DB05 | Xóa/mất asset Blob bằng DevTools rồi mở list | Có placeholder/lỗi rõ, không crash toàn app |
| DB06 | Kiểm tra `PRAGMA foreign_keys` | Delete video cascade mapping và view rows |
| DB07 | Fake IndexedDB storage failure | Form báo lỗi, không toast thành công |

## B. Authentication

| ID | Steps | Expected |
|---|---|---|
| AUTH01 | Register name/email/password hợp lệ | Save user, hiển thị recovery code một lần |
| AUTH02 | Register email trùng khác chữ hoa | Bị từ chối |
| AUTH03 | Password <8 ký tự hoặc confirm sai | Lỗi inline, không tạo user |
| AUTH04 | Login đúng | Dashboard hiển thị |
| AUTH05 | Login sai | Không truy cập; lỗi chung |
| AUTH06 | Đang guest truy cập `/dashboard.html` trực tiếp | Redirect login (UX guard) |
| AUTH07 | Logout và refresh | Về login/guest |
| AUTH08 | Forgot: email + recovery code đúng | Reset password, cấp recovery code mới |
| AUTH09 | Đăng nhập mật khẩu cũ sau reset | Thất bại |
| AUTH10 | Dùng recovery code cũ sau reset | Thất bại |
| AUTH11 | Xem users.db qua SQLite viewer | Không chứa password plaintext/recovery plaintext |

## C. Video list / CRUD

| ID | Steps | Expected |
|---|---|---|
| VID01 | Mở Videos | Có ID/title/thumbnail/views/actions theo SQLite |
| VID02 | Search title | Lọc đúng, không phân biệt hoa/thường |
| VID03 | Filter category, status | Đúng điều kiện và pagination |
| VID04 | Sort views desc | Views từ tổng SQL, không theo ID ngẫu nhiên |
| VID05 | Add video bằng MP4 <= demo limit | Save Blob + SQLite, preview được, reload còn video |
| VID06 | Add URL direct MP4/WebM | Metadata lưu, preview nếu URL hợp lệ và CORS/codec cho phép |
| VID07 | Add YouTube watch URL trong ô direct video | Hiển thị hướng dẫn URL không hỗ trợ, không giả là video HTML5 |
| VID08 | Add title rỗng hoặc URL malformed | Có lỗi, không lưu |
| VID09 | Edit title/category/status, Save, reload | Dữ liệu mới giữ nguyên |
| VID10 | Delete -> Cancel | Không thay đổi DB/view/storage |
| VID11 | Delete -> Confirm | Xóa row, category map, view rows; Blob không còn tham chiếu được cleanup |
| VID12 | Mở preview, play, pause/resume | Tăng 1 view trong một lượt mở modal |
| VID13 | Video lỗi không play được | Không tăng view |
| VID14 | Mở lại preview, play thành công | Tăng thêm 1 view |
| VID15 | Thumbnail hỏng | Placeholder + layout không vỡ |

## D. Dashboard & analytics

| ID | Steps | Expected |
|---|---|---|
| KPI01 | Đếm rows DB | KPI total videos khớp |
| KPI02 | SUM video_daily_views | KPI total views khớp |
| KPI03 | Xem Top 10 | Top 10 đúng thứ tự DESC, không hardcode |
| KPI04 | Đổi Ngày / Tháng | 30 ngày / 12 tháng, điểm thiếu = 0 |
| KPI05 | Xóa video có nhiều views | KPI views, Top10, trend giảm phù hợp |
| KPI06 | Upload local video/thumbnail | Storage tăng bằng kích thước Blob vừa lưu (có thể sai khác do format hiển thị) |
| KPI07 | Add URL external | Storage local **không** tăng theo kích thước video remote |
| KPI08 | Delete video local | Storage giảm sau cleanup Blob nếu asset không shared |
| KPI09 | 0 video | KPI 0 + empty states, không crash |
| KPI10 | Chart labels tiếng Việt | Không bị cắt xấu, có tooltip và data summary |

## E. UI/UX & robustness

| ID | Steps | Expected |
|---|---|---|
| UX01 | Width 375/768/1440 | Không tràn trang; sidebar/menu/table dùng được |
| UX02 | Tab/Enter/Escape navigation | Form/modal dùng keyboard được |
| UX03 | XSS input `<img onerror=...>` trong title | Hiển thị text thuần, không chạy script |
| UX04 | Chuỗi `' OR 1=1 --` trong search | Xử lý an toàn, không phá query |
| UX05 | Chọn file vượt hạn mức demo | Báo lỗi rõ, không đưa vào DB |
| UX06 | Reload ngay sau Save thành công | Dữ liệu vẫn tồn tại |
| UX07 | Browser private mode / clear site data | Có hướng dẫn storage local và rủi ro mất dữ liệu |
| UX08 | Cố tải source JS | Không có secret/API key/private password plaintext hardcoded |
| UX09 | Console/runtime | Không có exception chưa xử lý trong các luồng chính |

## F. Báo cáo kết quả mẫu

```text
Ngày kiểm thử: YYYY-MM-DD
Browser + version: ...
Build/ref: ...
DB: PASS __ / FAIL __ / BLOCKED __
AUTH: PASS __ / FAIL __ / BLOCKED __
VIDEO: PASS __ / FAIL __ / BLOCKED __
KPI: PASS __ / FAIL __ / BLOCKED __
UX: PASS __ / FAIL __ / BLOCKED __
Lỗi nghiêm trọng còn tồn đọng: ...
Kết luận release MVP: PASS / NOT READY
```
