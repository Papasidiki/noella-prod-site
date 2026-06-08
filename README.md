# NOELLA-PROD — Site Web Complet

> Production audiovisuelle guinéenne — Site vitrine + Portfolio dynamique + Dashboard Admin

---

## 📦 Structure du projet

```
noella-prod/
│
├── public/                  # Pages frontend publiques
│   ├── index.html           # Accueil (hero cinématique, stats, services, portfolio preview)
│   ├── about.html           # À propos (storytelling, équipe, vision)
│   ├── services.html        # Services détaillés
│   ├── portfolio.html       # Portfolio avec filtres + modal vidéo
│   └── contact.html         # Formulaire connecté à l'API
│
├── admin/                   # Dashboard administrateur
│   ├── login.html           # Connexion sécurisée
│   ├── dashboard.html       # Vue d'ensemble (stats + récents)
│   ├── projects.html        # CRUD complet projets
│   ├── messages.html        # Boîte de réception clients
│   ├── testimonials.html    # Gestion témoignages
│   └── settings.html        # Paramètres du site + sécurité
│
├── assets/
│   ├── css/
│   │   ├── style.css        # CSS frontend (design Cinematic Noir Premium)
│   │   └── admin.css        # CSS dashboard admin
│   ├── js/
│   │   ├── main.js          # JS frontend (fetch, animations, validation)
│   │   └── admin.js         # JS admin (auth guard, API helpers, toasts)
│   ├── images/              # Images du site (à ajouter)
│   └── videos/              # Vidéos (à ajouter)
│
├── worker/
│   └── index.js             # API Cloudflare Worker complète
│
├── db/
│   └── schema.sql           # Schéma D1 + données de démo
│
├── wrangler.toml            # Config Cloudflare Workers/Pages
└── README.md
```

---

## 🚀 Déploiement — Guide étape par étape

### 1. Prérequis

```bash
npm install -g wrangler
wrangler login
```

### 2. Créer la base de données D1

```bash
wrangler d1 create noella-prod-db
# Copier le database_id affiché et le coller dans wrangler.toml
```

### 3. Créer le namespace KV (rate limiting)

```bash
wrangler kv:namespace create NP_KV
# Copier l'id et le coller dans wrangler.toml
```

### 4. Initialiser la base de données

```bash
wrangler d1 execute noella-prod-db --file=db/schema.sql
```

### 5. Définir le secret JWT

```bash
wrangler secret put JWT_SECRET
# Entrer une chaîne aléatoire longue, ex:
# openssl rand -hex 32
```

### 6. Mettre à jour le mot de passe admin

Le fichier `schema.sql` insère un utilisateur admin avec un hash placeholder.
Pour définir un vrai mot de passe, utilisez ce script Node.js :

```javascript
// scripts/set-password.js
const { createHash } = require('crypto');
const password = process.argv[2];
const salt     = 'np_salt_' + Date.now();
const hash     = createHash('sha256').update(password + salt).digest('hex');
console.log(`Hash: ${salt}:${hash}`);
// Puis: wrangler d1 execute noella-prod-db --command="UPDATE users SET password_hash='${salt}:${hash}' WHERE username='admin'"
```

```bash
node scripts/set-password.js VotreMotDePasse2026!
```

### 7. Déployer

```bash
# Déployer le Worker
wrangler deploy

# Déployer le frontend sur Cloudflare Pages
# Via le dashboard Cloudflare Pages → Connecter Git ou upload direct
```

---

## 🔐 Sécurité implémentée

| Mécanisme           | Description                                         |
|---------------------|-----------------------------------------------------|
| **JWT**             | Tokens signés HMAC-SHA256, expiration 8h            |
| **Password hashing**| SHA-256 + salt aléatoire                            |
| **Rate limiting**   | 5 messages/min sur contact, 10 tentatives/5min login |
| **Sanitization XSS**| Échappement `<>` sur toutes les entrées             |
| **Validation**      | Email, téléphone, longueurs strictes                |
| **Routes protégées**| Toutes les routes admin vérifient le JWT            |
| **CORS**            | Headers configurés                                  |
| **Auth guard**      | Redirection auto si token absent/expiré             |

---

## 🎨 Design System

- **Palette** : Noir `#080b10` / Bleu `#0d2a4a` / Orange `#e8631a` / Or `#c9a96e`
- **Typographie** : Bebas Neue (display) + Cormorant Garamond (titres) + DM Sans (corps)
- **Animations** : Scroll reveal, compteurs animés, hover zoom, transitions fluides
- **Responsive** : Mobile-first, Bootstrap 5

---

## 📡 API Reference

### Routes publiques

| Méthode | Route              | Description                    |
|---------|--------------------|--------------------------------|
| GET     | `/api/projects`    | Projets publiés                |
| GET     | `/api/testimonials`| Témoignages approuvés          |
| POST    | `/api/messages`    | Envoyer un message de contact  |
| POST    | `/api/login`       | Authentification admin         |

### Routes admin (Bearer token requis)

| Méthode | Route                       | Description               |
|---------|-----------------------------|---------------------------|
| GET     | `/api/dashboard`            | Stats + résumé            |
| GET     | `/api/projects/all`         | Tous les projets           |
| POST    | `/api/projects`             | Créer un projet            |
| PUT     | `/api/projects/:id`         | Modifier un projet         |
| DELETE  | `/api/projects/:id`         | Supprimer un projet        |
| GET     | `/api/messages`             | Tous les messages          |
| PUT     | `/api/messages/:id/read`    | Marquer comme lu           |
| DELETE  | `/api/messages/:id`         | Supprimer un message       |
| GET     | `/api/testimonials/all`     | Tous les témoignages       |
| POST    | `/api/testimonials`         | Créer un témoignage        |
| PUT     | `/api/testimonials/:id`     | Modifier un témoignage     |
| DELETE  | `/api/testimonials/:id`     | Supprimer un témoignage    |
| GET     | `/api/settings`             | Lire les paramètres        |
| POST    | `/api/settings`             | Sauvegarder les paramètres |
| POST    | `/api/change-password`      | Changer le mot de passe    |

---

## 📸 Images à ajouter

Placez vos images dans `assets/images/` :

| Fichier                  | Usage                          |
|--------------------------|--------------------------------|
| `hero-bg.jpg`            | Background hero (1920×1080)    |
| `about-story.jpg`        | Section histoire               |
| `team-1.jpg` à `team-4.jpg` | Photos équipe (carré)       |
| `service-cinema.jpg`     | Service cinéma                 |
| `service-music.jpg`      | Service musique                |
| `service-distribution.jpg` | Service distribution         |
| `service-media.jpg`      | Service média digital          |
| `placeholder.jpg`        | Image par défaut portfolio     |

---

## 📋 Informations légales

- **RCCM** : GN.TCC.2020.A.00120
- **NIF** : 730274370
- **Fondée** : 2020
- **Siège** : Dubréka, Guinée

---

## 🛠 Technologies

- **Frontend** : HTML5, CSS3 (custom), JavaScript ES6+, Bootstrap 5, Font Awesome 6
- **Backend** : Cloudflare Workers (Edge computing)
- **Base de données** : Cloudflare D1 (SQLite distribué)
- **Cache / Rate limit** : Cloudflare KV
- **Authentification** : JWT (HMAC-SHA256, implémenté nativement)
- **CDN / Hosting** : Cloudflare Pages + Workers

---

*Développé pour NOELLA-PROD © 2026*
