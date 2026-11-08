/**
 * Authentication Service integrating Supabase Auth with Local SQLite.
 * Supports email recovery via Supabase Auth, login, registration, and session management.
 */
import {
  getUserByEmail,
  getUserById,
  createUser,
  updateUserPasswordAndRecovery,
  updateLastLogin,
  countUsers
} from '../db/users-repository.js';
import {
  generateRandomSalt,
  generateRecoveryCode,
  hashWithSalt,
  verifyHash
} from './crypto.js';
import { setSession, clearSession } from '../core/router-guard.js';
import { initSupabase, getSupabase } from '../db/supabase-client.js';

export async function hasAnyUser() {
  const count = await countUsers();
  return count > 0;
}

/**
 * Send password reset email via Supabase Auth
 * @param {string} email
 * @param {string} redirectTo Full URL back to reset-password.html
 */
export async function sendPasswordResetEmail(email, redirectTo) {
  const normalizedEmail = email.trim().toLowerCase();
  const client = await initSupabase();

  if (!client) {
    throw new Error('Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra lại kết nối mạng.');
  }

  const { data, error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo
  });

  if (error) {
    if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
      throw new Error('Bạn đã yêu cầu gửi email quá nhanh hoặc vượt quá giới hạn gửi email của Supabase. Vui lòng thử lại sau ít phút hoặc cấu hình Custom SMTP.');
    }
    if (error.code === 'email_address_invalid') {
      throw new Error('Địa chỉ email không hợp lệ hoặc thuộc tên miền không được Supabase chấp nhận.');
    }
    throw new Error(error.message || 'Không thể gửi email đặt lại mật khẩu.');
  }

  return { success: true, data };
}

/**
 * Update user password with Supabase Auth
 * @param {string} newPassword
 */
export async function updatePassword(newPassword) {
  const client = await initSupabase();

  if (!client) {
    throw new Error('Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra lại kết nối mạng.');
  }

  const { data, error } = await client.auth.updateUser({
    password: newPassword
  });

  if (error) {
    if (error.status === 422 || error.message?.includes('weak')) {
      throw new Error('Mật khẩu không đáp ứng chính sách bảo mật của Supabase: ' + error.message);
    }
    if (error.status === 401 || error.status === 403 || error.message?.includes('session')) {
      throw new Error('Phiên khôi phục không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại liên kết mới.');
    }
    throw new Error(error.message || 'Không thể cập nhật mật khẩu mới.');
  }

  // Also update local SQLite hash if user exists locally
  if (data?.user?.email) {
    try {
      const localUser = await getUserByEmail(data.user.email);
      if (localUser) {
        const newSalt = generateRandomSalt();
        const newHash = await hashWithSalt(newPassword, newSalt);
        await updateUserPasswordAndRecovery(
          localUser.id,
          newHash,
          newSalt,
          localUser.recovery_hash,
          localUser.recovery_salt
        );
      }
    } catch (e) {
      console.warn('[Auth Service] SQLite password sync warning:', e);
    }
  }

  return { success: true, user: data?.user };
}

/**
 * Sign in user: Priority Supabase Auth -> Fallback Local SQLite
 */
