/**
 * Tazzet – server.js
 */

'use strict';

require('dotenv').config();

const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[tazzet] FATAL: JWT_SECRET must be set in production.');
  process.exit(1);
}

const JWT_SECRET   = process.env.JWT_SECRET || 'change-this-in-development-only-' + Math.random();
const SALT_ROUNDS  = 12;
const TOKEN_EXPIRY = '30d';

if (!process.env.JWT_SECRET) {
  console.warn('[tazzet] WARNING: JWT_SECRET not set — sessions will not persist across restarts!');
}

/* ── Knowledge Article Creator skill system prompt ──
 * Source of truth: https://www.notion.so/330fcabf7417818ba9d8f0dd3bca6423
 * Update that Notion page to change article generation behaviour.
 ── */
const KA_SKILL_SYSTEM = `You are an expert technical writer. You write knowledge articles for organisational help guides and user support documentation.

CORE RULES — follow these absolutely:
- Plain English. Sentences average 15 to 20 words.
- Active voice. Name who does what.
- Address the reader directly. Use "you" and "we".
- Never use em-dashes anywhere in your output. Use commas, colons, or sentence breaks instead.
- Never use Latin abbreviations (i.e., e.g., etc.). Write them out in full: "for example", "that is", "and so on".
- Use Irish English spelling: "organisation", "colour", "recognise", "behaviour", "programme", "prioritise", "realise".
- "select" not "click". "sign in" not "log in". "set up" (verb, two words) vs "setup" (noun, one word). "email" not "e-mail".
- Use bold (**bold**) for UI element names (buttons, field labels, menu items) only. No other use of bold.
- Do not use italics for emphasis.
- Do not invent specific details. Use placeholders like [confirm with your administrator] if unsure.
- Headings in sentence case: capitalise the first word and proper nouns only.
- One topic per article. Self-contained and standalone.

TASK ARTICLE STRUCTURE:
- Open with one sentence stating what the task achieves.
- List prerequisites before steps.
- Number each step. One action per step only.
- After each step with an expected outcome (a screen changes, a dialogue opens), state the outcome as a separate sentence.
- Close with one sentence beginning "You have now…" stating what the reader has achieved.

CONCEPT ARTICLE STRUCTURE:
- First paragraph: define the concept in plain English.
- Second paragraph: explain why it matters to the reader.
- Third paragraph: one or two concrete examples.

REFERENCE ARTICLE STRUCTURE:
- One intro sentence.
- Use a table with consistent column headings.
- Keep entries consistent in structure and length.`;

/* ── PostgreSQL ── */
let db      = null;
let dbReady = false;

function postgresSslOption() {
  const url = process.env.DATABASE_URL || '';
  if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
  /* Managed Postgres often uses certs Node does not trust; set DATABASE_SSL_REJECT_UNAUTHORIZED=true when you have proper CA trust. */
  const strict = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';
  return { rejectUnauthorized: strict };
}

