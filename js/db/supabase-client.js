/**
 * Supabase Client & Sync Layer for Video Admin
 * Connects website to Supabase project: yxcuzeielhdmsqlydiak.supabase.co
 */

const DEFAULT_CONFIG = {
  url: 'https://yxcuzeielhdmsqlydiak.supabase.co',
  publishableKey: 'sb_publishable_8wT0tEfiHwHn0l6fefXL5g_QhGhw290',
  anonKey: '',
  projectId: 'yxcuzeielhdmsqlydiak'
};

let activeConfig = { ...DEFAULT_CONFIG };
let supabaseInstance = null;
let connectionStatus = {
  tested: false,
  ok: false,
  tablesReady: false,
  message: 'Đang khởi tạo...',
  latency: 0
};

/**
 * Load config from supabase.txt if accessible, else fallback to defaults
 */
export async function loadSupabaseConfig() {
  try {
    const res = await fetch('/supabase.txt');
    if (res.ok) {
      const text = await res.text();
      const urlMatch = text.match(/Project URL:\s*([^\r\n]+)/i);
      const pubKeyMatch = text.match(/Publishable key:\s*([^\r\n]+)/i);
      const anonKeyMatch = text.match(/Anon Public:\s*([^\r\n]+)/i);
      const projIdMatch = text.match(/Project ID:\s*([^\r\n]+)/i);

      if (urlMatch && urlMatch[1].trim()) activeConfig.url = urlMatch[1].trim();
      if (pubKeyMatch && pubKeyMatch[1].trim()) activeConfig.publishableKey = pubKeyMatch[1].trim();
      if (anonKeyMatch && anonKeyMatch[1].trim()) activeConfig.anonKey = anonKeyMatch[1].trim();
      if (projIdMatch && projIdMatch[1].trim()) activeConfig.projectId = projIdMatch[1].trim();
    }
  } catch (e) {
    // Fallback to DEFAULT_CONFIG silently
  }

  return activeConfig;
}

/**
 * Get active key (prioritize anon JWT if present, else publishable key)
 */
export function getActiveSupabaseKey() {
  return (activeConfig.anonKey && activeConfig.anonKey.trim()) 
    ? activeConfig.anonKey.trim() 
    : activeConfig.publishableKey;
}

/**
 * Initialize Supabase Client instance
 */
export async function initSupabase() {
  if (supabaseInstance) return supabaseInstance;

  await loadSupabaseConfig();
  const key = getActiveSupabaseKey();

  if (!window.supabase) {
    console.warn('[Supabase] Thư viện @supabase/supabase-js chưa được load trên trang.');
    connectionStatus = {
      tested: true,
      ok: false,
      tablesReady: false,
      message: 'Chưa nạp thư viện Supabase',
      latency: 0
    };
    return null;
  }

  try {
    supabaseInstance = window.supabase.createClient(activeConfig.url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    console.log('[Supabase] Đã khởi tạo kết nối tới:', activeConfig.url);
  } catch (err) {
    console.error('[Supabase] Lỗi khởi tạo client:', err);
  }

  return supabaseInstance;
}

export function getSupabase() {
  return supabaseInstance;
}

export function getSupabaseConfig() {
  return { ...activeConfig, activeKey: getActiveSupabaseKey() };
}

export function getConnectionStatus() {
  return { ...connectionStatus };
}

/**
 * Test Supabase connectivity and check if database tables exist
 */
export async function testSupabaseConnection() {
  const client = await initSupabase();
  const startTime = performance.now();

  if (!client) {
    connectionStatus = {
      tested: true,
      ok: false,
      tablesReady: false,
      message: 'Thư viện Supabase không khả dụng',
      latency: 0
    };
    updateSupabaseBadgeUI();
    return connectionStatus;
  }

  try {
    // 1. Test ping to auth endpoint via fetch
    const pingStart = performance.now();
    const key = getActiveSupabaseKey();
    const authRes = await fetch(`${activeConfig.url}/auth/v1/settings`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });
    const latency = Math.round(performance.now() - pingStart);

    if (!authRes.ok) {
      connectionStatus = {
        tested: true,
        ok: false,
        tablesReady: false,
        message: `HTTP ${authRes.status}: Không thể xác thực với Supabase API`,
        latency
      };
      updateSupabaseBadgeUI();
      return connectionStatus;
    }

    // 2. Check if table 'users' exists
    const { data, error } = await client
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      // If code is PGRST205, table does not exist yet
      const isMissingTable = error.code === 'PGRST205' || error.message?.includes('Could not find');
      connectionStatus = {
        tested: true,
        ok: true,
        tablesReady: !isMissingTable,
        message: isMissingTable 
          ? 'Đã kết nối Supabase, cần chạy SQL tạo bảng'
          : `Lỗi bảng: ${error.message}`,
        latency
      };
    } else {
      connectionStatus = {
        tested: true,
        ok: true,
        tablesReady: true,
        message: 'Kết nối Supabase và bảng dữ liệu sẵn sàng',
        latency
      };
    }
  } catch (err) {
    console.warn('[Supabase] Lỗi kiểm tra kết nối:', err);
    connectionStatus = {
      tested: true,
      ok: false,
      tablesReady: false,
      message: err.message || 'Mất kết nối mạng tới Supabase',
      latency: 0
    };
  }

  updateSupabaseBadgeUI();
  return connectionStatus;
}

