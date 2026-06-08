/**
 * NOELLA-PROD — Cloudflare Worker API
 * Routes: public + admin (JWT)
 * DB: Cloudflare D1
 */

// ── CORS headers ──────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(message, status = 400) {
  return json({ error: message }, status);
}

// ── Simple JWT (HMAC-SHA256) ──────────────────────────────────
async function signToken(payload, secret) {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = btoa(JSON.stringify(payload));
  const msg     = `${header}.${body}`;
  const key     = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig     = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  const sigB64  = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${msg}.${sigB64}`;
}

async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Password hashing (SHA-256 + salt) ─────────────────────────
async function hashPassword(password, salt) {
  const s = salt || crypto.randomUUID();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password + s));
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { hash: `${s}:${hash}`, salt: s };
}

async function checkPassword(password, stored) {
  const [salt] = stored.split(':');
  const { hash } = await hashPassword(password, salt);
  return hash === stored;
}

// ── Auth middleware ───────────────────────────────────────────
async function requireAuth(request, env) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  return verifyToken(token, env.JWT_SECRET || 'np_secret_2026');
}

// ── Rate limiting (KV-based, optional) ────────────────────────
async function checkRateLimit(env, key, max = 10, window = 60) {
  if (!env.NP_KV) return true; // skip if no KV binding
  const now     = Math.floor(Date.now() / 1000);
  const bucket  = Math.floor(now / window);
  const kvKey   = `rl:${key}:${bucket}`;
  const current = parseInt((await env.NP_KV.get(kvKey)) || '0', 10);
  if (current >= max) return false;
  await env.NP_KV.put(kvKey, String(current + 1), { expirationTtl: window * 2 });
  return true;
}

// ── Sanitize ──────────────────────────────────────────────────
function sanitize(str = '', maxLen = 500) {
  return String(str).replace(/[<>]/g, '').trim().substring(0, maxLen);
}

// ── Main handler ──────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // OPTIONS (preflight)
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── Serve static files (Cloudflare Pages handles this,
    //    but fall through to API if path starts with /api)
    if (path === "/") {
  return Response.redirect(
    "https://noella-prod.sanoh5347.workers.dev/public/index.html",
    302
  );
}

if (path === "/test") {
  return new Response("Le Worker fonctionne", {
    headers: { "Content-Type": "text/html" }
  });
}

if (!path.startsWith('/api')) {
  return new Response("Fichier statique non configuré", {
    status: 404,
    headers: { "Content-Type": "text/plain" }
  });
}

    const db = env.DB;

    try {
      // ────────────────────────────────────────────────────────
      // PUBLIC ROUTES
      // ────────────────────────────────────────────────────────

      // GET /api/projects — published only
      if (path === '/api/projects' && method === 'GET') {
        const { results } = await db.prepare(
          `SELECT id, title, description, image, video_url, category, created_at
           FROM projects WHERE status = 'published'
           ORDER BY created_at DESC`
        ).all();
        return json({ projects: results });
      }

      // GET /api/testimonials — approved only
      if (path === '/api/testimonials' && method === 'GET') {
        const { results } = await db.prepare(
          `SELECT id, name, role, message FROM testimonials WHERE approved = 1 ORDER BY id DESC`
        ).all();
        return json({ testimonials: results });
      }

      // POST /api/messages — contact form
      if (path === '/api/messages' && method === 'POST') {
        // Rate limit: max 5 messages / 60s per IP
        const ip     = request.headers.get('CF-Connecting-IP') || 'unknown';
        const allowed = await checkRateLimit(env, `contact:${ip}`, 5, 60);
        if (!allowed) return err('Trop de requêtes. Réessayez dans une minute.', 429);

        const body = await request.json();
        const name    = sanitize(body.name, 100);
        const email   = sanitize(body.email, 150);
        const phone   = sanitize(body.phone, 20);
        const subject = sanitize(body.subject, 100);
        const message = sanitize(body.message, 2000);

        if (!name || name.length < 2)   return err('Nom invalide.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Email invalide.');
        if (!message || message.length < 10) return err('Message trop court.');

        await db.prepare(
          `INSERT INTO messages (name, email, phone, subject, message, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'unread', datetime('now'))`
        ).bind(name, email, phone, subject, message).run();

        return json({ success: true, message: 'Message envoyé avec succès.' });
      }

      // POST /api/login
      if (path === '/api/login' && method === 'POST') {
        // Rate limit: 10 attempts / 300s per IP
        const ip     = request.headers.get('CF-Connecting-IP') || 'unknown';
        const allowed = await checkRateLimit(env, `login:${ip}`, 10, 300);
        if (!allowed) return err('Trop de tentatives. Réessayez dans 5 minutes.', 429);

        const { username, password } = await request.json();
        if (!username || !password) return err('Identifiants manquants.');

        const user = await db.prepare(
          'SELECT * FROM users WHERE username = ?'
        ).bind(sanitize(username, 50)).first();

        if (!user) return err('Identifiants incorrects.', 401);

        const valid = await checkPassword(password, user.password_hash);
        if (!valid) return err('Identifiants incorrects.', 401);

        const secret  = env.JWT_SECRET || 'np_secret_2026';
        const payload = { sub: user.id, username: user.username, exp: Date.now() + 8 * 3600 * 1000 };
        const token   = await signToken(payload, secret);

        return json({ success: true, token, username: user.username });
      }

      // ────────────────────────────────────────────────────────
      // ADMIN ROUTES — require auth
      // ────────────────────────────────────────────────────────
      const authPayload = await requireAuth(request, env);
      if (!authPayload) return err('Non autorisé.', 401);

      // GET /api/dashboard
      if (path === '/api/dashboard' && method === 'GET') {
        const [projCount, msgCount, unreadCount, testCount] = await Promise.all([
          db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status = 'published'`).first(),
          db.prepare(`SELECT COUNT(*) as c FROM messages`).first(),
          db.prepare(`SELECT COUNT(*) as c FROM messages WHERE status = 'unread'`).first(),
          db.prepare(`SELECT COUNT(*) as c FROM testimonials WHERE approved = 1`).first(),
        ]);

        const { results: recentMsgs } = await db.prepare(
          `SELECT id, name, email, subject, status, created_at FROM messages ORDER BY created_at DESC LIMIT 5`
        ).all();

        const { results: recentProjs } = await db.prepare(
          `SELECT id, title, category, status FROM projects ORDER BY created_at DESC LIMIT 5`
        ).all();

        return json({
          stats: {
            projects:     projCount.c,
            messages:     msgCount.c,
            unread:       unreadCount.c,
            testimonials: testCount.c,
          },
          recent_messages: recentMsgs,
          recent_projects: recentProjs,
        });
      }

      // GET /api/projects/all — admin, all statuses
      if (path === '/api/projects/all' && method === 'GET') {
        const { results } = await db.prepare(
          `SELECT * FROM projects ORDER BY created_at DESC`
        ).all();
        return json({ projects: results });
      }

      // POST /api/projects
      if (path === '/api/projects' && method === 'POST') {
        const b = await request.json();
        const title    = sanitize(b.title, 200);
        const category = sanitize(b.category, 50);
        if (!title || !category) return err('Titre et catégorie obligatoires.');

        const result = await db.prepare(
          `INSERT INTO projects (title, description, image, video_url, category, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          title,
          sanitize(b.description, 2000),
          sanitize(b.image, 500),
          sanitize(b.video_url, 500),
          category,
          b.status === 'published' ? 'published' : 'draft'
        ).run();

        return json({ success: true, id: result.meta.last_row_id }, 201);
      }

      // PUT /api/projects/:id
      const projMatch = path.match(/^\/api\/projects\/(\d+)$/);
      if (projMatch && method === 'PUT') {
        const id = parseInt(projMatch[1], 10);
        const b  = await request.json();
        await db.prepare(
          `UPDATE projects SET title=?, description=?, image=?, video_url=?, category=?, status=?, updated_at=datetime('now')
           WHERE id=?`
        ).bind(
          sanitize(b.title, 200),
          sanitize(b.description, 2000),
          sanitize(b.image, 500),
          sanitize(b.video_url, 500),
          sanitize(b.category, 50),
          b.status === 'published' ? 'published' : 'draft',
          id
        ).run();
        return json({ success: true });
      }

      // DELETE /api/projects/:id
      if (projMatch && method === 'DELETE') {
        const id = parseInt(projMatch[1], 10);
        await db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // GET /api/messages
      if (path === '/api/messages' && method === 'GET') {
        const { results } = await db.prepare(
          `SELECT * FROM messages ORDER BY created_at DESC`
        ).all();
        return json({ messages: results });
      }

      // PUT /api/messages/:id/read
      const msgReadMatch = path.match(/^\/api\/messages\/(\d+)\/read$/);
      if (msgReadMatch && method === 'PUT') {
        const id = parseInt(msgReadMatch[1], 10);
        await db.prepare(`UPDATE messages SET status='read' WHERE id=?`).bind(id).run();
        return json({ success: true });
      }

      // DELETE /api/messages/:id
      const msgMatch = path.match(/^\/api\/messages\/(\d+)$/);
      if (msgMatch && method === 'DELETE') {
        const id = parseInt(msgMatch[1], 10);
        await db.prepare('DELETE FROM messages WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // GET /api/testimonials/all
      if (path === '/api/testimonials/all' && method === 'GET') {
        const { results } = await db.prepare(`SELECT * FROM testimonials ORDER BY id DESC`).all();
        return json({ testimonials: results });
      }

      // POST /api/testimonials
      if (path === '/api/testimonials' && method === 'POST') {
        const b = await request.json();
        if (!b.name || !b.message) return err('Nom et message obligatoires.');
        const result = await db.prepare(
          `INSERT INTO testimonials (name, role, message, approved) VALUES (?, ?, ?, ?)`
        ).bind(sanitize(b.name, 100), sanitize(b.role, 100), sanitize(b.message, 1000), b.approved ? 1 : 0).run();
        return json({ success: true, id: result.meta.last_row_id }, 201);
      }

      // PUT /api/testimonials/:id
      const testMatch = path.match(/^\/api\/testimonials\/(\d+)$/);
      if (testMatch && method === 'PUT') {
        const id = parseInt(testMatch[1], 10);
        const b  = await request.json();
        await db.prepare(
          `UPDATE testimonials SET name=?, role=?, message=?, approved=? WHERE id=?`
        ).bind(sanitize(b.name, 100), sanitize(b.role, 100), sanitize(b.message, 1000), b.approved ? 1 : 0, id).run();
        return json({ success: true });
      }

      // DELETE /api/testimonials/:id
      if (testMatch && method === 'DELETE') {
        const id = parseInt(testMatch[1], 10);
        await db.prepare('DELETE FROM testimonials WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // GET /api/settings
      if (path === '/api/settings' && method === 'GET') {
        const { results } = await db.prepare(`SELECT key, value FROM settings`).all();
        const settings = {};
        results.forEach(r => { settings[r.key] = r.value; });
        return json({ settings });
      }

      // POST /api/settings
      if (path === '/api/settings' && method === 'POST') {
        const b = await request.json();
        const { section, ...fields } = b;
        for (const [key, value] of Object.entries(fields)) {
          await db.prepare(
            `INSERT INTO settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value`
          ).bind(sanitize(key, 100), sanitize(String(value), 500)).run();
        }
        return json({ success: true });
      }

      // POST /api/change-password
      if (path === '/api/change-password' && method === 'POST') {
        const b    = await request.json();
        const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(authPayload.sub).first();
        if (!user) return err('Utilisateur introuvable.', 404);

        const valid = await checkPassword(b.current_password, user.password_hash);
        if (!valid) return err('Mot de passe actuel incorrect.', 400);

        if (!b.new_password || b.new_password.length < 8) return err('Le nouveau mot de passe doit contenir au moins 8 caractères.');

        const { hash } = await hashPassword(b.new_password);
        await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, user.id).run();
        return json({ success: true });
      }

      return err('Route introuvable.', 404);

    } catch (e) {
      console.error('Worker error:', e);
      return err('Erreur interne du serveur.', 500);
    }
  },
};