if (process.env.DATABASE_URL) {
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: postgresSslOption(),
  });
  db.connect()
    .then(async client => {
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL, password_hash TEXT,
            google_id TEXT UNIQUE, avatar_url TEXT,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL DEFAULT 'Untitled',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            data JSONB NOT NULL DEFAULT '{}'
          );
          CREATE INDEX IF NOT EXISTS projects_user_updated ON projects(user_id, updated_at DESC);
          CREATE TABLE IF NOT EXISTS workspace_settings (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            data JSONB NOT NULL DEFAULT '{}',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS reusables (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS reusables_user_type ON reusables(user_id, type);
          CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            colour TEXT NOT NULL DEFAULT '#4E8D99',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS tags_user ON tags(user_id);
          CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            folder_tags TEXT[] DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS folders_user ON folders(user_id);
          CREATE TABLE IF NOT EXISTS themes (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            is_default BOOLEAN NOT NULL DEFAULT false,
            data JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS themes_user ON themes(user_id);
          CREATE TABLE IF NOT EXISTS knowledge_articles (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL DEFAULT 'Untitled',
            article_type TEXT NOT NULL DEFAULT 'task',
            audience TEXT,
            software TEXT,
            prereqs TEXT,
            article_json JSONB NOT NULL DEFAULT '{}',
            knowledge_sources JSONB NOT NULL DEFAULT '[]',
            knowledge_map JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
          );
          CREATE INDEX IF NOT EXISTS ka_user_updated ON knowledge_articles(user_id, updated_at DESC);
        `);
        await client.query(`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
          ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_tags TEXT[] DEFAULT '{}';
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS folder_id TEXT;
          ALTER TABLE folders ADD COLUMN IF NOT EXISTS folder_tags TEXT[] DEFAULT '{}';
        `).catch(() => {});
        dbReady = true;
        console.log('[tazzet] PostgreSQL ready.');
      } finally { client.release(); }
    })
    .catch(err => console.warn('[tazzet] PostgreSQL connection failed:', err.message));
} else {
  console.warn('[tazzet] DATABASE_URL not set — auth disabled.');
}

/* ── Middleware ── */
app.use(express.json({ limit: '20mb' }));

/* ── Google OAuth: one-time codes (avoid JWT in query strings) ── */
const oauthCodes = new Map();
const OAUTH_CODE_TTL_MS = 120000;
function storeOAuthToken(token) {
  const code = crypto.randomBytes(24).toString('hex');
  oauthCodes.set(code, { token, exp: Date.now() + OAUTH_CODE_TTL_MS });
  return code;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of oauthCodes) {
    if (v.exp < now) oauthCodes.delete(k);
  }
}, 60000).unref();
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

/* ── Helpers ── */
function genId() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, avatar: user.avatar_url },
    JWT_SECRET, { expiresIn: TOKEN_EXPIRY }
  );
}
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch (_) { return null; }
}
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token.' });
  req.user = payload;
  next();
}
/** When the database is in use, require JWT for costly proxy routes. Without DATABASE_URL, allow anonymous (local dev). */
function requireAuthIfDb(req, res, next) {
  if (!dbReady) return next();
  return requireAuth(req, res, next);
}

/* ── Anthropic fetch helper ── */
async function anthropicFetch(apiKey, body) {
  const RETRY_STATUS = new Set([429, 503, 529]);
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  const url  = 'https://api.anthropic.com/v1/messages';
  const init = { method: 'POST', headers, body: JSON.stringify(body) };
  let res = await fetch(url, init);
  if (RETRY_STATUS.has(res.status)) {
    const wait = res.status === 429 ? parseInt(res.headers.get('retry-after') || '12', 10) : 8;
    console.log(`[tazzet] Anthropic ${res.status} — retrying in ${wait}s`);
    await new Promise(r => setTimeout(r, wait * 1000));
    res = await fetch(url, init);
  }
  return res;
}

/* ── serveApp ── */
function serveApp(req, res, route, params = {}) {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  try {
    let html = fs.readFileSync(indexPath, 'utf8');
    html = html.replace('<head>', `<head>
<script>(function(){var t=null;try{t=localStorage.getItem('tazzet_jwt');}catch(_){}if(!t){window.location.replace('/login');}})();</script>`);
    html = html.replace('</head>', `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/tazzet.css">
<link rel="stylesheet" href="/css/taz-tags-cards.css">
<link rel="stylesheet" href="/css/taz-wizard-step1.css">
<script src="/js/taz-dots.js" defer></script>
</head>`);
    const INJECT = `<script>
window.TAZZET_ROUTE  = ${JSON.stringify(route)};
window.TAZZET_PARAMS = ${JSON.stringify(params)};
</script>
<script src="/js/taz-overrides.js"></script>
<script src="/js/router.js"></script>
`;
    const bodyClose = html.lastIndexOf('</body>');
    if (bodyClose !== -1) html = html.slice(0, bodyClose) + INJECT + html.slice(bodyClose);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Tazzet-Route', route);
    res.send(html);
  } catch (e) {
    console.error('[tazzet] Failed to patch index.html:', e.message);
    res.sendFile(indexPath);
  }
}

/* ── Health ── */
app.get('/health', (_req, res) => {
  const base = {
    status:            'ok',
    apiKeyConfigured:  Boolean(process.env.ANTHROPIC_API_KEY),
    freepikConfigured: Boolean(process.env.FREEPIK_API_KEY),
    dbConnected:       dbReady,
    authEnabled:       dbReady,
    googleSso:         Boolean(process.env.GOOGLE_CLIENT_ID),
    inviteRequired:    Boolean(process.env.TAZZET_INVITE_CODE),
  };
  if (process.env.NODE_ENV !== 'production') {
    base.model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
  }
  res.json(base);
});

/* ── Static auth pages ── */
app.get('/login',         (_req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/auth-callback', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'auth-callback.html')));

/* ── Google SSO ── */
app.get('/api/auth/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID)
    return res.status(503).json({ error: 'Google SSO not configured.' });
  const base   = `${req.protocol}://${req.get('host')}`;
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  `${base}/api/auth/google/callback`,
    response_type: 'code', scope: 'openid email profile',
    access_type: 'offline', prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;
  const base = `${req.protocol}://${req.get('host')}`;
  if (error || !code) return res.redirect('/login?auth_error=cancelled');
  if (!db)            return res.redirect('/login?auth_error=db_unavailable');
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${base}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      console.error('[tazzet] Google token exchange failed:', await tokenRes.text());
      return res.redirect('/login?auth_error=token_exchange');
    }
    const tokens = await tokenRes.json();
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const gUser = await profileRes.json();
    if (!gUser.email) return res.redirect('/login?auth_error=no_email');
    let result = await db.query(
      'SELECT * FROM users WHERE google_id=$1 OR email=$2 ORDER BY google_id NULLS LAST LIMIT 1',
      [gUser.id, gUser.email.toLowerCase()]
    );
    let user;
    if (result.rows.length) {
      user = result.rows[0];
      if (!user.google_id)
        await db.query('UPDATE users SET google_id=$1, avatar_url=$2 WHERE id=$3',
          [gUser.id, gUser.picture || null, user.id]);
    } else {
      const id       = genId();
      const username = (gUser.name || gUser.email.split('@')[0]).slice(0, 40);
      await db.query(
        'INSERT INTO users (id,username,email,google_id,avatar_url,password_hash) VALUES ($1,$2,$3,$4,$5,NULL)',
        [id, username, gUser.email.toLowerCase(), gUser.id, gUser.picture || null]
      );
      result = await db.query('SELECT * FROM users WHERE id=$1', [id]);
      user   = result.rows[0];
    }
    const code = storeOAuthToken(signToken(user));
    res.redirect(`/auth-callback?code=${encodeURIComponent(code)}`);
  } catch (err) {
    console.error('[tazzet] Google OAuth error:', err.message);
    res.redirect('/login?auth_error=server_error');
  }
});

/* ── Email/password auth ── */
app.post('/api/auth/login', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  try {
    const result = await db.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase().trim()]);
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid email or password.' });
    const row = result.rows[0];
    if (!row.password_hash) return res.status(401).json({ error: 'This account uses Google sign-in.' });
    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });
    res.json({ token: signToken(row), user: { id: row.id, username: row.username, role: row.role } });
  } catch (err) { res.status(500).json({ error: 'Login failed.' }); }
});

