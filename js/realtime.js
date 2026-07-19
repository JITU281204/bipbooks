/* ============================================================
   BipBooks — Realtime Clock, Countdown & Auto-Expire Logic
   ============================================================ */

// ─── Config ─────────────────────────────────────────────────
const BIPBOOKS_EXPIRE_DAYS = 6;          // Magazine expires after 6 days
const BIPBOOKS_STORAGE_KEY = 'bipbooks_current_issue';

// ─── Hardcoded English arrays — ZERO locale dependency ───────
var _DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
               'Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Realtime Clock ──────────────────────────────────────────
function updateClock() {
  var now = new Date();

  // TIME: HH:MM:SS — pure manual, no locale
  var h = String(now.getHours()).padStart(2, '0');
  var m = String(now.getMinutes()).padStart(2, '0');
  var s = String(now.getSeconds()).padStart(2, '0');
  var time = h + ':' + m + ':' + s;

  // DATE: "Sun, Jul 19, 2026" — hardcoded English, never Bengali
  var day   = _DAYS[now.getDay()];
  var mon   = _MONTHS[now.getMonth()];
  var date  = day + ', ' + mon + ' ' + now.getDate() + ', ' + now.getFullYear();

  // Update main site clock
  var clockTimeEl = document.getElementById('clock-time');
  var clockDateEl = document.getElementById('clock-date');
  if (clockTimeEl) clockTimeEl.textContent = time;
  if (clockDateEl) clockDateEl.textContent = date;

  // Update admin panel clock (same English format)
  var adminTimeEl = document.getElementById('admin-clock-time');
  var adminDateEl = document.getElementById('admin-clock-date');
  if (adminTimeEl) adminTimeEl.textContent = time;
  if (adminDateEl) adminDateEl.textContent = date;
}

