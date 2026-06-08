# 📚 Guide de Déploiement NOELLA-PROD

## Table des matières
1. [Prérequis](#prérequis)
2. [Étape 1 : Créer la base de données D1](#étape-1--créer-la-base-de-données-d1)
3. [Étape 2 : Créer le KV Namespace](#étape-2--créer-le-kv-namespace)
4. [Étape 3 : Initialiser le schéma de la base](#étape-3--initialiser-le-schéma-de-la-base)
5. [Étape 4 : Créer un admin par défaut](#étape-4--créer-un-admin-par-défaut)
6. [Étape 5 : Mettre à jour wrangler.toml](#étape-5--mettre-à-jour-wranglertoml)
7. [Étape 6 : Déployer le Worker (API)](#étape-6--déployer-le-worker-api)
8. [Étape 7 : Déployer Cloudflare Pages (Frontend)](#étape-7--déployer-cloudflare-pages-frontend)
9. [Étape 8 : Accéder au Dashboard Admin](#étape-8--accéder-au-dashboard-admin)
10. [Troubleshooting](#troubleshooting)

---

## Prérequis

Avant de commencer, assure-toi d'avoir :

✅ **Compte Cloudflare** (gratuit) : https://dash.cloudflare.com  
✅ **Node.js** (v18+) : https://nodejs.org  
✅ **npm** (inclus avec Node.js)  
✅ **Git** : https://git-scm.com  
✅ **Wrangler CLI** : https://developers.cloudflare.com/workers/wrangler/install-and-update/

### Installer Wrangler
```bash
npm install -g wrangler
```

Vérifie l'installation :
```bash
wrangler --version
```

### S'authentifier avec Cloudflare
```bash
wrangler login
```

Cela ouvrira un navigateur pour autoriser Wrangler à accéder à ton compte Cloudflare.

---

## Étape 1 : Créer la base de données D1

D1 est la base de données SQLite gérée de Cloudflare.

```bash
wrangler d1 create noella-prod-db
```

**Résultat attendu :**
```
✅ Successfully created D1 database 'noella-prod-db'
binding = "DB"
database_id = "12345678-abcd-ef01-2345-6789abcdef01"
```

📌 **Copie la valeur de `database_id`** (tu en auras besoin très bientôt)

---

## Étape 2 : Créer le KV Namespace

KV est utilisé pour le rate limiting (limiter les requêtes par IP).

```bash
wrangler kv:namespace create NP_KV
```

**Résultat attendu :**
```
✅ Successfully created KV namespace "NP_KV"
binding = "NP_KV"
id = "abcdef1234567890abcdef1234567890"
```

📌 **Copie la valeur de `id`**

---

## Étape 3 : Mettre à jour wrangler.toml

Ouvre `wrangler.toml` à la racine du projet et remplace les valeurs de placeholder :

**Avant :**
```toml
[[d1_databases]]
binding      = "DB"
database_name = "noella-prod-db"
database_id  = "REMPLACER_PAR_VOTRE_DATABASE_ID"

[[kv_namespaces]]
binding = "NP_KV"
id      = "REMPLACER_PAR_VOTRE_KV_ID"
```

**Après :**
```toml
[[d1_databases]]
binding      = "DB"
database_name = "noella-prod-db"
database_id  = "12345678-abcd-ef01-2345-6789abcdef01"

[[kv_namespaces]]
binding = "NP_KV"
id      = "abcdef1234567890abcdef1234567890"
```

Sauvegarde le fichier.

---

## Étape 4 : Initialiser le schéma de la base

Exécute le fichier `db/schema.sql` pour créer les tables :

```bash
wrangler d1 execute noella-prod-db --file=./db/schema.sql
```

**Résultat attendu :**
```
✅ Executing on remote database noella-prod-db...
```

Vérifies que les tables ont été créées :
```bash
wrangler d1 execute noella-prod-db --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Tu devrais voir les tables : `users`, `projects`, `messages`, `testimonials`

---

## Étape 5 : Créer un admin par défaut

Tu dois créer au moins un compte administrateur pour accéder au dashboard.

### A. Générer un hash de mot de passe

Utilise le worker en mode local pour générer un hash sécurisé. Crée un fichier `test-hash.js` :

```javascript
async function hashPassword(password) {
  const salt = crypto.randomUUID();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password + salt));
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hash}`;
}

// Exemple : génère un hash pour le password "password123"
hashPassword('password123').then(h => console.log(h));
```

Ou utilise Node.js :
```bash
node -e "
const crypto = require('crypto');
const password = 'password123';
const salt = crypto.randomUUID();
const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
console.log(salt + ':' + hash);
"
```

**Copie le résultat** (ex: `uuid:hash`)

### B. Insérer l'admin dans la base

```bash
wrangler d1 execute noella-prod-db --command "INSERT INTO users (username, password_hash, email, created_at) VALUES ('admin', 'COLLE_LE_HASH_ICI', 'admin@noella-prod.com', datetime('now'))"
```

Remplace `COLLE_LE_HASH_ICI` par le hash généré.

**Exemple complet :**
```bash
wrangler d1 execute noella-prod-db --command "INSERT INTO users (username, password_hash, email, created_at) VALUES ('admin', '550e8400-e29b-41d4-a716-446655440000:abc123def456...', 'admin@noella-prod.com', datetime('now'))"
```

Vérifie que l'user a été créé :
```bash
wrangler d1 execute noella-prod-db --command "SELECT id, username, email FROM users;"
```

---

## Étape 6 : Déployer le Worker (API)

Le Worker gère l'API `/api/*` et l'authentification.

```bash
wrangler deploy
```

**Résultat attendu :**
```
✅ Uploaded worker bundle (123.4 KB)
✅ Deployed to https://noella-prod.YOUR_DOMAIN.workers.dev
```

📌 **Copie l'URL du worker** (tu en auras besoin dans les pages HTML)

### Tester le Worker localement (optionnel)

```bash
wrangler dev
```

Visite `http://localhost:8787/api/projects` pour tester.

---

## Étape 7 : Déployer Cloudflare Pages (Frontend)

Cloudflare Pages héberge le frontend statique (HTML, CSS, JS).

### Option A : Via Wrangler (simple)

```bash
wrangler pages deploy ./public
```

**Résultat :**
```
✅ Deploying to Cloudflare Pages
✅ Project name: noella-prod
✅ URL: https://noella-prod.pages.dev
```

### Option B : Via Git (recommandé pour production)

1. Pousse ton projet sur GitHub :
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/noella-prod.git
git push -u origin main
```

2. Va sur https://pages.cloudflare.com
3. Clique sur "Create a project"
4. Sélectionne ton repo GitHub `noella-prod`
5. Configure :
   - **Build command** : (laisse vide)
   - **Build output directory** : `public`
6. Clique sur "Save and Deploy"

---

## Étape 8 : Accéder au Dashboard Admin

### URL de connexion

```
https://noella-prod.pages.dev/admin/login.html
```

### Identifiants par défaut

- **Username** : `admin`
- **Password** : celui que tu as utilisé à l'étape 5

### Fonctionnalités du Dashboard

| Page | URL | Fonction |
|------|-----|----------|
| Login | `/admin/login.html` | Authentification |
| Dashboard | `/admin/dashboard.html` | Stats, messages récents, projets |
| Projets | `/admin/projects.html` | Créer/éditer/supprimer réalisations |
| Messages | `/admin/messages.html` | Voir les messages de contact |
| Avis | `/admin/testimonials.html` | Gérer les témoignages clients |
| Services | `/admin/services-admin.html` | Gérer les services |
| Paramètres | `/admin/settings.html` | Configuration générale |

### Créer un projet dans l'admin

1. Va sur `/admin/dashboard.html`
2. Clique sur "Ajouter un projet"
3. Remplis :
   - **Titre** : Nom du projet
   - **Description** : Détails
   - **Image** : URL de la thumbnail
   - **Vidéo** : URL YouTube/MP4
   - **Catégorie** : ex. "Cinema", "Music"
   - **Statut** : "Draft" ou "Published"
4. Clique sur "Publier"

Les projets publiés apparaissent sur `/portfolio.html` automatiquement.

---

## Troubleshooting

### ❌ "Unauthorized" au login

**Problème :** Le mot de passe ou username est incorrect  
**Solution :** Réinitialise l'admin (voir étape 5.B)

### ❌ "404 Not Found" sur API

**Problème :** Le Worker n'est pas déployé  
**Solution :**
```bash
wrangler deploy
```

### ❌ "Database error" lors du déploiement

**Problème :** D1 n'est pas lié correctement  
**Solution :** Vérifies `wrangler.toml` :
```bash
wrangler d1 info noella-prod-db
```

### ❌ CSS/JS non chargés

**Problème :** Les chemins d'importation sont incorrects  
**Solution :** Vérifies que les URLs utilisent des chemins relatifs :
```html
<link rel="stylesheet" href="../assets/css/style.css">
<script src="../assets/js/main.js"></script>
```

### ❌ Pages n'affiche que le header/footer

**Problème :** Les fichiers d'assets ne sont pas déployés  
**Solution :** Assure-toi que `assets/` est inclus dans le déploiement :
```bash
wrangler pages deploy ./ --project-name noella-prod
```

### ❌ "Rate limit exceeded"

**Problème :** Trop de requêtes (plus de 5 messages en 60s)  
**Solution :** C'est normal, attends 60 secondes avant de réessayer

---

## Commandes utiles

```bash
# Vérifier le statut du Worker
wrangler whoami

# Voir les logs du Worker
wrangler tail

# Exécuter une commande SQL
wrangler d1 execute noella-prod-db --command "SELECT COUNT(*) FROM projects;"

# Télécharger les données de D1
wrangler d1 backup download noella-prod-db

# Redéployer tout
wrangler deploy && wrangler pages deploy ./public
```

---

## Variables d'environnement

Si tu veux ajouter des secrets (comme un JWT_SECRET personnalisé) :

```bash
wrangler secret put JWT_SECRET
# Puis entre ta clé secrète (min 32 caractères)
```

Dans le code, accède-y via `env.JWT_SECRET`.

---

## Support

- **Documentation Cloudflare Workers** : https://developers.cloudflare.com/workers/
- **Documentation D1** : https://developers.cloudflare.com/d1/
- **Documentation Pages** : https://developers.cloudflare.com/pages/

---

**✅ Après avoir suivi tous ces étapes, ton site et ton dashboard doivent être en ligne !**

Pour les mises à jour futures, tu n'as qu'à faire :
```bash
git push  # Si tu utilises Pages + Git
wrangler deploy  # Pour mettre à jour l'API
```