/**
 * Sync user to Supabase
 */
export async function syncUserToSupabase(user) {
  const client = await initSupabase();
  if (!client) return false;

  try {
    const payload = {
      id: user.id,
      full_name: user.full_name,
      email: user.email.toLowerCase(),
      password_hash: user.password_hash,
      password_salt: user.password_salt,
      recovery_hash: user.recovery_hash || user.password_hash,
      recovery_salt: user.recovery_salt || user.password_salt,
      role: user.role || 'user',
      created_at: user.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await client
      .from('users')
      .upsert(payload, { onConflict: 'email' });

    if (error) {
      console.warn('[Supabase Sync] Lỗi sync user:', error);
      return false;
    }
    connectionStatus.tablesReady = true;
    return true;
  } catch (e) {
    console.warn('[Supabase Sync] Exception:', e);
    return false;
  }
}

/**
 * Update user role in Supabase
 */
export async function updateSupabaseUserRole(userId, newRole) {
  const client = await initSupabase();
  if (!client) return false;

  try {
    const { error } = await client
      .from('users')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.warn('[Supabase Sync] Lỗi cập nhật role:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[Supabase Sync] Exception:', e);
    return false;
  }
}
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[Supabase Sync] Exception:', e);
    return false;
  }
}

/**
 * Fetch all users from Supabase
 */
export async function fetchSupabaseUsers() {
  const client = await initSupabase();
  if (!client || !connectionStatus.tablesReady) return null;

  try {
    const { data, error } = await client
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] Lỗi fetch users:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('[Supabase] Exception fetch users:', e);
    return null;
  }
}

/**
 * Render or update the interactive Supabase badge in Header
 */
export function renderSupabaseHeaderBadge() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  let badge = document.getElementById('supabaseStatusBadge');
  if (!badge) {
    badge = document.createElement('button');
    badge.id = 'supabaseStatusBadge';
    badge.type = 'button';
    badge.className = 'supabase-badge';
    badge.innerHTML = `
      <span class="supabase-badge-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.362 9.354H12V.312a.312.312 0 0 0-.582-.16L2.43 14.646A.312.312 0 0 0 2.638 15.1h9.362v9.042a.312.312 0 0 0 .582.16l8.988-14.494a.312.312 0 0 0-.208-.454Z"/>
        </svg>
      </span>
      <span class="supabase-badge-dot"></span>
      <span class="supabase-badge-text">Supabase: Đang kết nối...</span>
    `;

    badge.addEventListener('click', showSupabaseModal);

    // Insert before the user profile button
    const userMenuWrapper = headerRight.querySelector('.user-menu-wrapper');
    if (userMenuWrapper) {
      headerRight.insertBefore(badge, userMenuWrapper);
    } else {
      headerRight.appendChild(badge);
    }
  }

  updateSupabaseBadgeUI();
}

/**
 * Update Supabase Badge UI based on current status
 */
