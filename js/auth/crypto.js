/**
 * Web Crypto API utilities for PBKDF2 hashing, random salts, and recovery codes.
 */

const PBKDF2_ITERATIONS = 100000;

export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function generateRandomSalt(length = 16) {
  const salt = new Uint8Array(length);
  crypto.getRandomValues(salt);
  return bufferToBase64(salt.buffer);
}

export function generateRecoveryCode() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0').toUpperCase();
  }
  // Format as 4 groups of 6 chars, e.g. ABCD12-EF3456-7890AB-CDEF12
  return `${hex.slice(0, 6)}-${hex.slice(6, 12)}-${hex.slice(12, 18)}-${hex.slice(18, 24)}`;
}

export async function hashWithSalt(text, saltBase64) {
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(text);
  const saltBuffer = base64ToBuffer(saltBase64);

  const importedKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    importedKey,
    256
  );

  return bufferToBase64(derivedBits);
}

export async function verifyHash(inputPlain, saltBase64, expectedHashBase64) {
  const computedHash = await hashWithSalt(inputPlain, saltBase64);
  return constantTimeCompare(computedHash, expectedHashBase64);
}

function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
