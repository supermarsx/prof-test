/**
 * Secure key storage.
 * 
 * In the Tauri backend (sidecar), we don't have direct access to OS-level
 * credential stores like Electron's safeStorage. Instead, we use:
 * - Base64 encoding as the default fallback (same as the previous Electron fallback)
 * - In production, the Tauri Rust layer can provide OS-level encryption
 *   via tauri-plugin-stronghold or native keychain bindings.
 * 
 * The encrypt/decrypt interface remains the same for backward compatibility.
 */

import crypto from 'crypto';

// Derive a machine-specific key from environment (hostname + username)
// This is NOT cryptographically secure but provides obfuscation beyond plain base64.
// In production, Tauri's stronghold plugin should be used instead.
function getMachineKey(): Buffer {
  const raw = `proftest:${process.env.COMPUTERNAME || process.env.HOSTNAME || 'local'}:${process.env.USERNAME || process.env.USER || 'user'}`;
  return crypto.createHash('sha256').update(raw).digest();
}

export function isEncryptionAvailable(): boolean {
  // Node crypto is always available
  return true;
}

export function encryptApiKey(plaintext: string): string {
  if (!plaintext) return '';
  try {
    const key = getMachineKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return 'enc:' + iv.toString('base64') + ':' + encrypted;
  } catch {
    // Fallback: base64 encode
    return 'b64:' + Buffer.from(plaintext, 'utf-8').toString('base64');
  }
}

export function decryptApiKey(stored: string): string {
  if (!stored) return '';
  if (stored.startsWith('enc:')) {
    try {
      const parts = stored.slice(4).split(':');
      if (parts.length === 2) {
        const iv = Buffer.from(parts[0], 'base64');
        const encrypted = parts[1];
        const key = getMachineKey();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
      // Old Electron format: enc:<base64> — try base64 decode
      return Buffer.from(parts[0], 'base64').toString('utf-8');
    } catch {
      return '';
    }
  }
  if (stored.startsWith('b64:')) {
    return Buffer.from(stored.slice(4), 'base64').toString('utf-8');
  }
  // Legacy plaintext - return as-is
  return stored;
}
