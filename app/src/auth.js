// Single-user login. Credentials come from env vars only (never the repo):
//   AUTH_EMAIL           the one allowed login
//   AUTH_PASSWORD_HASH   scrypt hash from `npm run hash-password` (preferred)
//   AUTH_PASSWORD        plain password (fallback, if no hash is set)
//   SESSION_SECRET       optional; signs the session cookie (derived if unset)
// With no AUTH_EMAIL set, login is off (local development).
import { scryptSync, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';

const EMAIL = (process.env.AUTH_EMAIL || '').trim().toLowerCase();
const rawHash = (process.env.AUTH_PASSWORD_HASH || '').trim();
// A plain password typed into AUTH_PASSWORD_HASH by mistake is used as-is
// rather than locking the owner out.
const HASH = rawHash.startsWith('scrypt$') ? rawHash : '';
const PLAIN = process.env.AUTH_PASSWORD || (rawHash && !HASH ? rawHash : '');
if (rawHash && !HASH) console.warn('  AUTH_PASSWORD_HASH is not a scrypt$ hash — treating it as the plain password. Run `npm run hash-password` to store a hash instead.');
const SECRET = process.env.SESSION_SECRET || createHash('sha256').update('finbot100|' + EMAIL + '|' + (HASH || PLAIN)).digest('hex');
const COOKIE = 'fb_session';
const MAX_AGE_S = 30 * 86400;

export const authEnabled = Boolean(EMAIL && (HASH || PLAIN));
export const authMisconfigured = Boolean(EMAIL) && !authEnabled;

export function hashPassword(pw) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(pw, salt, 64).toString('hex')}`;
}

function passwordOk(pw) {
  if (HASH) {
    const [kind, saltHex, hashHex] = HASH.split('$');
    if (kind !== 'scrypt' || !saltHex || !hashHex) return false;
    const want = Buffer.from(hashHex, 'hex');
    const got = scryptSync(String(pw), Buffer.from(saltHex, 'hex'), want.length);
    return timingSafeEqual(got, want);
  }
  const a = createHash('sha256').update(String(pw)).digest();
  const b = createHash('sha256').update(PLAIN).digest();
  return timingSafeEqual(a, b);
}

// Brute-force guard: 5 failures per IP → locked for 15 minutes.
const fails = new Map(); // ip -> { n, until }
function locked(ip) {
  const f = fails.get(ip);
  return f && f.until > Date.now();
}
function fail(ip) {
  const f = fails.get(ip) || { n: 0, until: 0 };
  f.n++;
  if (f.n >= 5) { f.until = Date.now() + 15 * 60000; f.n = 0; }
  fails.set(ip, f);
}

const sign = (v) => createHmac('sha256', SECRET).update(v).digest('base64url');

function makeToken() {
  const v = `${EMAIL}|${Date.now() + MAX_AGE_S * 1000}`;
  return Buffer.from(v).toString('base64url') + '.' + sign(v);
}

function tokenOk(t) {
  const [b64, sig] = String(t || '').split('.');
  if (!b64 || !sig) return false;
  const v = Buffer.from(b64, 'base64url').toString();
  const good = sign(v);
  if (sig.length !== good.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  const [email, exp] = v.split('|');
  return email === EMAIL && Number(exp) > Date.now();
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
const secure = (req) => req.headers['x-forwarded-proto'] === 'https';

export function isLoggedIn(req) {
  if (authMisconfigured) return false; // email set but no password: stay locked, never open
  return !authEnabled || tokenOk(cookies(req)[COOKIE]);
}

// Returns { status, body, cookie? } for the login API.
export function login(req, { email, password }) {
  const ip = clientIp(req);
  if (authMisconfigured) return { status: 503, body: { error: 'Login is not configured: set AUTH_PASSWORD_HASH (or AUTH_PASSWORD) on the server.' } };
  if (!authEnabled) return { status: 200, body: { ok: true } };
  if (locked(ip)) return { status: 429, body: { error: 'Too many attempts — try again in 15 minutes.' } };
  const emailOk = String(email || '').trim().toLowerCase() === EMAIL;
  const pwOk = passwordOk(password || ''); // always run, so timing doesn't reveal the email
  if (!emailOk || !pwOk) {
    fail(ip);
    return { status: 401, body: { error: 'Wrong email or password.' } };
  }
  fails.delete(ip);
  return { status: 200, body: { ok: true }, cookie: `${COOKIE}=${makeToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure(req) ? '; Secure' : ''}` };
}

export function logoutCookie(req) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(req) ? '; Secure' : ''}`;
}
