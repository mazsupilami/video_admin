/**
 * Page controllers for Login, Register, Forgot Password, and Reset Password pages.
 */
import {
  login,
  register,
  sendPasswordResetEmail,
  updatePassword,
  resetPasswordWithRecoveryCode
} from './auth-service.js';
import { redirectIfAuthenticated } from '../core/router-guard.js';
import {
  validateEmail,
  validateFullName,
  validatePassword,
  validateConfirmPassword
} from '../core/validators.js';
import { copyToClipboard, showToast } from '../core/ui-utils.js';
import { initSupabase } from '../db/supabase-client.js';

export function initLoginPage() {
  redirectIfAuthenticated();

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const alertBox = document.getElementById('authAlert');
  const submitBtn = document.getElementById('submitBtn');

  // Supabase Status Badge on Auth Pages
  const supabaseLoginBadge = document.getElementById('supabaseLoginBadge');
  if (supabaseLoginBadge) {
    import('../db/supabase-client.js').then(({ testSupabaseConnection, showSupabaseModal }) => {
      supabaseLoginBadge.id = 'supabaseStatusBadge';
      supabaseLoginBadge.addEventListener('click', showSupabaseModal);
      testSupabaseConnection().catch(() => {});
    });
  }

  function clearErrors() {
    if (emailError) emailError.textContent = '';
    if (passwordError) passwordError.textContent = '';
    if (alertBox) {
      alertBox.textContent = '';
      alertBox.style.display = 'none';
    }
  }

  const btnFillAdmin = document.getElementById('btnFillAdmin');
  const btnFillUser2 = document.getElementById('btnFillUser2');

  if (btnFillAdmin) {
    btnFillAdmin.addEventListener('click', () => {
      clearErrors();
      emailInput.value = 'admin@demo.com';
      passwordInput.value = 'Admin@123456';
    });
  }

  if (btnFillUser2) {
    btnFillUser2.addEventListener('click', () => {
      clearErrors();
      emailInput.value = 'user2@demo.com';
      passwordInput.value = 'User@123456';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const emailVal = emailInput.value.trim();
      const passwordVal = passwordInput.value;

      const errEmail = validateEmail(emailVal);
      if (errEmail) {
        if (emailError) emailError.textContent = errEmail;
        emailInput.focus();
        return;
      }

      const errPassword = validatePassword(passwordVal);
      if (errPassword) {
        if (passwordError) passwordError.textContent = errPassword;
        passwordInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang đăng nhập...';

      try {
        await login({ email: emailVal, password: passwordVal });
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get('redirect') ? decodeURIComponent(params.get('redirect')) : 'dashboard.html';
        window.location.href = redirectUrl;
      } catch (err) {
        if (alertBox) {
          alertBox.textContent = err.message || 'Email hoặc mật khẩu chưa chính xác.';
          alertBox.style.display = 'block';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đăng nhập';
      }
    });
  }
}

export function initRegisterPage() {
  redirectIfAuthenticated();

  const form = document.getElementById('registerForm');
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');

  const fullNameError = document.getElementById('fullNameError');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const confirmPasswordError = document.getElementById('confirmPasswordError');
  const alertBox = document.getElementById('authAlert');
  const submitBtn = document.getElementById('submitBtn');

  // Supabase Status Badge on Auth Pages
  const supabaseLoginBadge = document.getElementById('supabaseLoginBadge');
  if (supabaseLoginBadge) {
    import('../db/supabase-client.js').then(({ testSupabaseConnection, showSupabaseModal }) => {
      supabaseLoginBadge.id = 'supabaseStatusBadge';
      supabaseLoginBadge.addEventListener('click', showSupabaseModal);
      testSupabaseConnection().catch(() => {});
    });
  }

  // Modal elements
  const recoveryModal = document.getElementById('recoveryModal');
  const recoveryCodeText = document.getElementById('recoveryCodeText');
  const copyRecoveryBtn = document.getElementById('copyRecoveryBtn');
  const confirmSavedCheck = document.getElementById('confirmSavedCheck');
  const proceedToLoginBtn = document.getElementById('proceedToLoginBtn');

  function clearErrors() {
    if (fullNameError) fullNameError.textContent = '';
    if (emailError) emailError.textContent = '';
    if (passwordError) passwordError.textContent = '';
    if (confirmPasswordError) confirmPasswordError.textContent = '';
    if (alertBox) {
      alertBox.textContent = '';
      alertBox.style.display = 'none';
    }
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const fullNameVal = fullNameInput.value.trim();
      const emailVal = emailInput.value.trim();
      const passwordVal = passwordInput.value;
      const confirmVal = confirmPasswordInput.value;

      const errName = validateFullName(fullNameVal);
      if (errName) {
        if (fullNameError) fullNameError.textContent = errName;
        fullNameInput.focus();
        return;
      }

      const errEmail = validateEmail(emailVal);
      if (errEmail) {
        if (emailError) emailError.textContent = errEmail;
        emailInput.focus();
        return;
      }

      const errPassword = validatePassword(passwordVal);
      if (errPassword) {
        if (passwordError) passwordError.textContent = errPassword;
        passwordInput.focus();
        return;
      }

      const errConfirm = validateConfirmPassword(passwordVal, confirmVal);
      if (errConfirm) {
        if (confirmPasswordError) confirmPasswordError.textContent = errConfirm;
        confirmPasswordInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang khởi tạo tài khoản...';

      try {
        const { recoveryCode } = await register({
          fullName: fullNameVal,
          email: emailVal,
          password: passwordVal
        });

        // Show recovery code modal
        if (recoveryCodeText) recoveryCodeText.textContent = recoveryCode;
        if (recoveryModal) recoveryModal.classList.add('open');
      } catch (err) {
        if (alertBox) {
          alertBox.textContent = err.message || 'Lỗi đăng ký tài khoản.';
          alertBox.style.display = 'block';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đăng ký tài khoản';
      }
    });
  }

  if (copyRecoveryBtn && recoveryCodeText) {
    copyRecoveryBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(recoveryCodeText.textContent);
      if (ok) {
        showToast('Đã sao chép mã khôi phục vào bộ nhớ tạm!', 'success');
      }
    });
  }

  if (confirmSavedCheck && proceedToLoginBtn) {
    confirmSavedCheck.addEventListener('change', () => {
      proceedToLoginBtn.disabled = !confirmSavedCheck.checked;
    });

    proceedToLoginBtn.addEventListener('click', () => {
      window.location.href = 'login.html';
    });
  }
}

