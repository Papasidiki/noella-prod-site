/* ============================================================
   NOELLA-PROD Admin — admin.js
   Shared utilities: auth, sidebar, toast, modal, API calls
   ============================================================ */

const API = 'https://noella-prod.sanoh5347.workers.dev/api';

/* ── Auth Guard ─────────────────────────────────────────── */
function getToken() {
  return localStorage.getItem('np_token');
}

function authGuard() {
  if (!getToken()) {
    window.location.href = 'login.html';
  }
}

function logout() {
  if (!confirm('Confirmer la déconnexion ?')) return;
  localStorage.removeItem('np_token');
  localStorage.removeItem('np_user');
  window.location.href = 'login.html';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

/* ── API Helper ──────────────────────────────────────────── */
async function apiGet(path) {
  const res = await fetch(API + path, { headers: authHeaders() });
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(API + path, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(API + path, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

/* ── Toast ───────────────────────────────────────────────── */
function showToast(message, type = 'success') {
  let toast = document.getElementById('adminToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.className = 'toast-admin';
    toast.innerHTML = `<i id="toastIcon"></i><span id="toastText"></span>`;
    document.body.appendChild(toast);
  }
  const icon = document.getElementById('toastIcon');
  toast.className = `toast-admin ${type}`;
  icon.className = type === 'success'
    ? 'fa-solid fa-circle-check text-success'
    : 'fa-solid fa-circle-exclamation text-danger';
  document.getElementById('toastText').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ── Modal helpers ───────────────────────────────────────── */
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

/* ── Sidebar init ────────────────────────────────────────── */
function initSidebar() {
  // Logout buttons
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', logout);
  });

  // Show user info
  const user = JSON.parse(localStorage.getItem('np_user') || '{}');
  const usernameEl = document.getElementById('sidebarUsername');
  if (usernameEl) usernameEl.textContent = user.username || 'Admin';

  // Active link
  const page = window.location.pathname.split('/').pop();
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });

  // Mobile toggle
  const toggle   = document.getElementById('sidebarToggle');
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('show');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar?.classList.remove('open');
      overlay.classList.remove('show');
    });
  }
}

/* ── Escape HTML ─────────────────────────────────────────── */
function escHtml(str = '') {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

/* ── Format date ─────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

/* ── Confirm dialog ──────────────────────────────────────── */
function confirmDelete(message) {
  return confirm(message || 'Confirmer la suppression ?');
}

/* ── Auto-init on DOM ready ──────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  authGuard();
  initSidebar();
});
