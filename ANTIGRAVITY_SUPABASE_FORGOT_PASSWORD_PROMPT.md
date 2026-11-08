# PROMPT CHO ANTIGRAVITY — HOÀN THIỆN FORGOT PASSWORD VỚI SUPABASE AUTH

## Vai trò
Bạn là Senior Frontend Engineer kiêm Supabase Authentication Engineer. Hãy tiếp tục dự án đang tồn tại, KHÔNG tạo lại project từ đầu và KHÔNG tự giả định cấu trúc source code.

## 0. Thư mục project cần đọc
`C:\Users\Admin\Documents\AI Vibe Coding\Buổi 4\admin_video`

**Việc đầu tiên bắt buộc:** mở workspace đúng thư mục trên, đọc cây thư mục và các file liên quan (README/AGENTS, package.json nếu có, HTML/CSS/JS, auth/config, .env.example, routes, login, register, dashboard, SQLite adapters, Supabase integration). Nếu workspace khác thư mục này, chuyển sang đúng workspace trước khi sửa. Không đọc/hiển thị giá trị bí mật trong báo cáo hoặc console.

Dự án là **Video Admin Dashboard**, ban đầu thiết kế dùng HTML, CSS, JavaScript, SQLite cục bộ cho dữ liệu video và `users.db` cho user. Tôi đã kết nối Antigravity tới Supabase, nhưng bạn PHẢI kiểm tra code và Supabase project thực tế để biết Auth đã được tích hợp hay mới chỉ có kết nối công cụ. Không suy đoán rằng Login/Register đang dùng Supabase Auth.

## 1. Mục tiêu
Hoàn thiện chức năng khôi phục mật khẩu qua email bằng **Supabase Auth** trong website hiện tại:

1. Từ trang Login nhấn **Forgot Password?**.
2. Nhập email -> gửi liên kết đặt lại mật khẩu bằng Supabase Auth.
3. Nhấp link trong email -> quay về trang Reset Password đúng origin/port/path của ứng dụng.
4. Xác minh callback/link recovery hợp lệ; chỉ khi hợp lệ mới cho nhập mật khẩu mới.
5. Nhập mật khẩu mới và xác nhận -> đổi mật khẩu bằng Supabase Auth.
6. Thông báo thành công; người dùng có thể quay lại Login và đăng nhập bằng mật khẩu mới; mật khẩu cũ không còn hiệu lực.

**Yêu cầu kỹ thuật:** Ưu tiên stack hiện có, không tự thêm framework/backend. Nếu ứng dụng hiện tại là HTML/CSS/JS thuần, giữ nguyên. Có thể dùng Supabase JS SDK hiện hữu. Supabase Auth là dịch vụ backend quản lý sẵn; KHÔNG xây dựng server Node/Express/PHP riêng cho chức năng này.

## 2. Bước A — Audit code (thực hiện trước mọi sửa đổi)

- Liệt kê tên/công dụng file liên quan đến auth và khởi tạo app; xác định trang Login, Register, Forgot Password, Reset Password (nếu đã có), router, các auth guards và script khởi tạo Supabase.
- Xác định cách chạy ứng dụng hiện tại, origin và port (Live Server, Vite hay công cụ khác), cách điều hướng trang, cách xử lý form và hiện trạng CSS.
- Kiểm tra bản SDK Supabase; tìm chỗ tạo client, bảo đảm dùng lại **một client thống nhất**, không tạo nhiều client không cần thiết.
- Kiểm tra Login và Register hiện dùng `users.db`/localStorage hay Supabase Auth. Chỉ ra điểm mâu thuẫn nếu đang dùng hai nơi xác thực khác nhau.
- Kiểm tra Supabase project đang kết nối: Email/Password Auth, URL Configuration (Site URL, Additional Redirect URLs), Email Template Reset Password, giới hạn gửi email/SMTP. Dùng connector/tool đang có nếu hỗ trợ. Không giả vờ đã kiểm tra nếu không có quyền truy cập setting.
- Kiểm tra các tài liệu hướng dẫn/AGENTS trong project và tôn trọng convention đang có.
- Trước khi edit, ghi tóm tắt ngắn: phát hiện thực tế, file dự kiến sửa/tạo, thay đổi cần thiết, các rủi ro. Sau đó tiếp tục thực hiện, không chỉ dừng ở lập kế hoạch.

## 3. Bước B — Triển khai flow Forgot Password