app.post('/api/auth/oauth-exchange', (req, res) => {
  const { code } = req.body || {};
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Code required.' });
  const entry = oauthCodes.get(code);
  if (!entry || entry.exp < Date.now()) {
    return res.status(401).json({ error: 'Invalid or expired sign-in code.' });
  }
  oauthCodes.delete(code);
  res.json({ token: entry.token });
});

app.post('/api/auth/register', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const invite = process.env.TAZZET_INVITE_CODE;
  const { username, email, password, inviteCode } = req.body || {};
  if (invite && (!inviteCode || inviteCode !== invite)) {
    return res.status(403).json({ error: 'Invalid or missing invite code.' });
  }
  const u = String(username || '').trim().slice(0, 40);
  const em = String(email || '').trim().toLowerCase();
  if (!u || !em || !password) return res.status(400).json({ error: 'Username, email, and password required.' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return res.status(400).json({ error: 'Invalid email address.' });
  try {
    const hash = await bcrypt.hash(String(password), SALT_ROUNDS);
    const id = genId();
    await db.query(
      'INSERT INTO users (id, username, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [id, u, em, hash, 'user']
    );
    const result = await db.query('SELECT * FROM users WHERE id=$1', [id]);
    const row = result.rows[0];
    res.json({ token: signToken(row), user: { id: row.id, username: row.username, role: row.role } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email or username already exists.' });
    console.error('[tazzet] register error:', err.message);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  if (dbReady) {
    try {
      const result = await db.query(
        'SELECT id,username,email,role,avatar_url,created_at FROM users WHERE id=$1', [req.user.sub]
      );
      if (result.rows.length) return res.json({ user: result.rows[0] });
    } catch (_) {}
  }
  res.json({ user: { id: req.user.sub, username: req.user.username || '', role: req.user.role || 'user', avatar_url: req.user.avatar || null } });
});

/* ── Projects API ── */
app.get('/api/projects', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    const result = await db.query(
      `SELECT id, title, created_at, updated_at, folder_id,
              jsonb_array_length(data->'editData'->'sections') AS section_count
       FROM projects WHERE user_id=$1 AND deleted_at IS NULL
       ORDER BY updated_at DESC`, [req.user.sub]
    );
    res.json({ projects: result.rows.map(r => ({
      id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at,
      sectionCount: r.section_count || 0, folderId: r.folder_id || null,
    }))});
  } catch (err) { res.status(500).json({ error: 'Could not fetch projects.' }); }
});

app.get('/api/projects/trash', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    const result = await db.query(
      `SELECT id, title, deleted_at FROM projects WHERE user_id=$1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
      [req.user.sub]
    );
    res.json({ projects: result.rows.map(r => ({ id: r.id, title: r.title, deletedAt: r.deleted_at })) });
  } catch (err) { res.status(500).json({ error: 'Could not fetch trash.' }); }
});

app.get('/api/projects/:id', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    const result = await db.query(
      `SELECT id,title,created_at,updated_at,data FROM projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.sub]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found.' });
    const row = result.rows[0];
    res.json({ id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at, ...row.data });
  } catch (err) { res.status(500).json({ error: 'Could not load project.' }); }
});

app.post('/api/projects', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const { id, title, editData, wizData, generatedLesson } = req.body;
  if (!id) return res.status(400).json({ error: 'Project id required.' });
  const safeTitle = String(title || 'Untitled').slice(0, 200);
  const data = { editData: editData || {}, wizData: wizData || {}, generatedLesson: generatedLesson || '' };
  try {
    await db.query(
      `INSERT INTO projects (id,user_id,title,data,updated_at) VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, data=EXCLUDED.data, updated_at=NOW(), deleted_at=NULL
       WHERE projects.user_id=$2`,
      [id, req.user.sub, safeTitle, JSON.stringify(data)]
    );
    res.json({ ok: true, id });
  } catch (err) { res.status(500).json({ error: 'Could not save project.' }); }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    const result = await db.query(
      `UPDATE projects SET deleted_at=NOW() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL RETURNING id`,
      [req.params.id, req.user.sub]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found or already in trash.' });
    res.json({ ok: true, trashed: true });
  } catch (err) { res.status(500).json({ error: 'Could not move to trash.' }); }
});

app.post('/api/projects/:id/restore', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    const result = await db.query(
      `UPDATE projects SET deleted_at=NULL WHERE id=$1 AND user_id=$2 AND deleted_at IS NOT NULL RETURNING id`,
      [req.params.id, req.user.sub]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Project not in trash.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not restore project.' }); }
});

app.delete('/api/projects/:id/permanent', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    await db.query('DELETE FROM projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NOT NULL', [req.params.id, req.user.sub]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not permanently delete project.' }); }
});

