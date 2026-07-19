/* ============================================================
   BipBooks — Admin Panel JS (Fixed: IndexedDB for large PDFs)
   PDF stored in IndexedDB | Metadata in localStorage
   ============================================================ */

(function() {
  'use strict';

  const META_KEY       = 'bipbooks_current_meta';   // only metadata, no PDF bytes
  const HISTORY_KEY    = 'bipbooks_issue_history';
  const ADMIN_PASS_KEY = 'bipbooks_admin_auth';
  const ADMIN_PASSWORD = 'bipbooks2026';
  const EXPIRE_DAYS    = 6;

  // ─── Auth ─────────────────────────────────────────────────
  function isLoggedIn() {
    return sessionStorage.getItem(ADMIN_PASS_KEY) === 'true';
  }
  function login(password) {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_PASS_KEY, 'true');
      return true;
    }
    return false;
  }
  function logout() {
    sessionStorage.removeItem(ADMIN_PASS_KEY);
    location.reload();
  }

  // ─── Login Screen ─────────────────────────────────────────
  function initLoginScreen() {
    const loginForm   = document.getElementById('admin-login-form');
    const loginError  = document.getElementById('login-error');
    const loginScreen = document.getElementById('admin-login-screen');
    const mainLayout  = document.getElementById('admin-main-layout');
    if (!loginForm) return;

    if (isLoggedIn()) {
      if (loginScreen) loginScreen.style.display = 'none';
      if (mainLayout)  mainLayout.style.display  = 'grid';
      initAdminPanel();
      return;
    }

    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainLayout)  mainLayout.style.display  = 'none';

    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const pass = document.getElementById('admin-password-input');
      if (!pass) return;
      if (login(pass.value)) {
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainLayout)  mainLayout.style.display  = 'grid';
        initAdminPanel();
      } else {
        if (loginError) {
          loginError.textContent = '❌ ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।';
          loginError.style.display = 'block';
        }
        pass.value = '';
        pass.focus();
      }
    });
  }

  // ─── Metadata helpers (localStorage — small, no PDF bytes) ──
  function getCurrentMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY)); }
    catch(e) { return null; }
  }
  function saveCurrentMeta(meta) {
    // Never store pdfData in meta!
    const { pdfData, ...safeMeta } = meta;
    localStorage.setItem(META_KEY, JSON.stringify(safeMeta));
  }
  function clearCurrentMeta() {
    const meta = getCurrentMeta();
    if (meta) addToHistory({ ...meta, archivedAt: new Date().toISOString() });
    localStorage.removeItem(META_KEY);
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch(e) { return []; }
  }
  function addToHistory(meta) {
    const h = getHistory();
    h.unshift(meta);
    if (h.length > 30) h.pop();
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); }
    catch(e) { /* history overflow, ignore */ }
  }

  function isExpired(meta) {
    if (!meta || !meta.publishedAt) return true;
    const exp = new Date(meta.publishedAt).getTime() + EXPIRE_DAYS * 86400000;
    return Date.now() >= exp;
  }
  function getExpireDate(meta) {
    if (!meta || !meta.publishedAt) return null;
    return new Date(new Date(meta.publishedAt).getTime() + EXPIRE_DAYS * 86400000);
  }
  function formatDate(d) {
    if (!d) return '—';
    var dt = new Date(d);
    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var dd  = String(dt.getDate()).padStart(2, '0');
    var mon = MONTHS[dt.getMonth()];
    var yr  = dt.getFullYear();
    var hh  = String(dt.getHours()).padStart(2, '0');
    var mm  = String(dt.getMinutes()).padStart(2, '0');
    return dd + ' ' + mon + ' ' + yr + ', ' + hh + ':' + mm;
  }

  // ─── File → ArrayBuffer ───────────────────────────────────
  function fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // ─── Main Admin Panel ─────────────────────────────────────
  function initAdminPanel() {
    initSidebar();
    initUploadPanel();
    initCurrentIssuePanel();
    initHistoryPanel();
    initStatsPanel();
    refreshAll();
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
  }

  // ─── Sidebar ──────────────────────────────────────────────
  function initSidebar() {
    const items  = document.querySelectorAll('.sidebar-nav-item[data-panel]');
    const panels = document.querySelectorAll('.admin-panel');
    items.forEach(item => {
      item.addEventListener('click', function() {
        items.forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        panels.forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(this.dataset.panel);
        if (panel) panel.classList.add('active');
        const title = document.getElementById('panel-title');
        if (title) title.textContent = this.querySelector('.nav-label')?.textContent || 'Admin';
      });
    });
  }

  // ─── Upload Panel ─────────────────────────────────────────
  function initUploadPanel() {
    const zone         = document.getElementById('upload-zone');
    const fileInput    = document.getElementById('pdf-file-input');
    const uploadBtn    = document.getElementById('upload-submit-btn');
    const progressWrap = document.getElementById('upload-progress-wrap');
    const progressFill = document.getElementById('upload-progress-fill');
    const progressPct  = document.getElementById('upload-progress-pct');

    let selectedFile = null;

    function updateZoneUI(file) {
      if (!zone) return;
      const sub = zone.querySelector('.upload-sub');
      if (sub) sub.innerHTML = `<span style="color:#00e676">📎 ${file.name}</span> — <span>${(file.size/1024/1024).toFixed(2)} MB</span>`;
      const fnEl = document.getElementById('selected-file-name');
      if (fnEl) {
        fnEl.textContent = `✅ নির্বাচিত: ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
        fnEl.style.color = '#00e676';
      }
    }
    function resetZoneUI() {
      if (!zone) return;
      const sub = zone.querySelector('.upload-sub');
      if (sub) sub.innerHTML = 'PDF ফাইল এখানে টানুন অথবা <span>ক্লিক করুন</span>';
      const fnEl = document.getElementById('selected-file-name');
      if (fnEl) { fnEl.textContent = ''; }
    }

    // Drag & drop
    if (zone) {
      zone.addEventListener('click',     () => fileInput && fileInput.click());
      zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop',      e => {
        e.preventDefault(); zone.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f?.type === 'application/pdf') { selectedFile = f; updateZoneUI(f); }
        else adminToast('❌ শুধুমাত্র PDF ফাইল গ্রহণযোগ্য।', 'error');
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (f) { selectedFile = f; updateZoneUI(f); }
      });
    }

    if (uploadBtn) {
      uploadBtn.addEventListener('click', async function() {
        if (!selectedFile) { adminToast('⚠️ আগে একটি PDF ফাইল নির্বাচন করুন।', 'error'); return; }

        const title    = document.getElementById('issue-title')?.value?.trim();
        const pubDate  = document.getElementById('issue-pub-date')?.value;
        const issueNum = document.getElementById('issue-number')?.value?.trim();

        if (!title)   { adminToast('⚠️ ম্যাগাজিনের শিরোনাম দিন।', 'error'); return; }
        if (!pubDate) { adminToast('⚠️ প্রকাশের তারিখ ও সময় দিন।', 'error'); return; }

        // Start upload
        uploadBtn.disabled = true;
        uploadBtn.textContent = '⏳ প্রক্রিয়া চলছে...';
        if (progressWrap) progressWrap.style.display = 'block';
        if (progressFill) progressFill.style.width = '0%';

        // Animate progress bar while reading file
        let prog = 0;
        const fakeProgress = setInterval(() => {
          prog = Math.min(prog + Math.random() * 10, 85);
          if (progressFill) progressFill.style.width = prog + '%';
          if (progressPct) progressPct.textContent = Math.round(prog) + '%';
        }, 200);

        try {
          // Read file as ArrayBuffer (no base64 bloat)
          const arrayBuffer = await fileToArrayBuffer(selectedFile);

          clearInterval(fakeProgress);
          if (progressFill) progressFill.style.width = '90%';
          if (progressPct) progressPct.textContent = '90%';

          const issueId = Date.now();

          // Save PDF binary to IndexedDB
          await BipBooksDB.savePDF(issueId, arrayBuffer);

          if (progressFill) progressFill.style.width = '100%';
          if (progressPct) progressPct.textContent = '100%';

          // Archive old issue
          const oldMeta = getCurrentMeta();
          if (oldMeta) {
            // Delete old PDF from IndexedDB
            if (oldMeta.id) {
              BipBooksDB.deletePDF(oldMeta.id).catch(() => {});
            }
            addToHistory({ ...oldMeta, archivedAt: new Date().toISOString() });
          }

          // Save new metadata (no PDF bytes) to localStorage
          const newMeta = {
            id:          issueId,
            title:       title,
            issueNumber: issueNum || 'N/A',
            fileName:    selectedFile.name,
            fileSize:    selectedFile.size,
            publishedAt: new Date(pubDate).toISOString(),
            uploadedAt:  new Date().toISOString()
          };
          saveCurrentMeta(newMeta);

          // Also update the key that realtime.js / epaper.js reads
          // We write a signal to tell epaper.js to reload
          localStorage.setItem('bipbooks_current_issue', JSON.stringify({ ...newMeta, hasIDB: true }));

          setTimeout(() => {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '✅ আপলোড সম্পন্ন!';
            if (progressWrap) progressWrap.style.display = 'none';

            selectedFile = null;
            if (fileInput) fileInput.value = '';
            resetZoneUI();

            adminToast('🎉 ম্যাগাজিন সফলভাবে প্রকাশিত হয়েছে!', 'success');
            refreshAll();
            setTimeout(() => { uploadBtn.textContent = '📤 ম্যাগাজিন প্রকাশ করুন'; }, 2500);
          }, 600);

        } catch(err) {
          clearInterval(fakeProgress);
          uploadBtn.disabled = false;
          uploadBtn.textContent = '📤 ম্যাগাজিন প্রকাশ করুন';
          if (progressWrap) progressWrap.style.display = 'none';
          console.error('Upload error:', err);
          adminToast('❌ আপলোড ব্যর্থ: ' + (err.message || err), 'error');
        }
      });
    }
  }

  // ─── Current Issue Panel ──────────────────────────────────
  function initCurrentIssuePanel() {
    // Delete button re-bound after render
  }

  function bindDeleteBtn() {
    const btn = document.getElementById('delete-issue-btn');
    if (!btn) return;
    btn.addEventListener('click', async function() {
      if (!confirm('সত্যিই কি এই ম্যাগাজিনটি মুছে ফেলতে চান?')) return;
      const meta = getCurrentMeta();
      if (meta?.id) await BipBooksDB.deletePDF(meta.id).catch(() => {});
      clearCurrentMeta();
      localStorage.removeItem('bipbooks_current_issue');
      adminToast('🗑️ ম্যাগাজিন মুছে ফেলা হয়েছে।', 'success');
      refreshAll();
    });
  }

  // ─── Refresh All ──────────────────────────────────────────
  function refreshAll() {
    renderCurrentIssue();
    renderHistory();
    renderStats();
  }

  // ─── Render Current Issue ─────────────────────────────────
  function renderCurrentIssue() {
    const container = document.getElementById('current-issue-container');
    if (!container) return;

    const meta = getCurrentMeta();
    if (!meta) {
      container.innerHTML = `<div class="no-issue-msg">📰 কোনো সক্রিয় ম্যাগাজিন নেই। উপরে আপলোড করুন।</div>`;
      return;
    }

    const expired = isExpired(meta);
    const expDate = getExpireDate(meta);
    let cdHtml = '';
    if (!expired && expDate) {
      const diff = expDate - Date.now();
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000)  / 60000);
      cdHtml = `<div class="issue-countdown">মেয়াদ শেষ: <span>${d} দিন ${h} ঘন্টা ${m} মিনিট</span></div>`;
    }

    const sizeMB = meta.fileSize ? (meta.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '—';
    container.innerHTML = `
      <div class="current-issue-card">
        <div class="issue-info">
          <div class="issue-icon">📰</div>
          <div class="issue-details">
            <div class="issue-name">${meta.title || 'অজানা'}</div>
            <div class="issue-meta">
              সংখ্যা: <span>#${meta.issueNumber || '—'}</span> &nbsp;|&nbsp;
              প্রকাশ: <span>${formatDate(meta.publishedAt)}</span> &nbsp;|&nbsp;
              আকার: <span>${sizeMB}</span>
            </div>
            ${cdHtml}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span class="issue-status-badge ${expired ? 'expired' : 'active'}">${expired ? '⏰ মেয়াদ শেষ' : '✅ সক্রিয়'}</span>
          <a href="index.html" target="_blank" class="btn-admin btn-admin-cyan" style="font-size:0.78rem;">🔗 দেখুন</a>
          <button id="delete-issue-btn" class="btn-admin btn-admin-red" style="font-size:0.78rem;">🗑️ মুছুন</button>
        </div>
      </div>
      ${expired ? `<div style="padding:12px 0;font-size:0.83rem;color:rgba(255,64,129,0.8);">⚠️ এই ম্যাগাজিনের মেয়াদ শেষ। নতুন আপলোড করুন।</div>` : ''}
    `;
    bindDeleteBtn();
  }

  // ─── Render History ───────────────────────────────────────
  function renderHistory() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    const h = getHistory();
    if (!h.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:rgba(255,255,255,0.3);padding:24px">কোনো ইতিহাস নেই</td></tr>`;
      return;
    }
    tbody.innerHTML = h.map(m => {
      const exp = isExpired(m) || !!m.archivedAt || !!m.deletedAt;
      return `<tr>
        <td>${m.title || '—'}</td>
        <td>#${m.issueNumber || '—'}</td>
        <td>${formatDate(m.publishedAt)}</td>
        <td>${formatDate(m.archivedAt || m.deletedAt || m.uploadedAt)}</td>
        <td class="${exp ? 'badge-expired' : 'badge-active'}">${exp ? '⏰ মেয়াদ শেষ' : '✅ সক্রিয়'}</td>
      </tr>`;
    }).join('');
  }

  // ─── Render Stats ─────────────────────────────────────────
  function renderStats() {
    const meta    = getCurrentMeta();
    const history = getHistory();
    const total   = history.length + (meta ? 1 : 0);
    const active  = meta && !isExpired(meta) ? 1 : 0;
    const expired = history.filter(m => isExpired(m)).length;
    const totalSz = [...history, meta].filter(Boolean).reduce((s, m) => s + (m.fileSize || 0), 0);

    const el = id => document.getElementById(id);
    if (el('stat-total-issues'))   el('stat-total-issues').textContent   = total;
    if (el('stat-active-issue'))   el('stat-active-issue').textContent   = active;
    if (el('stat-expired-issues')) el('stat-expired-issues').textContent = expired;
    if (el('stat-total-size'))     el('stat-total-size').textContent     = (totalSz / 1024 / 1024).toFixed(1) + ' MB';
    if (el('admin-issue-status'))  el('admin-issue-status').textContent  =
      !meta ? 'কোনো ম্যাগাজিন নেই' : isExpired(meta) ? 'মেয়াদ শেষ' : 'সক্রিয়';
  }

  // ─── Admin Toast ──────────────────────────────────────────
  let toastTimer;
  function adminToast(msg, type) {
    const toast = document.getElementById('admin-toast');
    const msgEl = document.getElementById('admin-toast-msg');
    if (!toast) return;
    if (msgEl) msgEl.textContent = msg;
    toast.className = 'admin-toast show ' + (type || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 5000);
  }

  // ─── Auto-expire check ────────────────────────────────────
  setInterval(refreshAll, 60000);

  // ─── Start ────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', initLoginScreen);
})();
