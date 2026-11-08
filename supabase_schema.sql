-- ==============================================================================
-- SUPABASE SCHEMA FOR VIDEO ADMIN APPLICATION
-- Project: yxcuzeielhdmsqlydiak.supabase.co
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán toàn bộ nội dung này và bấm "Run"
-- ==============================================================================

-- 1. BẢNG USERS (Tài khoản người dùng & phân quyền)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  recovery_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 2. BẢNG VIDEO CATEGORIES (Danh mục video)
CREATE TABLE IF NOT EXISTS public.video_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. BẢNG VIDEOS (Quản lý video)
CREATE TABLE IF NOT EXISTS public.videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  source_type TEXT NOT NULL CHECK (source_type IN ('local', 'url')),
  video_url TEXT,
  video_asset_id TEXT,
  thumbnail_url TEXT,
  thumbnail_asset_id TEXT,
  duration_seconds INTEGER,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_title ON public.videos(title);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_created ON public.videos(created_at);

-- 4. BẢNG MAP VIDEO - CATEGORY
CREATE TABLE IF NOT EXISTS public.video_category_map (
  video_id TEXT NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES public.video_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_video_map_category ON public.video_category_map(category_id);

-- 5. BẢNG VIDEO DAILY VIEWS (Thống kê lượt xem theo ngày)
CREATE TABLE IF NOT EXISTS public.video_daily_views (
  video_id TEXT NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  view_date DATE NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  PRIMARY KEY (video_id, view_date)
);

CREATE INDEX IF NOT EXISTS idx_views_date ON public.video_daily_views(view_date);

-- ==============================================================================
-- 6. PHÂN QUYỀN ROW LEVEL SECURITY (RLS) CHO SUPABASE
-- Cho phép publishable/anon key và authenticated đọc, ghi, cập nhật
-- ==============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_category_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_daily_views ENABLE ROW LEVEL SECURITY;

-- Xóa policies cũ nếu đã tồn tại để tránh xung đột
DROP POLICY IF EXISTS "Public full access users" ON public.users;
DROP POLICY IF EXISTS "Public full access categories" ON public.video_categories;
DROP POLICY IF EXISTS "Public full access videos" ON public.videos;
DROP POLICY IF EXISTS "Public full access category_map" ON public.video_category_map;
DROP POLICY IF EXISTS "Public full access daily_views" ON public.video_daily_views;

-- Tạo policies mở quyền cho anon và authenticated
CREATE POLICY "Public full access users" ON public.users
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Public full access categories" ON public.video_categories
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Public full access videos" ON public.videos
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Public full access category_map" ON public.video_category_map
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Public full access daily_views" ON public.video_daily_views
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Cho phép Realtime an toàn nếu publication tồn tại
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'videos'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
    END IF;
  END IF;
END $$;

-- ==============================================================================
-- 7. SEED DỮ LIỆU BAN ĐẦU: 1 ADMIN + 10 USERS DEMO
-- Khớp hoàn toàn với cơ sở dữ liệu local (Mật khẩu: Admin@123456 & User@123456)
-- ==============================================================================

INSERT INTO public.users (id, full_name, email, password_hash, password_salt, recovery_hash, recovery_salt, role, created_at, updated_at)
VALUES 
  ('admin-demo-id', 'Quản trị viên Demo', 'admin@demo.com', 'xD0833rh9/9AAOHi0alYFrLWlN5yo5Ce7z3VsVdVfBg=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'xD0833rh9/9AAOHi0alYFrLWlN5yo5Ce7z3VsVdVfBg=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'admin', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
  ('user-demo-1', 'Nguyễn Văn An', 'user1@demo.com', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'user', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  ('user-demo-2', 'Trần Thị Bích', 'user2@demo.com', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'user', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),
  ('user-demo-3', 'Lê Hoàng Cường', 'user3@demo.com', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'user', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
  ('user-demo-4', 'Phạm Minh Dũng', 'user4@demo.com', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'user', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
  ('user-demo-5', 'Hoàng Hải Yến', 'user5@demo.com', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'user', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
  ('user-demo-6', 'Đỗ Quốc Khánh', 'user6@demo.com', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'user', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('user-demo-7', 'Vũ Thùy Linh', 'user7@demo.com', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'user', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
  ('user-demo-8', 'Bùi Quang Minh', 'user8@demo.com', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'user', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  ('user-demo-9', 'Ngô Phương Nga', 'user9@demo.com', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'user', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('user-demo-10', 'Đặng Tuấn Phong', 'user10@demo.com', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'we4Y0wOuh787gK7hJ1LMhpRK+ZxaoUgLjTpq7Jvuh0Y=', 'ZGVtb1NhbHQxMjM0NTY3OA==', 'user', NOW() - INTERVAL '1 days', NOW() - INTERVAL '1 days')
ON CONFLICT (email) DO NOTHING;

-- 8. SEED DANH MỤC
INSERT INTO public.video_categories (id, name, slug)
VALUES
  ('cat-1', 'Hướng dẫn', 'tutorials'),
  ('cat-2', 'Đánh giá', 'reviews'),
  ('cat-3', 'Marketing', 'marketing'),
  ('cat-4', 'Sự kiện', 'events'),
  ('cat-5', 'Giải trí', 'entertainment'),
  ('cat-6', 'Khác', 'others')
ON CONFLICT (slug) DO NOTHING;

-- 9. SEED MỘT SỐ VIDEOS DEMO
INSERT INTO public.videos (id, title, description, status, source_type, video_url, duration_seconds, is_demo, created_at, updated_at)
VALUES
  ('vid-1', 'Hướng dẫn tạo video giới thiệu sản phẩm', 'Quy trình sản xuất video giới thiệu tính năng sản phẩm một cách chuyên nghiệp.', 'published', 'url', 'assets/demo/demo-video.webm', 60, true, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('vid-2', 'Quy trình quay video bằng điện thoại', 'Các bước chuẩn bị, cài đặt thông số và góc máy khi quay video trên smartphone.', 'published', 'url', 'assets/demo/demo-video.webm', 60, true, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
  ('vid-3', 'Mẹo thiết kế thumbnail hấp dẫn', 'Cách phối màu, chọn phông chữ và bố cục để tăng tỷ lệ click (CTR) cho video.', 'published', 'url', 'assets/demo/demo-video.webm', 60, true, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  ('vid-4', 'Video review sản phẩm mẫu A', 'Trải nghiệm thực tế, đánh giá ưu nhược điểm của dòng sản phẩm công nghệ phiên bản A.', 'published', 'url', 'assets/demo/demo-video.webm', 60, true, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
  ('vid-5', 'Tổng hợp sự kiện mùa hè', 'Những khoảnh khắc đáng nhớ nhất trong chuỗi hoạt động team building.', 'published', 'url', 'assets/demo/demo-video.webm', 60, true, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

-- MAP VIDEO - DANH MỤC
INSERT INTO public.video_category_map (video_id, category_id)
VALUES
  ('vid-1', 'cat-1'),
  ('vid-2', 'cat-1'),
  ('vid-3', 'cat-3'),
  ('vid-4', 'cat-2'),
  ('vid-5', 'cat-4')
ON CONFLICT (video_id, category_id) DO NOTHING;