app.put('/api/projects/:id/tags', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const { tags = [] } = req.body;
  if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be an array.' });
  try {
    const validResult = await db.query('SELECT id FROM tags WHERE user_id=$1 AND id = ANY($2::text[])', [req.user.sub, tags]);
    const filtered = tags.filter(id => validResult.rows.map(r => r.id).includes(id));
    const result = await db.query(
      `UPDATE projects SET project_tags=$1 WHERE id=$2 AND user_id=$3 AND deleted_at IS NULL RETURNING id`,
      [filtered, req.params.id, req.user.sub]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not update project tags.' }); }
});

app.put('/api/projects/:id/folder', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const { folderId } = req.body;
  try {
    if (folderId) {
      const fRes = await db.query('SELECT id FROM folders WHERE id=$1 AND user_id=$2', [folderId, req.user.sub]);
      if (!fRes.rows.length) return res.status(404).json({ error: 'Folder not found.' });
    }
    const r = await db.query(
      `UPDATE projects SET folder_id=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 AND deleted_at IS NULL RETURNING id`,
      [folderId || null, req.params.id, req.user.sub]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Project not found.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not move project.' }); }
});

/* ── Folders API ── */
app.get('/api/folders', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    const [fRes, pRes] = await Promise.all([
      db.query('SELECT id,name,folder_tags,created_at FROM folders WHERE user_id=$1 ORDER BY created_at ASC', [req.user.sub]),
      db.query('SELECT id,folder_id FROM projects WHERE user_id=$1 AND deleted_at IS NULL AND folder_id IS NOT NULL', [req.user.sub]),
    ]);
    const projectFolders = {};
    pRes.rows.forEach(r => { projectFolders[r.id] = r.folder_id; });
    res.json({
      folders: fRes.rows.map(r => ({ id: r.id, name: r.name, tags: r.folder_tags || [], createdAt: r.created_at })),
      projectFolders,
    });
  } catch (err) { res.status(500).json({ error: 'Could not fetch folders.' }); }
});

app.post('/api/folders', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const { name } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required.' });
  const id = genId();
  try {
    await db.query('INSERT INTO folders (id,user_id,name) VALUES ($1,$2,$3)', [id, req.user.sub, String(name).trim().slice(0, 80)]);
    res.json({ ok: true, folder: { id, name: String(name).trim(), tags: [], createdAt: new Date().toISOString() } });
  } catch (err) { res.status(500).json({ error: 'Could not create folder.' }); }
});

app.put('/api/folders/:id/tags', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const { tags = [] } = req.body;
  if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be an array.' });
  try {
    const validResult = await db.query('SELECT id FROM tags WHERE user_id=$1 AND id = ANY($2::text[])', [req.user.sub, tags]);
    const filtered = tags.filter(id => validResult.rows.some(r => r.id === id));
    const r = await db.query('UPDATE folders SET folder_tags=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING id', [filtered, req.params.id, req.user.sub]);
    if (!r.rows.length) return res.status(404).json({ error: 'Folder not found.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not update folder tags.' }); }
});

app.put('/api/folders/:id', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const { name } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required.' });
  try {
    const r = await db.query('UPDATE folders SET name=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING id', [String(name).trim().slice(0, 80), req.params.id, req.user.sub]);
    if (!r.rows.length) return res.status(404).json({ error: 'Folder not found.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not rename folder.' }); }
});

app.delete('/api/folders/:id', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    await db.query('UPDATE projects SET folder_id=NULL WHERE folder_id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
    await db.query('DELETE FROM folders WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not delete folder.' }); }
});

/* ── Themes API ── */
app.get('/api/themes', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    const r = await db.query(
      'SELECT id,name,is_default,data,created_at FROM themes WHERE user_id=$1 ORDER BY created_at ASC',
      [req.user.sub]
    );
    res.json({ themes: r.rows.map(row => ({
      id: row.id, name: row.name, isDefault: row.is_default, data: row.data, createdAt: row.created_at,
    }))});
  } catch (err) { res.status(500).json({ error: 'Could not fetch themes.' }); }
});

app.post('/api/themes', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const { name, data = {}, isDefault = false } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required.' });
  const id = genId();
  try {
    if (isDefault) {
      await db.query('UPDATE themes SET is_default=false WHERE user_id=$1', [req.user.sub]);
    }
    await db.query(
      'INSERT INTO themes (id,user_id,name,is_default,data) VALUES ($1,$2,$3,$4,$5)',
      [id, req.user.sub, String(name).trim().slice(0, 80), Boolean(isDefault), JSON.stringify(data)]
    );
    res.json({ ok: true, theme: { id, name: String(name).trim(), isDefault: Boolean(isDefault), data } });
  } catch (err) { res.status(500).json({ error: 'Could not create theme.' }); }
});

app.put('/api/themes/:id', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const { name, data } = req.body;
  try {
    const sets = [], vals = [];
    if (name !== undefined) { sets.push(`name=$${sets.length + 1}`); vals.push(String(name).trim().slice(0, 80)); }
    if (data !== undefined) { sets.push(`data=$${sets.length + 1}`); vals.push(JSON.stringify(data)); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
    sets.push('updated_at=NOW()');
    vals.push(req.params.id, req.user.sub);
    const r = await db.query(
      `UPDATE themes SET ${sets.join(',')} WHERE id=$${vals.length - 1} AND user_id=$${vals.length} RETURNING id`,
      vals
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Theme not found.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not update theme.' }); }
});

app.delete('/api/themes/:id', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    await db.query('DELETE FROM themes WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not delete theme.' }); }
});

app.put('/api/themes/:id/default', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    await db.query('UPDATE themes SET is_default=false WHERE user_id=$1', [req.user.sub]);
    const r = await db.query(
      'UPDATE themes SET is_default=true, updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.sub]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Theme not found.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not set default theme.' }); }
});

/* ── Tags API ── */
app.get('/api/tags', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    const [tagsRes, projRes] = await Promise.all([
      db.query('SELECT id,name,colour,created_at FROM tags WHERE user_id=$1 ORDER BY created_at ASC', [req.user.sub]),
      db.query("SELECT id, project_tags FROM projects WHERE user_id=$1 AND deleted_at IS NULL AND project_tags <> '{}'", [req.user.sub]),
    ]);
    const projectTags = {};
    projRes.rows.forEach(r => { if (r.project_tags?.length) projectTags[r.id] = r.project_tags; });
    res.json({
      tags: tagsRes.rows.map(r => ({ id: r.id, name: r.name, colour: r.colour, createdAt: r.created_at })),
      projectTags,
    });
  } catch (err) { res.status(500).json({ error: 'Could not fetch tags.' }); }
});