export function updateSupabaseBadgeUI() {
  const badge = document.getElementById('supabaseStatusBadge');
  if (!badge) return;

  const dot = badge.querySelector('.supabase-badge-dot');
  const text = badge.querySelector('.supabase-badge-text');

  badge.className = 'supabase-badge';

  if (!connectionStatus.tested) {
    badge.classList.add('status-pending');
    if (text) text.textContent = 'Supabase: Đang kết nối...';
  } else if (connectionStatus.ok && connectionStatus.tablesReady) {
    badge.classList.add('status-online');
    if (text) text.textContent = `Supabase: Online (${connectionStatus.latency}ms)`;
  } else if (connectionStatus.ok && !connectionStatus.tablesReady) {
    badge.classList.add('status-warning');
    if (text) text.textContent = 'Supabase: Cần tạo bảng SQL';
  } else {
    badge.classList.add('status-offline');
    if (text) text.textContent = 'Supabase: Mất kết nối';
  }
}

/**
 * Show Supabase Management Modal
 */
export function showSupabaseModal() {
  let modal = document.getElementById('supabaseModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'supabaseModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 620px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#3ecf8e">
              <path d="M21.362 9.354H12V.312a.312.312 0 0 0-.582-.16L2.43 14.646A.312.312 0 0 0 2.638 15.1h9.362v9.042a.312.312 0 0 0 .582.16l8.988-14.494a.312.312 0 0 0-.208-.454Z"/>
            </svg>
            <h3 class="modal-title">Thông tin kết nối Supabase</h3>
          </div>
          <button type="button" id="closeSupabaseModal" class="modal-close-btn">&times;</button>
        </div>
        
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
          <div style="background: var(--bg-hover); border-radius: var(--radius-control); padding: 12px 14px; font-size: 0.875rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: var(--text-muted); font-weight: 500;">Project URL:</span>
              <strong style="font-family: monospace; color: var(--text-primary);">${activeConfig.url}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: var(--text-muted); font-weight: 500;">Project ID:</span>
              <strong style="font-family: monospace; color: var(--text-primary);">${activeConfig.projectId}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: var(--text-muted); font-weight: 500;">Trạng thái kết nối:</span>
              <span id="modalSupabaseStatusText" style="font-weight: 600;">Đang kiểm tra...</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted); font-weight: 500;">Độ trễ (Latency):</span>
              <span id="modalSupabaseLatency">${connectionStatus.latency} ms</span>
            </div>
          </div>

          <div id="missingTablesNotice" style="display: none; background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-control); padding: 12px; font-size: 0.8125rem; color: #92400e; line-height: 1.5;">
            <strong>⚠️ Bảng dữ liệu chưa được khởi tạo trong Supabase:</strong><br>
            Supabase đã kết nối thành công, nhưng bảng <code>public.users</code> chưa có trong cơ sở dữ liệu.
            Vui lòng mở <strong>Supabase Dashboard -> SQL Editor</strong>, dán mã từ file <code>supabase_schema.sql</code> và bấm <strong>Run</strong>.
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button type="button" id="retestSupabaseBtn" class="btn btn-secondary">
              🔄 Kiểm tra kết nối lại
            </button>
            <button type="button" id="syncSupabaseDataBtn" class="btn btn-secondary">
              👥 Đồng bộ tài khoản lên Supabase
            </button>
            <button type="button" id="syncSupabaseVideosBtn" class="btn btn-secondary" style="grid-column: span 2;">
              🎬 Đồng bộ toàn bộ Video lên Supabase
            </button>
          </div>
          <div>
            <a href="https://supabase.com/dashboard/project/${activeConfig.projectId}/sql/new" target="_blank" rel="noopener" class="btn btn-primary" style="width: 100%; text-align: center; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
              ⚡ Mở Supabase SQL Editor để chạy schema
            </a>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label style="font-size: 0.8125rem; font-weight: 600; color: var(--text-primary);">Mã SQL khởi tạo bảng (supabase_schema.sql):</label>
              <button type="button" id="copySqlBtn" class="btn btn-ghost" style="font-size: 0.75rem; padding: 4px 8px;">📋 Sao chép SQL</button>
            </div>
            <textarea id="sqlSchemaPreview" readonly style="width: 100%; height: 140px; font-family: monospace; font-size: 0.75rem; padding: 10px; border-radius: var(--radius-control); border: 1px solid var(--border-color); background: #f8fafc; resize: vertical;"></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" id="doneSupabaseModal" class="btn btn-secondary">Đóng</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('#closeSupabaseModal').addEventListener('click', () => modal.classList.remove('open'));
    modal.querySelector('#doneSupabaseModal').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    modal.querySelector('#retestSupabaseBtn').addEventListener('click', async () => {
      const btn = modal.querySelector('#retestSupabaseBtn');
      btn.textContent = '⏳ Đang kiểm tra...';
      btn.disabled = true;
      await testSupabaseConnection();
      refreshModalContent();
      btn.textContent = '🔄 Kiểm tra kết nối lại';
      btn.disabled = false;
    });

    modal.querySelector('#syncSupabaseDataBtn').addEventListener('click', async () => {
      const btn = modal.querySelector('#syncSupabaseDataBtn');
      btn.textContent = '⏳ Đang đồng bộ...';
      btn.disabled = true;
      try {
        const { syncAllLocalUsersToSupabase } = await import('./users-repository.js');
        const res = await syncAllLocalUsersToSupabase();
        if (res.synced > 0) {
          alert(`✅ Đã đồng bộ thành công ${res.synced}/${res.total} tài khoản lên Supabase!`);
        } else {
          alert(`⚠️ Chưa thể đồng bộ. Vui lòng đảm bảo bảng public.users đã được tạo bằng cách chạy file SQL trên Supabase.`);
        }
      } catch (err) {
        alert('❌ Lỗi đồng bộ: ' + err.message);
      } finally {
        btn.textContent = '👥 Đồng bộ tài khoản lên Supabase';
        btn.disabled = false;
      }
    });

    modal.querySelector('#syncSupabaseVideosBtn').addEventListener('click', async () => {
      const btn = modal.querySelector('#syncSupabaseVideosBtn');
      btn.textContent = '⏳ Đang đồng bộ video...';
      btn.disabled = true;
      try {
        const { syncAllVideosToSupabase } = await import('./videos-repository.js');
        const res = await syncAllVideosToSupabase();
        if (res.synced > 0) {
          alert(`✅ Đã đồng bộ thành công ${res.synced}/${res.total} video lên Supabase!`);
        } else {
          alert(`⚠️ Không có video nào được đồng bộ. Vui lòng đảm bảo bảng public.videos đã được tạo trên Supabase.`);
        }
      } catch (err) {
        alert('❌ Lỗi đồng bộ video: ' + err.message);
      } finally {
        btn.textContent = '🎬 Đồng bộ toàn bộ Video lên Supabase';
        btn.disabled = false;
      }
    });

    modal.querySelector('#copySqlBtn').addEventListener('click', () => {
      const textarea = modal.querySelector('#sqlSchemaPreview');
      navigator.clipboard.writeText(textarea.value).then(() => {
        const copyBtn = modal.querySelector('#copySqlBtn');
        copyBtn.textContent = '✅ Đã sao chép!';
        setTimeout(() => { copyBtn.textContent = '📋 Sao chép SQL'; }, 2000);
      });
    });

    // Load SQL schema text
    fetch('/supabase_schema.sql')
      .then(res => res.text())
      .then(sql => {
        const preview = modal.querySelector('#sqlSchemaPreview');
        if (preview) preview.value = sql;
      })
      .catch(() => {});
  }

  refreshModalContent();
  modal.classList.add('open');
}

function refreshModalContent() {
  const modal = document.getElementById('supabaseModal');
  if (!modal) return;

  const statusText = modal.querySelector('#modalSupabaseStatusText');
  const latencyText = modal.querySelector('#modalSupabaseLatency');
  const notice = modal.querySelector('#missingTablesNotice');

  if (latencyText) latencyText.textContent = `${connectionStatus.latency} ms`;

  if (statusText) {
    if (connectionStatus.ok && connectionStatus.tablesReady) {
      statusText.innerHTML = '<span style="color: var(--success);">🟢 Đã kết nối & Bảng sẵn sàng</span>';
      if (notice) notice.style.display = 'none';
    } else if (connectionStatus.ok && !connectionStatus.tablesReady) {
      statusText.innerHTML = '<span style="color: #d97706;">🟡 Đã kết nối (Chưa có bảng)</span>';
      if (notice) notice.style.display = 'block';
    } else {
      statusText.innerHTML = `<span style="color: var(--danger);">🔴 Lỗi kết nối (${connectionStatus.message})</span>`;
      if (notice) notice.style.display = 'none';
    }
  }
}
