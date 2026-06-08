/* ============================================================
   NOELLA-PROD — main.js
   ============================================================ */

const API_BASE = '/api';

/* ── Scroll Reveal ─────────────────────────────────────────── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));


/* ── Navbar scroll ─────────────────────────────────────────── */
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  });
}

/* ── Mobile menu ───────────────────────────────────────────── */
const hamburger   = document.getElementById('hamburger');
const mobileMenu  = document.getElementById('mobileMenu');
const mobileClose = document.getElementById('mobileClose');

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => mobileMenu.classList.add('open'));
  mobileClose?.addEventListener('click', () => mobileMenu.classList.remove('open'));
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });
}

/* ── Active nav link ───────────────────────────────────────── */
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach(a => {
  const href = a.getAttribute('href');
  if (href === currentPage || (currentPage === '' && href === 'index.html')) {
    a.classList.add('active');
  }
});

/* ── Toast notification ────────────────────────────────────── */
function showToast(message, type = 'success') {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast-np';
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i><span id="toastMsg"></span>`;
    document.body.appendChild(toast);
  }
  const icon = toast.querySelector('i');
  toast.className = `toast-np ${type}`;
  icon.className = type === 'success'
    ? 'fa-solid fa-circle-check'
    : 'fa-solid fa-circle-exclamation';
  icon.style.color = type === 'success' ? '#22c55e' : '#e05252';
  toast.querySelector('#toastMsg').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

/* ── Portfolio loading & filtering ────────────────────────── */
async function loadPortfolio(containerId, limit = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '<div class="spinner-np"></div>';

  try {
    const res  = await fetch(`${API_BASE}/projects`);
    const data = await res.json();
    let projects = data.projects || [];
    if (limit) projects = projects.slice(0, limit);

    if (projects.length === 0) {
      container.innerHTML = `<p class="text-dim text-center py-4">Aucun projet disponible pour le moment.</p>`;
      return;
    }

    container.innerHTML = projects.map(p => `
      <div class="portfolio-item" data-category="${p.category || 'autre'}">
        <div class="portfolio-card card-np">
          <img src="${p.image || 'assets/images/placeholder.jpg'}" alt="${escHtml(p.title)}" loading="lazy">
          <div class="portfolio-overlay">
            <div>
              <span class="badge-np">${escHtml(p.category || 'Projet')}</span>
              <h4 style="color:#fff;margin-top:.5rem;font-size:1.1rem;">${escHtml(p.title)}</h4>
              <p style="color:var(--blanc-dim);font-size:.85rem;margin-top:.3rem;">${escHtml(p.description?.substring(0, 80) || '')}${p.description?.length > 80 ? '…' : ''}</p>
            </div>
          </div>
        </div>
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = `<p class="text-dim text-center py-4">Impossible de charger les projets.</p>`;
    console.error('Portfolio load error:', err);
  }
}

/* ── Portfolio filter buttons ─────────────────────────────── */
function initPortfolioFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  if (!filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      document.querySelectorAll('.portfolio-item').forEach(item => {
        const match = cat === 'all' || item.dataset.category === cat;
        item.classList.toggle('hidden', !match);
      });
    });
  });
}

/* ── Contact form ──────────────────────────────────────────── */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);

    const data = {
      name:    form.querySelector('#name')?.value.trim(),
      email:   form.querySelector('#email')?.value.trim(),
      phone:   form.querySelector('#phone')?.value.trim(),
      subject: form.querySelector('#subject')?.value,
      message: form.querySelector('#message')?.value.trim(),
    };

    let valid = true;

    if (!data.name || data.name.length < 2) {
      setError('nameError', 'Le nom doit contenir au moins 2 caractères.'); valid = false;
    }
    if (!isValidEmail(data.email)) {
      setError('emailError', 'Adresse email invalide.'); valid = false;
    }
    if (data.phone && !isValidPhone(data.phone)) {
      setError('phoneError', 'Numéro de téléphone invalide.'); valid = false;
    }
    if (!data.message || data.message.length < 10) {
      setError('messageError', 'Le message doit contenir au moins 10 caractères.'); valid = false;
    }
    if (!valid) return;

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Envoi en cours…';

    try {
      const res  = await fetch(`${API_BASE}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      const json = await res.json();

      if (res.ok) {
        form.reset();
        showToast('Message envoyé avec succès ! Nous vous répondrons sous 24h.', 'success');
      } else {
        showToast(json.error || 'Erreur lors de l\'envoi.', 'error');
      }
    } catch {
      showToast('Erreur réseau. Veuillez réessayer.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i>Envoyer le message';
    }
  });
}

/* ── Testimonials loader ───────────────────────────────────── */
async function loadTestimonials(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const res  = await fetch(`${API_BASE}/testimonials`);
    const data = await res.json();
    const list = data.testimonials || [];
    if (!list.length) return;
    container.innerHTML = list.map(t => `
      <div class="col-md-4">
        <div class="testimonial-card reveal">
          <p>${escHtml(t.message)}</p>
          <div class="testimonial-author">
            <div>
              <strong>${escHtml(t.name)}</strong><br>
              <span>${escHtml(t.role || '')}</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    container.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  } catch {}
}

/* ── Counter animation ─────────────────────────────────────── */
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    const duration = 1800;
    const step = target / (duration / 16);
    let current = 0;
    const update = () => {
      current = Math.min(current + step, target);
      el.textContent = Math.floor(current) + (el.dataset.suffix || '');
      if (current < target) requestAnimationFrame(update);
    };
    update();
  });
}

const statsObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    animateCounters();
    statsObserver.disconnect();
  }
}, { threshold: .5 });

const statsBar = document.querySelector('.stats-bar');
if (statsBar) statsObserver.observe(statsBar);

/* ── Helpers ───────────────────────────────────────────────── */
function escHtml(str = '') {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[\d\s\+\-\(\)]{7,20}$/.test(phone);
}

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('visible'); }
}

function clearErrors(form) {
  form.querySelectorAll('.form-error').forEach(e => {
    e.textContent = '';
    e.classList.remove('visible');
  });
}

/* ── Init on DOM ready ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initPortfolioFilters();
  initContactForm();
});