- Tận dụng trang `forgot-password` hiện có; nếu không có thì tạo trang tương thích cấu trúc/router hiện hữu.
- Giữ UI **light mode**, nền trắng, hiện đại, responsive; cùng font, màu, layout và component với Login hiện tại.
- Form email có `required`, kiểm tra email cơ bản, label truy cập được, nút gửi và Back to Login.
- Gọi API chính thức của Supabase JS v2: `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
- `redirectTo` phải là URL trang đặt lại mật khẩu tương ứng **origin, port và route thực tế**. Không hardcode localhost:5500 nếu app chạy cổng khác. Có thể dùng `new URL(path, window.location.origin)` hoặc route helper phù hợp với project, miễn là kết quả đúng.
- Sau khi submit, disable nút khi xử lý; thông báo trạng thái rõ ràng, tránh submit liên tục. Thông báo thành công nên trung tính (không tiết lộ email có tồn tại hay không).
- Hiển thị lỗi gửi email/giới hạn tần suất dưới dạng dễ hiểu, không đổ lộ token hay stack trace cho người dùng.

## 4. Bước C — Triển khai flow Reset Password

- Tận dụng hoặc tạo route/trang Reset Password tương thích ứng dụng.
- Trang reset **không yêu cầu người dùng đang đăng nhập trước đó**. Tuy nhiên, chỉ hiển thị và cho submit form đặt mật khẩu mới khi link/phiên recovery hợp lệ.
- Xử lý đúng flow SDK hiện tại (implicit URL fragment / `PASSWORD_RECOVERY` hoặc PKCE `code` / session exchange, tùy cấu hình thật). Tham khảo tài liệu Supabase chính thức. Không lấy việc người dùng có session đăng nhập thông thường làm bằng chứng duy nhất của recovery.
- Đảm bảo auth event listener được đăng ký đúng lúc; không để auth guard redirect sang Dashboard/Login trước khi xử lý callback. Không trao đổi code hai lần hoặc khởi tạo hai Supabase client.
- Form gồm New Password, Confirm Password, show/hide password, validation rõ ràng, loading state và thông báo.
- Áp dụng chính sách password của Supabase project nếu đã cấu hình; tối thiểu kiểm tra độ dài hợp lý và hai ô trùng nhau. Không ghi password vào log, URL, SQLite, localStorage tự tạo hay analytics.
- Sau khi xác minh recovery và validate form, gọi `supabase.auth.updateUser({ password: newPassword })`.
- Chỉ thông báo thành công khi Supabase trả về thành công. Sau đó xử lý session theo UX nhất quán (ưu tiên sign out nếu muốn login lại), quay về Login bằng thao tác rõ ràng hoặc điều hướng phù hợp.
- Xử lý link hết hạn, link lỗi, link đã dùng, callback sai, thiếu session/network error; hiển thị lời giải thích ngắn và CTA 'Gửi lại liên kết'. Không để form reset hoạt động với link không hợp lệ.
- Không đưa access/refresh token hoặc thông tin xác thực vào logs, alert, mã nguồn hay nội dung báo cáo.

## 5. Bước D — Đồng bộ Login/Register với Supabase Auth

- Nếu Login/Register **đã** dùng Supabase Auth, giữ nguyên và chỉ sửa những điểm cần để recovery hoạt động.
- Nếu Login/Register **vẫn** xác thực bằng `users.db` / dữ liệu local, không giả vờ password reset Supabase sẽ tự cập nhật SQLite. Hãy tích hợp xác thực Login/Register với Supabase Auth bằng thay đổi tối thiểu, bảo toàn UI và navigation hiện hữu; báo cáo rõ việc tài khoản SQLite cũ cần đăng ký/migrate.
- Không sử dụng `users.db` để lưu password mới; không tạo bản sao mật khẩu; không dùng localStorage như nguồn xác minh identity.
- Giữ toàn bộ chức năng Dashboard, List Video, Categories, biểu đồ và dữ liệu video SQLite đang hoạt động. Không migrate `videos.db` sang Supabase trừ khi tôi yêu cầu sau này.
- Cập nhật bảo vệ route (nếu có) để người chưa login không xem trang admin; trang Forgot/Reset vẫn truy cập công khai và recovery callback không bị chặn.

## 6. Bước E — Cấu hình Supabase / email

- Xác định chính xác Site URL và Additional Redirect URLs cần khai báo theo URL chạy thực tế; thêm cấu hình qua công cụ đang kết nối **nếu có quyền, tác động rõ ràng và an toàn**. Nếu không thể tự chỉnh Dashboard, ghi từng bước thao tác cần tôi thực hiện, kèm chính xác URL phải thêm.
- Kiểm tra Email Provider bật và Reset Password email template tạo link đúng `redirectTo`. Nếu template hiện tại gây chuyển hướng sai thì nêu cách sửa (xem `{{ .ConfirmationURL }}` và `{{ .RedirectTo }}` theo loại template/flow).
- Nếu email không đến, kiểm tra hạn chế dịch vụ mail mặc định, thành viên project, rate limit, spam, cấu hình SMTP. Không tuyên bố gửi thành công chỉ dựa vào API trả về OK.
- Không sử dụng `service_role`, `sb_secret_*`, database password hoặc private SMTP credentials trong frontend. Chỉ Publishable Key/legacy anon key (theo cấu hình Supabase project) mới được dùng ở client.
- Không tiết lộ hoặc in nội dung `.env` trong kết quả. Nếu thêm ví dụ cấu hình, chỉ ghi tên biến và placeholder, không ghi giá trị thật.

## 7. Bước F — Kiểm thử bắt buộc

Chạy website bằng phương pháp mà project đang dùng, theo dõi browser console/network hoặc test automation có sẵn. Kiểm tra tối thiểu:

1. Từ Login có thể mở Forgot Password và quay về Login.
2. Email hợp lệ -> gọi `resetPasswordForEmail` đúng một lần, UI trạng thái đúng.
3. Email không tồn tại -> không lộ thông tin tài khoản.
4. Link email hợp lệ -> mở đúng trang Reset Password, không bị auth guard chuyển hướng.
5. Confirm Password không trùng -> chặn submit.
6. Password không đáp ứng policy -> báo lỗi dễ hiểu.
7. Link sai/hết hạn/đã dùng -> không cho cập nhật, cho phép yêu cầu link mới.
8. Đổi password thành công -> login bằng password mới thành công và password cũ thất bại.
9. Dashboard / Videos / SQLite tiếp tục hoạt động như trước.
10. Không phát hiện secret hoặc password trong client code, URL mới tạo, console logs.

Nếu cần email thực hoặc đăng nhập Supabase Dashboard mà bạn không được truy cập, thực hiện mọi phần có thể tự kiểm thử, **đánh dấu rõ phần chưa xác minh end-to-end** và đưa checklist thao tác thủ công cụ thể; không báo 'pass' khi chưa kiểm tra.

## 8. Ràng buộc triển khai

- KHÔNG tạo dự án mới, KHÔNG overwrite hàng loạt file, KHÔNG thay đổi framework, KHÔNG tạo backend riêng.
- KHÔNG sửa/chuyển dữ liệu video không liên quan. Không xoá `users.db` hay dữ liệu cũ trước khi báo cáo tác động và có phương án giữ dữ liệu.
- KHÔNG giả lập email đã gửi, token hợp lệ hoặc test thành công. Không hardcode token/user/password.
- Tối thiểu hóa thay đổi; code dễ đọc cho người mới học Vibe Coding.
- Có kiểm tra lỗi, trường hợp không có mạng, UI feedback, responsive và accessibility cơ bản.
- Nếu phải thay đổi cấu hình trên Supabase Dashboard mà tool không cho phép, báo chính xác bước cần tôi làm, vẫn hoàn thành phần code còn lại.

## 9. Bàn giao sau khi thực hiện

Trả lời bằng tiếng Việt, gồm:

1. **Audit ban đầu:** thực tế project gồm những file nào liên quan đến auth, Login/Register đã dùng gì, Supabase đã kết nối ở đâu.
2. **Files changed:** đường dẫn file mới/đã sửa và tóm tắt thay đổi.
3. **Supabase Settings:** Site URL và Redirect URLs thực tế, các mục nào đã chỉnh và các mục nào tôi cần tự chỉnh.
4. **Cách chạy:** lệnh khởi động/URL thử nghiệm đúng project.
5. **Test Results:** phân biệt Passed / Failed / Not tested, đặc biệt với email recovery thật.
6. **Known issues:** lỗi hoặc bước cần làm tiếp, không che giấu hạn chế.
7. **Đề xuất cập nhật tài liệu:** nếu project có README/AGENTS, cập nhật hướng dẫn reset password ngắn gọn để các Agent sau có thể tiếp tục.

**Bắt đầu bằng việc đọc project ở đường dẫn được cung cấp; sau khi audit, hãy thực thi thay đổi và kiểm thử, không chỉ tư vấn lý thuyết.**

## Tài liệu chính thức để đối chiếu
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/reference/javascript/auth-updateuser
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-email-templates