// ─── Get Current Issue Data ──────────────────────────────────
function getCurrentIssue() {
  try {
    const raw = localStorage.getItem(BIPBOOKS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) {
    return null;
  }
}

// ─── Check if Issue is Expired ───────────────────────────────
function isIssueExpired(issue) {
  if (!issue || !issue.publishedAt) return true;
  const published = new Date(issue.publishedAt);
  const expireAt = new Date(published.getTime() + BIPBOOKS_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
  return new Date() >= expireAt;
}

// ─── Get Expire Date ─────────────────────────────────────────
function getExpireDate(issue) {
  if (!issue || !issue.publishedAt) return null;
  const published = new Date(issue.publishedAt);
  return new Date(published.getTime() + BIPBOOKS_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
}

// ─── Format Date — HARDCODED English, zero locale ────────────
var _FMT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDateBN(dateStr) {
  try {
    var d   = new Date(dateStr);
    var dd  = String(d.getDate()).padStart(2, '0');
    var mon = _FMT_MONTHS[d.getMonth()];
    var yr  = d.getFullYear();
    var hh  = String(d.getHours()).padStart(2, '0');
    var mm  = String(d.getMinutes()).padStart(2, '0');
    return dd + ' ' + mon + ' ' + yr + ', ' + hh + ':' + mm;
  } catch(e) { return dateStr; }
}

// ─── Update Countdown ────────────────────────────────────────
function updateCountdown() {
  const issue = getCurrentIssue();

  if (!issue) {
    hideCountdown();
    showNoPDF();
    return;
  }

  if (isIssueExpired(issue)) {
    hideCountdown();
    showComingSoon(issue);
    return;
  }

  const expireAt = getExpireDate(issue);
  const now = new Date();
  const diff = expireAt - now;

  if (diff <= 0) {
    hideCountdown();
    showComingSoon(issue);
    return;
  }

  const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs  = Math.floor((diff % (1000 * 60)) / 1000);

  const cd = document.getElementById('epaper-countdown-wrap');
  if (cd) cd.style.display = 'flex';

  const el = (id) => document.getElementById(id);
  if (el('cd-days'))  el('cd-days').textContent  = String(days).padStart(2,'0');
  if (el('cd-hours')) el('cd-hours').textContent = String(hours).padStart(2,'0');
  if (el('cd-mins'))  el('cd-mins').textContent  = String(mins).padStart(2,'0');
  if (el('cd-secs'))  el('cd-secs').textContent  = String(secs).padStart(2,'0');

  // Publish date
  const pubEl = document.getElementById('pub-date-val');
  if (pubEl && issue.publishedAt) {
    pubEl.textContent = formatDateBN(issue.publishedAt);
  }

  // Show publish badge
  const badge = document.getElementById('publish-badge');
  if (badge) badge.style.display = 'flex';
  const dateText = document.getElementById('publish-date-text');
  if (dateText) dateText.style.display = 'block';
}

// ─── Countdown for Next Issue (Coming Soon) ──────────────────
function updateNextIssueCountdown() {
  const issue = getCurrentIssue();
  if (!issue) return;

  const expireAt = getExpireDate(issue);
  if (!expireAt) return;

  // Next issue = expireAt + buffer (assume next Sunday)
  const nextIssue = new Date(expireAt.getTime() + 1 * 24 * 60 * 60 * 1000); // 1 day after expire
  const now = new Date();
  const diff = nextIssue - now;

  if (diff <= 0) return;

  const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  const el = (id) => document.getElementById(id);
  if (el('ni-days'))  el('ni-days').textContent  = String(days).padStart(2,'0');
  if (el('ni-hours')) el('ni-hours').textContent = String(hours).padStart(2,'0');
  if (el('ni-mins'))  el('ni-mins').textContent  = String(mins).padStart(2,'0');
}

// ─── UI State helpers ────────────────────────────────────────
function hideCountdown() {
  const cd = document.getElementById('epaper-countdown-wrap');
  if (cd) cd.style.display = 'none';
  const badge = document.getElementById('publish-badge');
  if (badge) badge.style.display = 'none';
  const dateText = document.getElementById('publish-date-text');
  if (dateText) dateText.style.display = 'none';
}

function showNoPDF() {
  const noPdf = document.getElementById('no-pdf-msg');
  const loading = document.getElementById('epaper-loading');
  const canvas = document.getElementById('epaper-canvas');
  const overlay = document.getElementById('ep-click-overlay');
  const comingSoon = document.getElementById('epaper-coming-soon');

  if (loading) loading.style.display = 'none';
  if (canvas)  canvas.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  if (comingSoon) comingSoon.style.display = 'none';
  if (noPdf)   noPdf.style.display = 'block';
}

function showComingSoon(issue) {
  const noPdf = document.getElementById('no-pdf-msg');
  const loading = document.getElementById('epaper-loading');
  const canvas = document.getElementById('epaper-canvas');
  const overlay = document.getElementById('ep-click-overlay');
  const comingSoon = document.getElementById('epaper-coming-soon');

  if (loading) loading.style.display = 'none';
  if (canvas)  canvas.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  if (noPdf)   noPdf.style.display = 'none';
  if (comingSoon) comingSoon.style.display = 'flex';

  updateNextIssueCountdown();
}

// ─── Admin Stats update ──────────────────────────────────────
function updateAdminStats() {
  const issue = getCurrentIssue();

  const statusEl = document.getElementById('admin-issue-status');
  if (!statusEl) return;

  if (!issue) {
    statusEl.textContent = 'কোনো ম্যাগাজিন নেই';
    return;
  }

  if (isIssueExpired(issue)) {
    statusEl.textContent = 'মেয়াদ শেষ';
  } else {
    statusEl.textContent = 'সক্রিয়';
  }
}

// ─── Main interval tick ──────────────────────────────────────
function tick() {
  updateClock();
  updateCountdown();
  if (document.getElementById('ni-days')) {
    updateNextIssueCountdown();
  }
  updateAdminStats();
}

// Initialize only after DOM is ready — prevents flicker
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    tick();
    setInterval(tick, 1000);
  });
} else {
  // DOM already ready (script loaded at bottom)
  tick();
  setInterval(tick, 1000);
}