/**
 * Controller for forgot-password.html
 */
export function initForgotPasswordPage() {
  redirectIfAuthenticated();

  const form = document.getElementById('forgotForm');
  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('emailError');
  const alertBox = document.getElementById('authAlert');
  const submitBtn = document.getElementById('submitBtn');
  const successNotice = document.getElementById('successNotice');
  const sentEmailDisplay = document.getElementById('sentEmailDisplay');
  const resendBtn = document.getElementById('resendBtn');

  // Supabase Status Badge on Auth Pages
  const supabaseLoginBadge = document.getElementById('supabaseLoginBadge');
  if (supabaseLoginBadge) {
    import('../db/supabase-client.js').then(({ testSupabaseConnection, showSupabaseModal }) => {
      supabaseLoginBadge.id = 'supabaseStatusBadge';
      supabaseLoginBadge.addEventListener('click', showSupabaseModal);
      testSupabaseConnection().catch(() => {});
    });
  }

  function clearErrors() {
    if (emailError) emailError.textContent = '';
    if (alertBox) {
      alertBox.textContent = '';
      alertBox.style.display = 'none';
    }
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const emailVal = emailInput.value.trim();
      const errEmail = validateEmail(emailVal);
      if (errEmail) {
        if (emailError) emailError.textContent = errEmail;
        emailInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang gửi liên kết...';

      try {
        // Calculate clean redirect URL to reset-password.html on the current origin
        const redirectTo = new URL('reset-password.html', window.location.origin).href;

        await sendPasswordResetEmail(emailVal, redirectTo);

        // Show neutral success notification
        if (form) form.style.display = 'none';
        if (sentEmailDisplay) sentEmailDisplay.textContent = emailVal;
        if (successNotice) successNotice.style.display = 'block';
      } catch (err) {
        if (alertBox) {
          alertBox.textContent = err.message || 'Không thể gửi email đặt lại mật khẩu.';
          alertBox.style.display = 'block';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Gửi liên kết đặt lại mật khẩu';
      }
    });
  }

  if (resendBtn) {
    resendBtn.addEventListener('click', () => {
      if (successNotice) successNotice.style.display = 'none';
      if (form) {
        form.style.display = 'block';
        if (emailInput) emailInput.focus();
      }
    });
  }

  // Offline recovery fallback form
  const offlineForm = document.getElementById('offlineRecoveryForm');
  if (offlineForm) {
    offlineForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const offEmail = document.getElementById('offlineEmail')?.value?.trim();
      const offCode = document.getElementById('offlineCode')?.value?.trim();
      const offPass = document.getElementById('offlinePass')?.value;

      if (!offEmail || !offCode || !offPass) {
        alert('Vui lòng điền đầy đủ email, mã khôi phục và mật khẩu mới.');
        return;
      }

      const offBtn = document.getElementById('offlineSubmitBtn');
      if (offBtn) {
        offBtn.disabled = true;
        offBtn.textContent = 'Đang xử lý...';
      }

      try {
        await resetPasswordWithRecoveryCode({
          email: offEmail,
          recoveryCode: offCode,
          newPassword: offPass
        });
        alert('✅ Đổi mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
        window.location.href = 'login.html';
      } catch (err) {
        alert('❌ Lỗi: ' + err.message);
      } finally {
        if (offBtn) {
          offBtn.disabled = false;
          offBtn.textContent = 'Đổi mật khẩu offline';
        }
      }
    });
  }
}