app.post('/api/tags', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const { name, colour = '#4E8D99' } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required.' });
  const id = genId();
  try {
    await db.query('INSERT INTO tags (id,user_id,name,colour) VALUES ($1,$2,$3,$4)', [id, req.user.sub, String(name).trim().slice(0, 32), colour]);
    res.json({ ok: true, tag: { id, name: String(name).trim(), colour } });
  } catch (err) { res.status(500).json({ error: 'Could not create tag.' }); }
});

app.put('/api/tags/:id', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const { name, colour } = req.body;
  try {
    const sets = [], vals = [];
    if (name)   { sets.push(`name=$${sets.length+1}`);   vals.push(String(name).trim().slice(0, 32)); }
    if (colour) { sets.push(`colour=$${sets.length+1}`); vals.push(colour); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
    vals.push(req.params.id, req.user.sub);
    await db.query(`UPDATE tags SET ${sets.join(',')} WHERE id=$${vals.length-1} AND user_id=$${vals.length}`, vals);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not update tag.' }); }
});

app.delete('/api/tags/:id', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    await db.query('UPDATE projects SET project_tags = array_remove(project_tags, $1) WHERE user_id=$2', [req.params.id, req.user.sub]);
    await db.query('DELETE FROM tags WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not delete tag.' }); }
});

/* ── Anthropic proxy (non-streaming) ── */
app.post('/api/generate', requireAuthIfDb, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set.' });
  const { prompt, messageContent, maxTokens } = req.body;
  const content = messageContent || prompt;
  if (!content) return res.status(400).json({ error: 'prompt or messageContent required.' });
  const model  = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
  const maxTok = parseInt(maxTokens || '16000', 10);
  try {
    const upstream = await anthropicFetch(apiKey, { model, max_tokens: maxTok, system: 'You output only raw, valid JSON. No markdown, no code fences, no explanation.', messages: [{ role: 'user', content }] });
    if (!upstream.ok) { const b = await upstream.json().catch(() => ({})); return res.status(upstream.status).json({ error: b.error?.message || `HTTP ${upstream.status}` }); }
    const data = await upstream.json();
    res.json({ text: data.content?.find(b => b.type === 'text')?.text ?? '', model: data.model, usage: data.usage });
  } catch (err) { res.status(502).json({ error: err.message }); }
});

/* ── Anthropic proxy (streaming) ── */
app.post('/api/stream', requireAuthIfDb, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set.' });
  const { prompt, messageContent, maxTokens } = req.body;
  const content = messageContent || prompt;
  if (!content) return res.status(400).json({ error: 'prompt or messageContent required.' });
  const model  = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
  const maxTok = parseInt(maxTokens || '16000', 10);
  try {
    const upstream = await anthropicFetch(apiKey, { model, max_tokens: maxTok, stream: true, messages: [{ role: 'user', content }] });
    if (!upstream.ok) { const b = await upstream.json().catch(() => ({})); return res.status(upstream.status).json({ error: b.error?.message || `HTTP ${upstream.status}` }); }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const reader = upstream.body.getReader();
    const dec    = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const written = res.write(dec.decode(value, { stream: true }));
      if (!written) await new Promise(r => res.once('drain', r));
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ error: err.message });
    else res.end();
  }
});

