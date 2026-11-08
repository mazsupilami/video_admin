/**
 * Application shell initializer for protected pages (Dashboard, Videos).
 */
import { getSession, clearSession } from './router-guard.js';
import { renderSupabaseHeaderBadge, testSupabaseConnection } from '../db/supabase-client.js';

export function initAppShell() {
  const session = getSession();

  // Initialize Supabase Status Badge & Test Connection
  renderSupabaseHeaderBadge();
  testSupabaseConnection().catch(err => console.warn('[Supabase test error]', err));

  // Populate User info in Header
  const userNameEl = document.getElementById('headerUserName');
  const userRoleEl = document.getElementById('headerUserRole');
  const userAvatarEl = document.getElementById('headerUserAvatar');

  if (session) {
    if (userNameEl) userNameEl.textContent = session.fullName || 'Admin';
    if (userRoleEl) {
      const roleName = session.role === 'admin' ? 'Quản trị viên' : 'Người dùng';
      userRoleEl.textContent = `${roleName} · ${session.email || ''}`;
    }
    if (userAvatarEl) {
      const initials = (session.fullName || 'A')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      userAvatarEl.textContent = initials || 'AD';
    }

    // Hide or show admin-only navigation links
    const adminNavLinks = document.querySelectorAll('[data-role-required="admin"]');
    adminNavLinks.forEach(link => {
      if (session.role === 'admin') {
        link.style.display = 'flex';
      } else {
        link.style.display = 'none';
      }
    });
  }

  // User Dropdown toggle
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');

  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      userDropdown.classList.remove('open');
    });

    userDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearSession();
      window.location.href = 'login.html';
    });
  }

  // Mobile Drawer Toggle
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const sidebar = document.querySelector('.app-sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  }

  if (menuToggleBtn) menuToggleBtn.addEventListener('click', openSidebar);
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
  if (backdrop) backdrop.addEventListener('click', closeSidebar);

  // Set Active Nav Link
  const currentPath = window.location.pathname.toLowerCase();
  const navLinks = document.querySelectorAll('.nav-item');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPath.endsWith(href.toLowerCase())) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}