/**
 * Controller for reset-password.html
 */
export function initResetPasswordPage() {
  const verifyingState = document.getElementById('verifyingState');
  const invalidLinkState = document.getElementById('invalidLinkState');
  const resetPasswordForm = document.getElementById('resetPasswordForm');
  const resetSuccessState = document.getElementById('resetSuccessState');

  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const newPasswordError = document.getElementById('newPasswordError');
  const confirmPasswordError = document.getElementById('confirmPasswordError');
  const alertBox = document.getElementById('authAlert');
  const submitBtn = document.getElementById('submitBtn');

  let isRecoverySessionValid = false;

  function showResetForm() {
    isRecoverySessionValid = true;
    if (verifyingState) verifyingState.style.display = 'none';
    if (invalidLinkState) invalidLinkState.style.display = 'none';
    if (resetPasswordForm) resetPasswordForm.style.display = 'block';
    if (newPasswordInput) newPasswordInput.focus();
  }

  function showInvalidState(errorMsg = '') {
    if (isRecoverySessionValid) return;
    if (verifyingState) verifyingState.style.display = 'none';
    if (resetPasswordForm) resetPasswordForm.style.display = 'none';
    if (invalidLinkState) invalidLinkState.style.display = 'block';
    if (errorMsg && alertBox) {
      alertBox.textContent = errorMsg;
      alertBox.style.display = 'block';
    }
  }

  function clearErrors() {
    if (newPasswordError) newPasswordError.textContent = '';
    if (confirmPasswordError) confirmPasswordError.textContent = '';
    if (alertBox) {
      alertBox.textContent = '';
      alertBox.style.display = 'none';
    }
  }

  // Toggle show/hide password buttons
  document.querySelectorAll('.btn-toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      const eyeOpen = btn.querySelector('.eye-open');
      const eyeClosed = btn.querySelector('.eye-closed');

      if (input.type === 'password') {
        input.type = 'text';
        if (eyeOpen) eyeOpen.style.display = 'none';
        if (eyeClosed) eyeClosed.style.display = 'inline';
      } else {
        input.type = 'password';
        if (eyeOpen) eyeOpen.style.display = 'inline';
        if (eyeClosed) eyeClosed.style.display = 'none';
      }
    });
  });

  // Start verifying recovery link
  async function verifyRecoveryLink() {
    const client = await initSupabase();
    if (!client) {
      showInvalidState('Không thể khởi tạo kết nối đến Supabase. Vui lòng kiểm tra lại kết nối mạng.');
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const hash = window.location.hash || '';

    // Check for PKCE code in query string
    if (code) {
      try {
        const { data, error } = await client.auth.exchangeCodeForSession(code);
        if (!error && data?.session) {
          showResetForm();
          return;
        } else if (error) {
          console.warn('[Recovery PKCE exchange error]', error);
          showInvalidState('Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng.');
          return;
        }
      } catch (err) {
        console.warn('[Recovery PKCE exception]', err);
      }
    }

    // Check for implicit grant fragment (#access_token=...&type=recovery)
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      // Listen for PASSWORD_RECOVERY event
      const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && hash.includes('type=recovery'))) {
          showResetForm();
        }
      });

      // Also check immediate session
      const { data: { session } } = await client.auth.getSession();
      if (session) {
        showResetForm();
        return;
      }
    }

    // Fallback: check if active recovery session is present
    try {
      const { data: { session } } = await client.auth.getSession();
      if (session && (hash.includes('type=recovery') || code)) {
        showResetForm();
        return;
      }
    } catch (e) {}

    // If still not verified after timeout, mark as invalid link
    setTimeout(() => {
      if (!isRecoverySessionValid) {
        showInvalidState();
      }
    }, 2500);
  }

  // Handle Form Submission
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const passVal = newPasswordInput.value;
      const confirmVal = confirmPasswordInput.value;

      const errPass = validatePassword(passVal);
      if (errPass) {
        if (newPasswordError) newPasswordError.textContent = errPass;
        newPasswordInput.focus();
        return;
      }

      const errConfirm = validateConfirmPassword(passVal, confirmVal);
      if (errConfirm) {
        if (confirmPasswordError) confirmPasswordError.textContent = errConfirm;
        confirmPasswordInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang cập nhật mật khẩu mới...';

      try {
        await updatePassword(passVal);

        // Sign out recovery session to require fresh login
        const client = await initSupabase();
        if (client) {
          await client.auth.signOut().catch(() => {});
        }

        // Show success state
        if (resetPasswordForm) resetPasswordForm.style.display = 'none';
        if (resetSuccessState) resetSuccessState.style.display = 'block';
      } catch (err) {
        if (alertBox) {
          alertBox.textContent = err.message || 'Không thể cập nhật mật khẩu. Vui lòng thử lại.';
          alertBox.style.display = 'block';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Cập nhật mật khẩu mới';
      }
    });
  }

  verifyRecoveryLink();
}
