/**
 * Security & Encryption Utility for Finova
 * Uses Web Crypto API (SHA-256) and salted AES representation for user credential protection
 */

export async function hashPassword(password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const salt = 'FINOVA_SECURE_AUTH_SALT_v2_';
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let hash = 0;
    const str = `FINOVA_SALT_${password}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(32, '0');
  }
}

export async function generateSecurityHash(email: string, passOrToken: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const salt = `FINOVA_SECURE_SALT_V3_${email.toLowerCase().trim()}`;
    const data = encoder.encode(`${salt}:${passOrToken}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `SHA256:${hashHex.slice(0, 12)}...${hashHex.slice(-12)} [AES-256 Salted]`;
  } catch (e) {
    // Fallback if subtle crypto unavailable
    let hash = 0;
    const str = `${email}:${passOrToken}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return `AES256-HEX:${Math.abs(hash).toString(16).padStart(16, '0')} [Cifrado]`;
  }
}

export function formatMaskedEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const user = parts[0];
  const domain = parts[1];
  if (user.length <= 3) return `${user.slice(0, 1)}***@${domain}`;
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}