/* ── Freepik proxy ── */
app.get('/api/freepik/search', requireAuthIfDb, async (req, res) => {
  const fpKey = req.headers['x-freepik-key'] || process.env.FREEPIK_API_KEY;
  if (!fpKey) return res.status(401).json({ error: 'No Freepik API key configured.' });
  const { q='', page=1, per_page=12, type='photo', orientation='landscape' } = req.query;
  const params = new URLSearchParams({ term: q, page, limit: per_page, order: 'relevance', 'filters[content_type][photo]': type==='photo'?1:0, 'filters[content_type][vector]': type==='vector'?1:0, 'filters[orientation][landscape]': orientation==='landscape'?1:0, 'filters[orientation][portrait]': orientation==='portrait'?1:0, 'filters[orientation][square]': orientation==='square'?1:0 });
  try {
    const r = await fetch(`https://api.freepik.com/v1/resources?${params}`, { headers: { 'x-freepik-api-key': fpKey, 'Accept-Language': 'en-GB' } });
    if (!r.ok) { const b = await r.json().catch(()=>({})); return res.status(r.status).json({ error: b.message||`HTTP ${r.status}` }); }
    res.json(await r.json());
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/freepik/download', requireAuthIfDb, async (req, res) => {
  const fpKey = req.headers['x-freepik-key'] || process.env.FREEPIK_API_KEY;
  if (!fpKey) return res.status(401).json({ error: 'No Freepik API key.' });
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });
  const allowed = ['img.freepik.com','cdn.freepik.com','media.freepik.com','previews.freepik.com'];
  const parsed  = new URL(url);
  if (!allowed.some(d => parsed.hostname===d || parsed.hostname.endsWith('.'+d))) return res.status(400).json({ error: 'URL not from Freepik CDN.' });
  try {
    const r = await fetch(url, { headers: { 'x-freepik-api-key': fpKey, 'Referer': 'https://www.freepik.com/' } });
    if (!r.ok) return res.status(r.status).json({ error: `Download failed: ${r.status}` });
    const buf = await r.arrayBuffer();
    res.json({ dataUrl: `data:${r.headers.get('content-type')||'image/jpeg'};base64,${Buffer.from(buf).toString('base64')}` });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/api/freepik/generate', requireAuthIfDb, async (req, res) => {
  const fpKey = req.headers['x-freepik-key'] || process.env.FREEPIK_API_KEY;
  if (!fpKey) return res.status(401).json({ error: 'No Freepik API key.' });
  const { prompt, aspect_ratio='widescreen_16_9', resolution='2k' } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required.' });
  try {
    const r = await fetch('https://api.freepik.com/v1/ai/mystic', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-freepik-api-key': fpKey }, body: JSON.stringify({ prompt, aspect_ratio, resolution, filter_nsfw: true }) });
    if (!r.ok) { const b = await r.json().catch(()=>({})); return res.status(r.status).json({ error: b.message||'Mystic error' }); }
    res.json(await r.json());
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/freepik/generate/:taskId', requireAuthIfDb, async (req, res) => {
  const fpKey = req.headers['x-freepik-key'] || process.env.FREEPIK_API_KEY;
  if (!fpKey) return res.status(401).json({ error: 'No Freepik API key.' });
  try {
    const r = await fetch('https://api.freepik.com/v1/ai/mystic/'+req.params.taskId, { headers: { 'x-freepik-api-key': fpKey } });
    if (!r.ok) return res.status(r.status).json({ error: 'Poll error' });
    res.json(await r.json());
  } catch (e) { res.status(502).json({ error: e.message }); }
});

/* ── Settings ── */
app.get('/api/settings', requireAuth, async (req, res) => {
  if (!dbReady || !db) return res.json({});
  try { const r = await db.query('SELECT data FROM workspace_settings WHERE user_id=$1', [req.user.sub]); res.json(r.rows[0]?.data || {}); }
  catch (err) { res.status(500).json({ error: 'Could not fetch settings.' }); }
});
app.post('/api/settings', requireAuth, async (req, res) => {
  if (!dbReady || !db) return res.json({ ok: true });
  try {
    await db.query(`INSERT INTO workspace_settings (user_id,data,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (user_id) DO UPDATE SET data=$2, updated_at=NOW()`, [req.user.sub, req.body]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not save settings.' }); }
});

/* ── Reusables ── */
app.get('/api/reusables', requireAuth, async (req, res) => {
  if (!dbReady || !db) return res.json({ items: [] });
  try {
    const r = await db.query('SELECT id,type,data FROM reusables WHERE user_id=$1 ORDER BY updated_at DESC', [req.user.sub]);
    res.json({ items: r.rows.map(row => ({ ...row.data, id: row.id, type: row.type })) });
  } catch (err) { res.status(500).json({ error: 'Could not fetch reusables.' }); }
});
app.post('/api/reusables', requireAuth, async (req, res) => {
  if (!dbReady || !db) return res.json({ ok: true });
  const { id, type, ...rest } = req.body;
  if (!id || !type) return res.status(400).json({ error: 'id and type are required.' });
  try {
    await db.query(`INSERT INTO reusables (id,user_id,type,data,updated_at) VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (id) DO UPDATE SET data=$4, type=$3, updated_at=NOW() WHERE reusables.user_id=$2`, [id, req.user.sub, type, { id, type, ...rest }]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not save reusable.' }); }
});
app.delete('/api/reusables/:id', requireAuth, async (req, res) => {
  if (!dbReady || !db) return res.json({ ok: true });
  try {
    await db.query('DELETE FROM reusables WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not delete reusable.' }); }
});

/* ── Knowledge Articles API ──
 *
 * Two-call flow:
 *   POST /api/knowledge/extract   — Call 1: server-side text prep + knowledge map
 *   POST /api/knowledge/generate  — Call 2: full article using KA_SKILL_SYSTEM
 *
 * CRUD:
 *   GET/POST /api/knowledge-articles
 *   GET/DELETE /api/knowledge-articles/:id
 *   POST /api/knowledge-articles/:id/restore
 *   DELETE /api/knowledge-articles/:id/permanent
 ── */

/* Call 1: extract sources and produce a knowledge map */
app.post('/api/knowledge/extract', requireAuth, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set.' });

  const { sources } = req.body;
  if (!Array.isArray(sources) || !sources.length) {
    return res.status(400).json({ error: 'sources array required.' });
  }

  /* Build plain-text content blocks from each source.
   * Option B: all extraction is server-side text — no base64 to the API. */
  const sourceBlocks = sources.map((s, i) => {
    const label = s.label || `Source ${i + 1}`;
    if (s.type === 'file') {
      /* In the real build, file content arrives as extracted text from
       * pdf-parse / mammoth on the upload endpoint.
       * The wizard sends the extracted text as s.content. */
      return `[File: ${label}]\n${s.content || '(no content extracted)'}`;
    }
    if (s.type === 'url') {
      return `[URL: ${s.content || label}]\n${s.extractedText || '(URL content not yet fetched)'}`;
    }
    /* text */
    return `[Text source]\n${s.content || '(empty)'}`;
  }).join('\n\n---\n\n');

  const prompt = `${KA_SKILL_SYSTEM}

Read the source material below and extract a knowledge map to inform writing a knowledge article.

SOURCE MATERIAL:
${sourceBlocks}

Based on this material, determine:
- The most likely article type: "task" (how to do something), "concept" (what something is), or "reference" (lookup information).
- A suggested article title in sentence case that matches the article type pattern:
  Task: "How to [verb] [thing]"
  Concept: "What is [X]?"
  Reference: "[X] settings"
- Who the reader most likely is.
- What software or system is involved.
- What prerequisites the reader needs.
- Key concepts or steps covered (up to 6 items).
- A plain-English summary (one sentence, 15 to 20 words).

Return ONLY valid JSON with no markdown fences or explanation:
{
  "article_type": "task",
  "suggested_title": "How to create a lesson in Tazzet",
  "suggested_audience": "Learning designers",
  "software": "Tazzet",
  "suggested_prereqs": "Tazzet account with admin access",
  "key_concepts": ["lesson creation", "content editor"],
  "step_count_estimate": 5,
  "summary": "One plain-English sentence describing what this material covers."
}`;

  try {
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    const upstream = await anthropicFetch(apiKey, {
      model,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });
    if (!upstream.ok) {
      const b = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: b.error?.message || `HTTP ${upstream.status}` });
    }
    const data = await upstream.json();
    const raw  = (data.content?.find(b => b.type === 'text')?.text || '{}')
      .replace(/```json|```/g, '').trim();
    const knowledgeMap = JSON.parse(raw);
    res.json({ ok: true, knowledgeMap, sources });
  } catch (err) {
    console.error('[tazzet] /api/knowledge/extract error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

/* Call 2: generate full article using knowledge map + user config */
app.post('/api/knowledge/generate', requireAuth, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set.' });

  const { knowledgeMap, config } = req.body;
  if (!knowledgeMap || !config) {
    return res.status(400).json({ error: 'knowledgeMap and config required.' });
  }

  const {
    title      = 'Knowledge Article',
    audience   = 'Team members',
    software   = 'the software',
    prereqs    = 'Account access',
    focus      = '',
    articleType = 'task',
    sections   = { overview:true, steps:true, prereqs:true, issues:true, scenario:true, confidence:true, related:true },
  } = config;

  /* Section instructions per article type */
  const sectionInstructions = {
    overview: {
      task:      'OVERVIEW: One sentence stating what the task achieves and who it is for.',
      concept:   'OVERVIEW: First paragraph defines the concept in plain English. Second paragraph explains why it matters to the reader. Third paragraph gives one or two concrete examples.',
      reference: 'OVERVIEW: One sentence introducing what this reference covers and how to use it.',
    },
    prereqs:    'BEFORE YOU START: A short intro sentence, then a bulleted list — one item per prerequisite.',
    steps:      `STEPS: 5 to 7 numbered steps. Rules:\n- One action per step only.\n- Use **bold** for all UI element names (buttons, field names, menu items, menu paths).\n- Use "select" not "click". Use "sign in" not "log in".\n- After each step with an expected outcome (a screen changes or a dialogue opens), write the outcome as a separate sentence beginning with "The " or a subject noun.\n- Mark steps that would benefit from a screenshot with [SCREENSHOT] at the end.\n- After the last step, write one sentence beginning with "You have now..." confirming what the reader has achieved.`,
    issues:     'COMMON ISSUES: 3 troubleshooting Q&A pairs for the most likely problems. Format: Q: question A: answer',
    scenario:   `PRACTICE SCENARIO: A 3-sentence realistic scenario where the reader applies the skill independently. Make it specific to ${software} and ${audience}. Do not give away the solution.`,
    confidence: 'CONFIDENCE CHECK: 5 "I can..." self-assessment statements.',
    related:    'RELATED ARTICLES: 3 suggested follow-on article titles. Task titles: "How to...". Concept titles: "What is...". One title per bullet. Do not invent specific URLs.',
  };

  const activeSections = Object.entries(sections)
    .filter(([, v]) => v)
    .map(([k]) => {
      if (k === 'overview')   return sectionInstructions.overview[articleType] || sectionInstructions.overview.task;
      if (k === 'steps'    && articleType !== 'task') return null;
      if (k === 'scenario' && articleType !== 'task') return null;
      return sectionInstructions[k] || null;
    })
    .filter(Boolean)
    .join('\n\n');

  const typeNote = {
    task:      'Title pattern: "How to [verb] [thing]". Explains how to complete a task step by step.',
    concept:   'Title pattern: "What is [X]?". Explains what something is and why it matters.',
    reference: 'Title pattern: "[X] settings". Provides lookup information in a table.',
  }[articleType] || '';

  const prompt = `${KA_SKILL_SYSTEM}

You are writing a ${articleType.toUpperCase()} article.
${typeNote}

ARTICLE DETAILS:
- Title: ${title}
- Audience: ${audience}
- Software: ${software}
- Prerequisites: ${prereqs}
${focus ? `- Additional focus: ${focus}` : ''}

KNOWLEDGE MAP (extracted from source material):
${JSON.stringify(knowledgeMap, null, 2)}

Write the following sections. Apply all plain English rules. Write for ${audience}. Be specific and practical.

${activeSections}
${articleType === 'reference' ? '\nFor the reference table, use columns "Term" and "Description". Include at least 5 rows relevant to the software.' : ''}

Return ONLY valid JSON with no markdown fences:
{
  "title": "${title}",
  "readtime": "X min read",
  "overview": "paragraph",
  "prereqs_intro": "sentence",
  "prereqs_list": ["item"],
  "steps": [{"text": "Select **File**, then select **Save As**.", "outcome": "The Save As dialogue opens.", "screenshot": false}],
  "steps_achieved": "You have now...",
  "issues": [{"q": "question", "a": "answer"}],
  "scenario": "paragraph",
  "confidence": ["I can..."],
  "related": ["Article title"],
  "concept_definition": "definition paragraph (concept only)",
  "concept_why": "why it matters paragraph (concept only)",
  "concept_example": "example paragraph (concept only)",
  "reference_intro": "intro sentence (reference only)",
  "reference_rows": [{"term": "term", "description": "description"}]
}`;

  try {
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    const upstream = await anthropicFetch(apiKey, {
      model,
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });
    if (!upstream.ok) {
      const b = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: b.error?.message || `HTTP ${upstream.status}` });
    }
    const data    = await upstream.json();
    const raw     = (data.content?.find(b => b.type === 'text')?.text || '{}')
      .replace(/```json|```/g, '').trim();
    const article = JSON.parse(raw);
    res.json({ ok: true, article });
  } catch (err) {
    console.error('[tazzet] /api/knowledge/generate error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

/* List knowledge articles (soft-delete aware) */
app.get('/api/knowledge-articles', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    const r = await db.query(
      `SELECT id, title, article_type, audience, software, created_at, updated_at
       FROM knowledge_articles
       WHERE user_id=$1 AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [req.user.sub]
    );
    res.json({ articles: r.rows.map(row => ({
      id: row.id, title: row.title, articleType: row.article_type,
      audience: row.audience, software: row.software,
      createdAt: row.created_at, updatedAt: row.updated_at,
    }))});
  } catch (err) { res.status(500).json({ error: 'Could not fetch knowledge articles.' }); }
});

/* Get single knowledge article */
app.get('/api/knowledge-articles/:id', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    const r = await db.query(
      `SELECT id, title, article_type, audience, software, prereqs,
              article_json, knowledge_sources, knowledge_map, created_at, updated_at
       FROM knowledge_articles
       WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
      [req.params.id, req.user.sub]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Knowledge article not found.' });
    const row = r.rows[0];
    res.json({
      id: row.id, title: row.title, articleType: row.article_type,
      audience: row.audience, software: row.software, prereqs: row.prereqs,
      articleJson: row.article_json, knowledgeSources: row.knowledge_sources,
      knowledgeMap: row.knowledge_map,
      createdAt: row.created_at, updatedAt: row.updated_at,
    });
  } catch (err) { res.status(500).json({ error: 'Could not load knowledge article.' }); }
});

/* Save / upsert knowledge article */
app.post('/api/knowledge-articles', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  const {
    id, title, articleType = 'task', audience, software, prereqs,
    articleJson = {}, knowledgeSources = [], knowledgeMap = {},
  } = req.body;
  if (!id) return res.status(400).json({ error: 'id required.' });
  const safeTitle = String(title || 'Untitled').slice(0, 200);
  try {
    await db.query(
      `INSERT INTO knowledge_articles
         (id, user_id, title, article_type, audience, software, prereqs,
          article_json, knowledge_sources, knowledge_map, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (id) DO UPDATE SET
         title=$3, article_type=$4, audience=$5, software=$6, prereqs=$7,
         article_json=$8, knowledge_sources=$9, knowledge_map=$10,
         updated_at=NOW(), deleted_at=NULL
       WHERE knowledge_articles.user_id=$2`,
      [
        id, req.user.sub, safeTitle, articleType,
        audience || null, software || null, prereqs || null,
        JSON.stringify(articleJson), JSON.stringify(knowledgeSources),
        JSON.stringify(knowledgeMap),
      ]
    );
    res.json({ ok: true, id });
  } catch (err) {
    console.error('[tazzet] /api/knowledge-articles POST error:', err.message);
    res.status(500).json({ error: 'Could not save knowledge article.' });
  }
});

/* Soft-delete */
app.delete('/api/knowledge-articles/:id', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    const r = await db.query(
      `UPDATE knowledge_articles SET deleted_at=NOW()
       WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL RETURNING id`,
      [req.params.id, req.user.sub]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Knowledge article not found or already deleted.' });
    res.json({ ok: true, trashed: true });
  } catch (err) { res.status(500).json({ error: 'Could not delete knowledge article.' }); }
});

/* Restore from trash */
app.post('/api/knowledge-articles/:id/restore', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    const r = await db.query(
      `UPDATE knowledge_articles SET deleted_at=NULL
       WHERE id=$1 AND user_id=$2 AND deleted_at IS NOT NULL RETURNING id`,
      [req.params.id, req.user.sub]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Knowledge article not in trash.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not restore knowledge article.' }); }
});

/* Permanent delete */
app.delete('/api/knowledge-articles/:id/permanent', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database not available.' });
  try {
    await db.query(
      'DELETE FROM knowledge_articles WHERE id=$1 AND user_id=$2 AND deleted_at IS NOT NULL',
      [req.params.id, req.user.sub]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Could not permanently delete knowledge article.' }); }
});

/* ── Page routes ── */
app.get('/', (req, res) => serveApp(req, res, 'dashboard'));
app.get('/projects/new', (req, res) => serveApp(req, res, 'wizard'));
app.get('/projects/:id', (req, res) => serveApp(req, res, 'editor', { projectId: req.params.id }));
app.get('/projects/:id/preview', (req, res) => serveApp(req, res, 'preview', { projectId: req.params.id }));
app.get('/workspace/settings',  (req, res) => serveApp(req, res, 'workspace.settings'));
app.get('/workspace/profiles',  (req, res) => serveApp(req, res, 'workspace.profiles'));
app.get('/workspace/templates', (req, res) => serveApp(req, res, 'workspace.templates'));
app.get('/workspace', (_req, res) => res.redirect(301, '/workspace/settings'));

/* ── Catch-all ── */
app.get('*', (req, res) => serveApp(req, res, 'dashboard'));

/* ── Start ── */
app.listen(PORT, () => {
  const key = process.env.ANTHROPIC_API_KEY;
  console.log(`\n  Tazzet running at http://localhost:${PORT}`);
  console.log(`  API key    : ${key ? key.slice(0, 8) + '...' : 'NOT SET'}`);
  console.log(`  DB         : ${process.env.DATABASE_URL ? 'configured' : 'not set'}`);
  console.log(`  JWT        : ${process.env.JWT_SECRET ? 'set' : 'NOT SET'}`);
  console.log(`  Google SSO : ${process.env.GOOGLE_CLIENT_ID ? 'configured' : 'NOT SET'}\n`);
});