export async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const client = await initSupabase();

  let supabaseUser = null;
  let supabaseAuthError = null;

  // 1. Try Supabase Auth first
  if (client) {
    try {
      const res = await client.auth.signInWithPassword({
        email: normalizedEmail,
        password: password
      });

      if (!res.error && res.data?.user) {
        supabaseUser = res.data.user;
      } else {
        supabaseAuthError = res.error;
      }
    } catch (err) {
      supabaseAuthError = err;
    }
  }

  // If Supabase Auth succeeded
  if (supabaseUser) {
    let localUser = await getUserByEmail(normalizedEmail);
    if (!localUser) {
      // Auto-create local user profile
      const localId = supabaseUser.id || crypto.randomUUID();
      const defaultRole = normalizedEmail === 'admin@demo.com' ? 'admin' : 'user';
      const salt = generateRandomSalt();
      const hash = await hashWithSalt(password, salt);
      const recSalt = generateRandomSalt();
      const recHash = await hashWithSalt(generateRecoveryCode(), recSalt);

      localUser = await createUser({
        id: localId,
        full_name: supabaseUser.user_metadata?.full_name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password_hash: hash,
        password_salt: salt,
        recovery_hash: recHash,
        recovery_salt: recSalt,
        role: defaultRole
      });
    }

    await updateLastLogin(localUser.id);
    setSession(localUser);
    return localUser;
  }

  // 2. Fallback to Local SQLite (for local demo accounts)
  const localUser = await getUserByEmail(normalizedEmail);
  if (localUser) {
    const isValid = await verifyHash(password, localUser.password_salt, localUser.password_hash);
    if (isValid) {
      await updateLastLogin(localUser.id);
      setSession(localUser);

      // Auto-sync this account to Supabase public.users and Supabase Auth
      if (client) {
        import('../db/supabase-client.js').then(({ syncUserToSupabase }) => {
          syncUserToSupabase(localUser).catch(e => console.warn('[Supabase auto-sync user error]', e));
        });
        client.auth.signUp({
          email: normalizedEmail,
          password: password,
          options: { data: { full_name: localUser.full_name } }
        }).catch(() => {});
      }

      return localUser;
    }
  }

  throw new Error('Email hoặc mật khẩu chưa chính xác.');
}

/**
 * Register user: Syncs to both Supabase Auth and Local SQLite
 */
export async function register({ fullName, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  // Check unique email in local SQLite
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error('Email này đã được đăng ký. Vui lòng sử dụng email khác.');
  }

  const client = await initSupabase();

  // Try Supabase Auth sign up
  if (client) {
    try {
      const { data, error } = await client.auth.signUp({
        email: normalizedEmail,
        password: password,
        options: {
          data: { full_name: fullName.trim() }
        }
      });

      if (error && error.code !== 'user_already_exists') {
        console.warn('[Supabase Auth signUp warning]', error);
      }
    } catch (err) {
      console.warn('[Supabase Auth signUp exception]', err);
    }
  }

  // Generate salts and hashes for local SQLite
  const passwordSalt = generateRandomSalt();
  const passwordHash = await hashWithSalt(password, passwordSalt);

  const recoveryCode = generateRecoveryCode();
  const recoverySalt = generateRandomSalt();
  const recoveryHash = await hashWithSalt(recoveryCode, recoverySalt);

  const userId = crypto.randomUUID();

  const user = await createUser({
    id: userId,
    full_name: fullName.trim(),
    email: normalizedEmail,
    password_hash: passwordHash,
    password_salt: passwordSalt,
    recovery_hash: recoveryHash,
    recovery_salt: recoverySalt,
    role: 'user'
  });

  return {
    user,
    recoveryCode
  };
}

/**
 * Reset password with offline recovery code (backward compatibility)
 */
export async function resetPasswordWithRecoveryCode({ email, recoveryCode, newPassword }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await getUserByEmail(normalizedEmail);

  if (!user) {
    throw new Error('Thông tin khôi phục không hợp lệ.');
  }

  const normalizedCode = recoveryCode.trim().toUpperCase();
  const isValidCode = await verifyHash(normalizedCode, user.recovery_salt, user.recovery_hash);

  if (!isValidCode) {
    throw new Error('Mã khôi phục không chính xác.');
  }

  const newPasswordSalt = generateRandomSalt();
  const newPasswordHash = await hashWithSalt(newPassword, newPasswordSalt);

  const newRecoveryCode = generateRecoveryCode();
  const newRecoverySalt = generateRandomSalt();
  const newRecoveryHash = await hashWithSalt(newRecoveryCode, newRecoverySalt);

  await updateUserPasswordAndRecovery(
    user.id,
    newPasswordHash,
    newPasswordSalt,
    newRecoveryHash,
    newRecoverySalt
  );

  return {
    newRecoveryCode
  };
}

export async function logout() {
  try {
    const client = getSupabase();
    if (client) {
      await client.auth.signOut();
    }
  } catch (e) {
    console.warn('[Supabase signOut warning]', e);
  }
  clearSession();
}
