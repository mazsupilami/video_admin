/**
 * Permissions & Role Management Page Controller.
 * Restricted to accounts with role === 'admin'.
 */
import { requireAdmin, getSession, setSession } from '../core/router-guard.js';
import { initAppShell } from '../core/app-init.js';
import {
  getAllUsers,
  countAllUsers,
  getUserById,
  updateUserRole,
  getUserRoleCounts,
  syncAllLocalUsersToSupabase,
  syncUsersFromSupabase
} from '../db/users-repository.js';
import {
  formatDate,
  formatDateTime,
  formatShortId
} from '../core/formatters.js';
import {
  escapeHTML,
  debounce,
  copyToClipboard,
  showToast,
  openModal,
  closeModal
} from '../core/ui-utils.js';

export async function initPermissionsPage() {
  const session = requireAdmin();
  if (!session) return;

  initAppShell();

  // State
  let currentPage = 1;
  const itemsPerPage = 10;
  let currentSearch = '';
  let currentRoleFilter = '';
  let selectedUserForEdit = null;

  // DOM Elements
  const statTotalUsers = document.getElementById('statTotalUsers');
  const statAdminCount = document.getElementById('statAdminCount');
  const statUserCount = document.getElementById('statUserCount');

  const usersTableBody = document.getElementById('usersTableBody');
  const searchInput = document.getElementById('searchInput');
  const roleFilter = document.getElementById('roleFilter');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const paginationInfo = document.getElementById('paginationInfo');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');

  // Edit Role Modal Elements
  const roleModal = document.getElementById('roleModal');
  const editUserName = document.getElementById('editUserName');
  const editUserEmail = document.getElementById('editUserEmail');
  const roleAdminRadio = document.getElementById('roleAdminRadio');
  const roleUserRadio = document.getElementById('roleUserRadio');
  const selfEditWarning = document.getElementById('selfEditWarning');
  const saveRoleBtn = document.getElementById('saveRoleBtn');
  const cancelRoleBtn = document.getElementById('cancelRoleBtn');
  const closeRoleModalBtn = document.getElementById('closeRoleModalBtn');

  // Load Overview Statistics
  async function loadRoleStatistics() {
    try {
      const counts = await getUserRoleCounts();
      if (statTotalUsers) statTotalUsers.textContent = counts.total;
      if (statAdminCount) statAdminCount.textContent = counts.admins;
      if (statUserCount) statUserCount.textContent = counts.users;
    } catch (err) {
      console.warn('Error loading role stats', err);
    }
  }

  // Load and Render Users Table
  async function loadUsersTable() {
    if (!usersTableBody) return;

    usersTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
          Đang tải danh sách tài khoản...
        </td>
      </tr>
    `;

    try {
      const [totalCount, users] = await Promise.all([
        countAllUsers({
          search: currentSearch,
          role: currentRoleFilter
        }),
        getAllUsers({
          search: currentSearch,
          role: currentRoleFilter,
          page: currentPage,
          limit: itemsPerPage
        })
      ]);

      renderUsers(users, totalCount);
      updatePagination(totalCount);
    } catch (err) {
      console.error('Error fetching users for permission management', err);
      usersTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: var(--danger);">
            Lỗi khi truy vấn danh sách tài khoản: ${escapeHTML(err.message)}
          </td>
        </tr>
      `;
    }
  }

  function renderUsers(users, totalCount) {
    if (!usersTableBody) return;

    if (!users || users.length === 0) {
      usersTableBody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <img src="assets/images/empty-state.svg" alt="Empty" width="100" style="margin-bottom: 12px;" />
              <div class="empty-state-title">Không tìm thấy tài khoản phù hợp</div>
              <div class="empty-state-desc">Hãy thử thay đổi từ khóa tìm kiếm hoặc lọc theo vai trò khác.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    usersTableBody.innerHTML = '';

    for (const u of users) {
      const tr = document.createElement('tr');

      // Initials for avatar
      const initials = (u.full_name || 'U')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

      const isAdmin = u.role === 'admin';
      const roleBadge = isAdmin
        ? '<span class="badge badge-admin"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> ADMIN</span>'
        : '<span class="badge badge-user"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> USER</span>';

      const isCurrentLoggedInUser = session.userId === u.id;
      const youBadge = isCurrentLoggedInUser
        ? '<span style="font-size:0.6875rem; background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-weight:600; margin-left:6px;">Bạn</span>'
        : '';

      const lastLoginText = u.last_login_at
        ? formatDateTime(u.last_login_at)
        : '<span style="color:var(--text-muted);font-size:0.8125rem;">Chưa đăng nhập</span>';

      tr.innerHTML = `
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="user-avatar" style="width:36px; height:36px; font-size:0.8125rem; flex-shrink:0;">
              ${escapeHTML(initials)}
            </div>
            <div>
              <div style="font-weight:600; color:var(--text-primary); display:flex; align-items:center;">
                ${escapeHTML(u.full_name)}
                ${youBadge}
              </div>
              <div style="font-size:0.8125rem; color:var(--text-secondary);">${escapeHTML(u.email)}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="video-id-badge" title="Bấm để sao chép toàn bộ ID" data-copy-id="${escapeHTML(u.id)}">
            #${escapeHTML(formatShortId(u.id))}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </span>
        </td>
        <td>${roleBadge}</td>
        <td style="font-size:0.8125rem; color:var(--text-secondary);">${escapeHTML(formatDate(u.created_at))}</td>
        <td>${lastLoginText}</td>
        <td style="text-align: right;">
          <button type="button" class="btn btn-secondary btn-sm btn-edit-role" data-user-id="${escapeHTML(u.id)}" title="Chỉnh sửa vai trò quyền hạn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Phân quyền
          </button>
        </td>
      `;

      usersTableBody.appendChild(tr);
    }

    // Attach row events
    usersTableBody.querySelectorAll('.video-id-badge').forEach(badge => {
      badge.addEventListener('click', async () => {
        const fullId = badge.getAttribute('data-copy-id');
        const ok = await copyToClipboard(fullId);
        if (ok) showToast('Đã chép ID tài khoản vào bộ nhớ tạm!', 'success');
      });
    });

    usersTableBody.querySelectorAll('.btn-edit-role').forEach(btn => {
      btn.addEventListener('click', () => {
        const uId = btn.getAttribute('data-user-id');
        openRoleModalForUser(uId);
      });
    });
  }

  function updatePagination(totalCount) {
    if (!paginationInfo || !prevPageBtn || !nextPageBtn) return;

    const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
    const startItem = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalCount);

    paginationInfo.textContent = `Hiển thị ${startItem}–${endItem} / ${totalCount} tài khoản`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  // Filter Events
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      loadUsersTable();
    }, 300));
  }

  if (roleFilter) {
    roleFilter.addEventListener('change', (e) => {
      currentRoleFilter = e.target.value;
      currentPage = 1;
      loadUsersTable();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      currentSearch = '';
      currentRoleFilter = '';
      if (searchInput) searchInput.value = '';
      if (roleFilter) roleFilter.value = '';
      currentPage = 1;
      loadUsersTable();
    });
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadUsersTable();
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      currentPage++;
      loadUsersTable();
    });
  }

  // Edit Role Modal Logic
  async function openRoleModalForUser(userId) {
    try {
      const user = await getUserById(userId);
      if (!user) {
        showToast('Không tìm thấy tài khoản người dùng.', 'error');
        return;
      }

      selectedUserForEdit = user;

      if (editUserName) editUserName.textContent = user.full_name;
      if (editUserEmail) editUserEmail.textContent = user.email;

      if (user.role === 'admin') {
        roleAdminRadio.checked = true;
      } else {
        roleUserRadio.checked = true;
      }

      // Check if self edit
      const isSelf = session.userId === user.id;
      if (selfEditWarning) {
        selfEditWarning.style.display = isSelf ? 'block' : 'none';
      }

      openModal('roleModal');
    } catch (err) {
      console.error('Error opening role edit modal', err);
      showToast('Lỗi khi tải thông tin tài khoản: ' + err.message, 'error');
    }
  }

  function handleCloseRoleModal() {
    selectedUserForEdit = null;
    closeModal('roleModal');
  }

  if (cancelRoleBtn) cancelRoleBtn.addEventListener('click', handleCloseRoleModal);
  if (closeRoleModalBtn) closeRoleModalBtn.addEventListener('click', handleCloseRoleModal);

  // Save Role Changes
  if (saveRoleBtn) {
    saveRoleBtn.addEventListener('click', async () => {
      if (!selectedUserForEdit) return;

      const newRole = roleAdminRadio.checked ? 'admin' : 'user';

      if (newRole === selectedUserForEdit.role) {
        showToast('Vai trò không có sự thay đổi.', 'info');
        handleCloseRoleModal();
        return;
      }

      const isSelf = session.userId === selectedUserForEdit.id;
      if (isSelf && newRole === 'user') {
        const confirmSelfDemote = confirm(
          'CẢNH BÁO: Bạn đang hủy quyền ADMIN của chính mình. Sau khi lưu, bạn sẽ trở thành USER và không thể vào lại trang Phân Quyền nữa. Bạn có chắc chắn muốn tiếp tục?'
        );
        if (!confirmSelfDemote) return;
      }

      saveRoleBtn.disabled = true;
      saveRoleBtn.textContent = 'Đang lưu...';

      try {
        await updateUserRole(selectedUserForEdit.id, newRole);

        // If updated self, update current session
        if (isSelf) {
          const updatedUser = {
            id: selectedUserForEdit.id,
            full_name: selectedUserForEdit.full_name,
            email: selectedUserForEdit.email,
            role: newRole
          };
          setSession(updatedUser);
        }

        const roleText = newRole === 'admin' ? 'ADMIN (Quản trị viên)' : 'USER (Người dùng)';
        showToast(`Đã cập nhật vai trò cho ${selectedUserForEdit.email} thành ${roleText}!`, 'success');

        handleCloseRoleModal();

        // If self demoted to user, redirect to dashboard because they are no longer admin!
        if (isSelf && newRole === 'user') {
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 1000);
          return;
        }

        // Refresh stats and table
        await Promise.all([loadRoleStatistics(), loadUsersTable()]);
      } catch (err) {
        console.error('Error updating role', err);
        showToast('Lỗi khi cập nhật vai trò: ' + err.message, 'error');
      } finally {
        saveRoleBtn.disabled = false;
        saveRoleBtn.textContent = 'Lưu thay đổi';
      }
    });
  }

  // Initial Data Load
  await Promise.all([loadRoleStatistics(), loadUsersTable()]);

  // Auto-sync all local users (including newly created ones) to Supabase and pull remote updates
  syncAllLocalUsersToSupabase().then(() => {
    return syncUsersFromSupabase();
  }).then(updated => {
    if (updated) {
      loadRoleStatistics();
      loadUsersTable();
    }
  }).catch(e => console.warn('[Auto-sync users error]', e));
}
