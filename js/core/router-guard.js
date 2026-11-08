/**
 * Route guard checking demo session in sessionStorage.
 */

const SESSION_KEY = 'videoAdminSession';

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function setSession(user) {
  const session = {
    userId: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role || 'admin',
    issuedAt: Date.now()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function requireAuth() {
  const session = getSession();
  if (!session || !session.userId) {
    const current = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `login.html?redirect=${current}`;
    return null;
  }
  return session;
}

export function redirectIfAuthenticated() {
  const session = getSession();
  if (session && session.userId) {
    window.location.href = 'dashboard.html';
    return session;
  }
  return null;
}

export function requireAdmin() {
  const session = requireAuth();
  if (!session) return null;
  if (session.role !== 'admin') {
    alert('Truy cập bị từ chối: Chỉ tài khoản có quyền ADMIN mới có thể vào trang Phân quyền.');
    window.location.href = 'dashboard.html';
    return null;
  }
  return session;
}

export function isAdmin() {
  const session = getSession();
  return session && session.role === 'admin';
}
