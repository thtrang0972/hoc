import crypto from 'crypto';

// Secret key for HMAC token signing (falls back to a persistent hash if not defined)
const TOKEN_SECRET = process.env.SESSION_SECRET || 'goc-lang-nghe-secure-hmac-key-2026';

// Cryptographically secure token generator for internal session authentication
export function createSignedToken(userId: string, role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'SESSION' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      role,
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

// Verify signed internal session token
export function verifySignedToken(token: string): { uid: string; role: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded || !decoded.uid || !decoded.exp) return null;

    if (Date.now() > decoded.exp) return null; // Token expired

    return { uid: decoded.uid, role: decoded.role };
  } catch {
    return null;
  }
}

// Generate cryptographically strong random ticket code: GLN-XXXX-XXXX (e.g., GLN-K8M2-9P4X)
// Alphanumeric with unambiguous characters (excluding 0, O, I, 1)
export function generateSecureTicketCode(prefix: string = 'GLN'): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let segment1 = '';
  let segment2 = '';
  const bytes = crypto.randomBytes(8);

  for (let i = 0; i < 4; i++) {
    segment1 += chars[bytes[i] % chars.length];
    segment2 += chars[bytes[i + 4] % chars.length];
  }

  return `${prefix}-${segment1}-${segment2}`;
}

// Hash tracking secret code securely with SHA-256
export function hashSecretCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  return crypto.createHash('sha256').update(`salt_phuochung_2026_${normalized}`).digest('hex');
}

// Input sanitizer against XSS and control characters
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>?/gm, '') // Strip all HTML tags
    .replace(/[&<>"'/]/g, (match) => {
      // Basic HTML entity encoding
      switch (match) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#x27;';
        case '/':
          return '&#x2F;';
        default:
          return match;
      }
    })
    .trim();
}

// Strict validators for time and date
export function isValidDateString(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

export function isValidTimeString(timeStr: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr);
}
