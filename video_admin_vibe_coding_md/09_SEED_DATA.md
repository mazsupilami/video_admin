# 09 — DEMO SEED DATA & ANALYTICS CONSISTENCY

## 1. Mục tiêu

Khởi tạo đủ dữ liệu mẫu cho dashboard đẹp và test được chức năng, nhưng **toàn bộ số hiển thị phải được tính từ DB**. Không tạo số view hardcoded độc lập trong chart/KPI.

**Chỉ seed `videos.db` một lần khi DB mới hoặc chưa có bản persist**, không seed lại khi reload. **Không seed user/password mặc định.**

## 2. Categories mẫu

| slug | name |
|---|---|
| `tutorials` | Hướng dẫn |
| `reviews` | Đánh giá |
| `marketing` | Marketing |
| `events` | Sự kiện |
| `entertainment` | Giải trí |
| `others` | Khác |

ID UUID, created_at timestamp ISO. Dùng UNIQUE slug/name. Dữ liệu này là demo, không phải nội dung thực tế.

## 3. Danh sách 15 video demo (gợi ý)

| # | Title | Category | Status | Source |
|---:|---|---|---|---|
| 1 | Hướng dẫn tạo video giới thiệu sản phẩm | tutorials | published | url |
| 2 | Quy trình quay video bằng điện thoại | tutorials | published | url |
| 3 | Mẹo thiết kế thumbnail hấp dẫn | marketing | published | url |
| 4 | Video review sản phẩm mẫu A | reviews | published | url |
| 5 | Video review sản phẩm mẫu B | reviews | published | url |
| 6 | Tổng hợp sự kiện mùa hè | events | published | url |
| 7 | Kịch bản video quảng cáo 30 giây | marketing | published | url |
| 8 | Hướng dẫn ánh sáng khi quay video | tutorials | published | url |
| 9 | Hậu trường sản xuất nội dung | entertainment | published | url |
| 10 | Tổng kết hoạt động tháng | events | published | url |
| 11 | Cách thu âm giọng nói rõ ràng | tutorials | published | url |
| 12 | Video giới thiệu website | marketing | published | url |
| 13 | Phỏng vấn khách mời | entertainment | draft | url |
| 14 | Bản dựng video thử nghiệm | others | draft | url |
| 15 | Nội dung đã lưu trữ | others | archived | url |

**Video source:** Không tạo URL media bịa đặt rồi giả vờ preview sẽ chạy. Agent nên dùng một vài file video thử nghiệm **có license rõ ràng** trong assets demo (hoặc yêu cầu người dùng chọn file đầu tiên) và các record còn lại có trạng thái `Không có nguồn phát demo` nếu không có URL trực tiếp thật. Có thể dùng direct video URL hợp lệ từ nguồn công khai có quyền dùng nhưng kiểm tra hoạt động. Với schema source_type bắt buộc, nếu chưa có media source thật thì **tạo asset demo MP4/WebM nhẹ đi kèm dự án** và trỏ url tới đó; không lưu URL giả/404.

**Cách giảm kích thước:** dùng cùng 1 file demo video local thật nhỏ cho nhiều record nếu phù hợp, mỗi record có title/category riêng, thumbnail SVG placeholder. Với src `url`, đặt URL tương đối như `/assets/demo/demo-video.webm` chỉ nếu file tồn tại và phát được. Chú ý validator URL cần chấp nhận *relative local static asset* cho **seed demo internal assets** qua mã đặc biệt, nhưng form user nhập URL vẫn phải `http(s)` chuẩn; hoặc tạo absolute local `new URL('/assets/demo/demo-video.webm', location.origin).href` khi khởi tạo.

## 4. Demo view statistics

- Seed `video_daily_views` cho **90 ngày gần nhất**, theo ngày máy tính tại lúc init.
- Tạo pattern có thay đổi theo ngày (ví dụ đầu tuần/cuối tuần khác nhau) để line chart có đường xu hướng rõ, nhưng **đây là dữ liệu giả lập**.
- Random pseudo-deterministic bằng seed cố định theo video index/day index để kiểm thử tái lập.
- Mỗi video có tổng lượt xem khác nhau để Top10 dễ nhìn.
- Không sử dụng dãy static chart riêng. `videos.views` không tồn tại vì mọi view từ `video_daily_views`.
- Khi tạo ngày: dùng `new Date(year, month, day - offset)` (local) rồi format `YYYY-MM-DD` bằng component năm/tháng/ngày, tránh timezone UTC tự làm lệch ngày.
- Với demo tháng trong 12 tháng trước 90 ngày: những tháng ngoài range sẽ có 0 (theo đúng zero-fill). Nếu muốn trend 12 tháng đầy đặn, seed **12 tháng dữ liệu** thay vì 90 ngày, nhưng làm gọn số rows bằng 1 daily aggregate mỗi video/ngày.

### Ví dụ thuật toán (pseudocode)

```text
for each video index i (1..15):
  for day offset d from 364 down to 0:
    localDate = today - d days
    base = max(0, 34 - 2*i)
    weekdayBoost = localDate.getDay() in [0,6] ? 7 : 0
    wave = (d * 7 + i * 11) % 13
    views = max(0, base + weekdayBoost + wave - 5)
    insert into video_daily_views(video_id, view_date, view_count)
```

Đây là công thức tạo số **DEMO**, không phải số liệu thực. Bảo đảm date unique theo `(video_id, view_date)`. Số lượng ~15×365 rows, SQLite WASM xử lý được ở mức demo. Có thể dùng 12 tháng thay vì 90 ngày để chart monthly đẹp hơn.

## 5. Kiểm chứng dữ liệu

Sau seed:

```sql
SELECT COUNT(*) FROM videos;                        -- mong đợi 15
SELECT COUNT(*) FROM video_categories;             -- mong đợi 6
SELECT COALESCE(SUM(view_count),0)
FROM video_daily_views;                             -- phải bằng dashboard total views
```

Các query Top 10/trend phải lấy từ SQLite. Nếu demo không có video asset thực, preview phải báo `Video demo chưa có nguồn phát` thay vì cố ghi view.

## 6. Chế độ demo vs dữ liệu thật

- Hiển thị `Dữ liệu demo` trên dashboard và list khi đang sử dụng seed.
- Khi admin thêm video thật, không lẫn nhãn demo vào record mới.
- Schema v1 đã có cột `videos.is_demo` (1 cho seed, 0 cho video user tự tạo). Sử dụng chính cột này để gắn nhãn ở row và/hoặc biết khi nào banner demo còn hợp lệ.
- MVP chấp nhận cả demo và video user cùng tồn tại, nhưng không được quảng cáo chỉ số là lượt xem toàn nền tảng.
