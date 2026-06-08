-- ============================================================
-- NOELLA-PROD — Cloudflare D1 Schema
-- ============================================================

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    DEFAULT (datetime('now'))
);

-- ── Projects ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  description TEXT,
  image       TEXT,
  video_url   TEXT,
  category    TEXT    NOT NULL DEFAULT 'autre',
  status      TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_status   ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);

-- ── Messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  subject    TEXT,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread','read')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

-- ── Services ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  sort_order  INTEGER DEFAULT 0,
  active      INTEGER DEFAULT 1
);

-- ── Testimonials ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS testimonials (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  role     TEXT,
  message  TEXT NOT NULL,
  approved INTEGER DEFAULT 0
);

-- ── Settings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Admin user (password: Admin1234!)
-- Hash generated: use `wrangler d1 execute` or the setup script
-- Format: salt:sha256(password+salt)
-- Run `node scripts/hash-password.js Admin1234!` to regenerate
INSERT OR IGNORE INTO users (username, password_hash) VALUES (
  'admin',
  'np_salt_2026:a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1'
);

-- Services par défaut
INSERT OR IGNORE INTO services (id, title, description, icon, sort_order) VALUES
  (1, 'Cinéma & Fiction',     'Production de films, courts-métrages et séries télévisées.',        'fa-clapperboard', 1),
  (2, 'Musique & Spectacles', 'Production musicale, organisation de concerts et captation live.',  'fa-music',        2),
  (3, 'Distribution',         'Distribution en salles, streaming et importation de films.',         'fa-film',         3),
  (4, 'Publicité & Clips',    'Films publicitaires et clips musicaux professionnels.',              'fa-video',        4),
  (5, 'Média & Digital',      'Chaîne TV Web et programmes culturels africains.',                   'fa-tv',           5);

-- Témoignages par défaut
INSERT OR IGNORE INTO testimonials (name, role, message, approved) VALUES
  ('Mamadou Bah',       'Artiste Musicien, Conakry',
   'Une équipe professionnelle et créative. NOELLA-PROD a su capturer l''essence de notre vision artistique avec une qualité cinématographique remarquable.', 1),
  ('Fatoumata Camara',  'Réalisatrice',
   'Collaboration exceptionnelle. La maîtrise technique et la sensibilité culturelle de NOELLA-PROD font toute la différence dans nos productions.', 1),
  ('Ibrahim Diallo',    'Promoteur culturel',
   'Grâce à NOELLA-PROD, notre événement a été filmé et distribué dans toute la sous-région. Un résultat au-delà de nos espérances.', 1);

-- Projets de démonstration
INSERT OR IGNORE INTO projects (title, description, category, status) VALUES
  ('Clip — Salam Africa',     'Clip musical pour l''artiste Salam Africa, tourné en plein cœur de Conakry.', 'clip',         'published'),
  ('Court-métrage — Demain',  'Court-métrage sur la jeunesse guinéenne et ses aspirations.',                   'cinema',       'published'),
  ('Mariage Kouyaté-Diallo',  'Captation complète du mariage de la famille Kouyaté à Dubréka.',               'mariage',      'published'),
  ('Pub — Boulangerie Soleil', 'Film publicitaire pour la Boulangerie Soleil de Conakry.',                    'pub',          'published'),
  ('Documentaire — Fouta',    'Documentaire sur les traditions et paysages du Fouta Djallon.',                'documentaire', 'published');

-- Paramètres par défaut
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('site_name',    'NOELLA-PROD'),
  ('site_slogan',  'Transformer les récits africains en actifs économiques'),
  ('site_email',   'info@noella-prod.com'),
  ('site_whatsapp','224622000000'),
  ('site_address', 'Dubréka, République de Guinée'),
  ('legal_rccm',   'GN.TCC.2020.A.00120'),
  ('legal_nif',    '730274370'),
  ('legal_year',   '2020');
