/**
 * Validation rules for user input and media uploads.
 */

export const MAX_VIDEO_BYTES = 30 * 1024 * 1024; // 30 MB demo limit
export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024; // 2 MB limit

export function validateEmail(email) {
  if (!email || typeof email !== 'string') return 'Email không được để trống.';
  const trimmed = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return 'Email không đúng định dạng.';
  return null;
}

export function validateFullName(name) {
  if (!name || typeof name !== 'string') return 'Họ tên không được để trống.';
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return 'Họ tên phải từ 2 đến 100 ký tự.';
  return null;
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string') return 'Mật khẩu không được để trống.';
  if (password.length < 8) return 'Mật khẩu phải có tối thiểu 8 ký tự.';
  return null;
}

export function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) return 'Vui lòng xác nhận lại mật khẩu.';
  if (password !== confirmPassword) return 'Mật khẩu xác nhận không khớp.';
  return null;
}

export function validateVideoTitle(title) {
  if (!title || typeof title !== 'string') return 'Tiêu đề không được để trống.';
  const trimmed = title.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return 'Tiêu đề phải từ 3 đến 120 ký tự.';
  return null;
}

export function validateVideoDescription(desc) {
  if (!desc) return null;
  if (desc.length > 2000) return 'Mô tả tối đa 2000 ký tự.';
  return null;
}

export function validateDirectVideoUrl(url) {
  if (!url || typeof url !== 'string') return 'URL video không được để trống.';
  const trimmed = url.trim();

  // Special case: relative demo video asset is allowed
  if (trimmed.startsWith('assets/') || trimmed.startsWith('/assets/')) {
    return null;
  }

  // Reject youtube watch / share links
  if (/youtube\.com\/watch|youtu\.be\//i.test(trimmed)) {
    return 'URL YouTube watch không hỗ trợ phát trực tiếp qua thẻ video HTML5. Vui lòng nhập link MP4/WebM trực tiếp.';
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'URL phải bắt đầu bằng http:// hoặc https://';
    }
  } catch (err) {
    return 'URL không đúng định dạng.';
  }

  return null;
}

export function validateVideoFile(file) {
  if (!file) return 'Vui lòng chọn tệp video.';
  const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
  if (!validTypes.includes(file.type)) {
    return 'Chỉ chấp nhận tệp video định dạng MP4, WebM hoặc OGG.';
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `Kích thước tệp vượt quá giới hạn demo (${(MAX_VIDEO_BYTES / (1024 * 1024)).toFixed(0)} MB).`;
  }
  return null;
}

export function validateThumbnailFile(file) {
  if (!file) return null;
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (!validTypes.includes(file.type)) {
    return 'Ảnh bìa phải có định dạng JPEG, PNG, WebP hoặc SVG.';
  }
  if (file.size > MAX_THUMBNAIL_BYTES) {
    return `Kích thước ảnh bìa không được vượt quá ${(MAX_THUMBNAIL_BYTES / (1024 * 1024)).toFixed(0)} MB.`;
  }
  return null;
}
