/**
 * Universal Cryptographic Security Utilities
 * Works synchronously and seamlessly in both Node.js (Server) and Browser (Vite/React).
 * Provides salted SHA-256 PIN hashing, constant-time verification, and session token generation.
 */

// Pure TypeScript SHA-256 implementation (zero external dependencies)
function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  // Initial hash values: first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19
  let hash: number[] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  // First 32 bits of the fractional parts of the cube roots of the first 64 primes 2..311
  const k: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (i = 0; i < ascii.length; i++) {
    const code = ascii.charCodeAt(i);
    words[i >> 2] |= (code & 0xff) << (24 - (i % 4) * 8);
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  const w: number[] = new Array(64);

  for (i = 0; i < words.length; i += 16) {
    const oldHash = [...hash];

    for (j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] | 0;
      } else {
        const gamma0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const gamma1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = ((w[j - 16] + gamma0) | 0) + ((w[j - 7] + gamma1) | 0);
      }

      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1 + ch + k[j] + w[j]) | 0;
      const s0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0 + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const byte = (hash[i] >> (j * 8)) & 0xff;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }

  return result;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Generates an 8-byte random hex salt
 */
export function generateSalt(): string {
  let salt = '';
  for (let i = 0; i < 4; i++) {
    salt += Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  }
  return salt.slice(0, 16);
}

/**
 * Hashes a staff PIN or password with a salt.
 * Output format: "salt:hash"
 */
export function hashPin(pin: string, existingSalt?: string): string {
  const salt = existingSalt || generateSalt();
  const cleanPin = pin.trim();
  const hash = sha256(`${salt}_KIID_POS_${cleanPin}`);
  return `${salt}:${hash}`;
}

/**
 * Determines whether a stored value is already a salted hash
 */
export function isHashedPin(storedValue: string): boolean {
  if (!storedValue || typeof storedValue !== 'string') return false;
  const parts = storedValue.split(':');
  return parts.length === 2 && parts[0].length === 16 && parts[1].length === 64;
}

/**
 * Verifies an entered PIN against a stored value.
 * Handles both newly hashed PINs ("salt:hash") and legacy plaintext PINs seamlessly.
 */
export function verifyPin(enteredPin: string, storedValue: string): boolean {
  const cleanEntered = String(enteredPin || '').trim();
  const cleanStored = String(storedValue || '').trim();

  if (!cleanEntered || !cleanStored) {
    return false;
  }

  if (isHashedPin(cleanStored)) {
    const [salt, expectedHash] = cleanStored.split(':');
    const computed = sha256(`${salt}_KIID_POS_${cleanEntered}`);
    return timingSafeEqual(computed, expectedHash);
  }

  // Legacy plaintext fallback check
  return timingSafeEqual(cleanEntered, cleanStored);
}

const SECRET_APP_KEY = (typeof process !== 'undefined' && process.env && process.env.SESSION_SECRET) 
  ? process.env.SESSION_SECRET 
  : 'KIID_FROM_DREAM_COLD_ROOM_2026_SECRET';

/**
 * Generates a signed bearer session token for authenticated API requests
 * Format: staffId.role.expiresAt.signature
 */
export function createSessionToken(staffId: string, role: string, ttlHours: number = 14): string {
  const expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
  const payload = `${staffId}.${role}.${expiresAt}`;
  const signature = sha256(`${payload}.${SECRET_APP_KEY}`).slice(0, 32);
  return `${payload}.${signature}`;
}

/**
 * Validates a session token
 */
export function verifySessionToken(token: string): { valid: boolean; staffId?: string; role?: string; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'No token provided' };
  }

  const parts = token.split('.');
  if (parts.length !== 4) {
    return { valid: false, error: 'Malformed token structure' };
  }

  const [staffId, role, expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);

  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return { valid: false, error: 'Session token has expired' };
  }

  const expectedSignature = sha256(`${staffId}.${role}.${expiresAt}.${SECRET_APP_KEY}`).slice(0, 32);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return { valid: false, error: 'Invalid token signature' };
  }

  return { valid: true, staffId, role };
}
