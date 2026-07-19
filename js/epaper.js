/* ============================================================
   BipBooks — ePaper PDF Viewer (IndexedDB version)
   Reads PDF from IndexedDB | Metadata from localStorage
   Left click = prev page | Right click = next page
   ============================================================ */

(function() {
  'use strict';

  const STORAGE_KEY  = 'bipbooks_current_issue';  // metadata signal key
  const EXPIRE_DAYS  = 6;

  // ─── State ────────────────────────────────────────────────
  let pdfDoc      = null;
  let pageNum     = 1;
  let totalPages  = 0;
  let scale       = 1.4;
  let isRendering = false;
  let renderTask  = null;
  window.bipbooksIsPremium = false; // Global flag for premium status

  const MIN_SCALE  = 0.5;
  const MAX_SCALE  = 3.0;
  const SCALE_STEP = 0.2;
  const FREE_PAGE_LIMIT = 3; // Pages allowed for free users

  // ─── DOM Refs ─────────────────────────────────────────────
  const canvas       = document.getElementById('epaper-canvas');
  const ctx          = canvas ? canvas.getContext('2d') : null;
  const loadingEl    = document.getElementById('epaper-loading');
  const overlayEl    = document.getElementById('ep-click-overlay');
  const paywallEl    = document.getElementById('epaper-paywall');
  const noPdfEl      = document.getElementById('no-pdf-msg');
  const comingSoonEl = document.getElementById('epaper-coming-soon');
  const progressEl   = document.getElementById('ep-progress');
  const pageNumEl    = document.getElementById('ep-current-page');
  const totalPgEl    = document.getElementById('ep-total-pages');
  const zoomValEl    = document.getElementById('ep-zoom-val');
  const shortcutEl   = document.getElementById('ep-shortcuts-hint');

  // ─── Helpers ──────────────────────────────────────────────
  function getMeta() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
    catch(e) { return null; }
  }
  function isExpiredMeta(meta) {
    if (!meta || !meta.publishedAt) return true;
    const exp = new Date(meta.publishedAt).getTime() + EXPIRE_DAYS * 86400000;
    return Date.now() >= exp;
  }

  // ─── Show/hide states ─────────────────────────────────────
  function showState(state) {
    if (loadingEl)    loadingEl.style.display    = state === 'loading'     ? 'flex'  : 'none';
    if (canvas)       canvas.style.display       = state === 'canvas'      ? 'block' : 'none';
    if (overlayEl)    overlayEl.style.display    = state === 'canvas'      ? 'flex'  : 'none';
    if (noPdfEl)      noPdfEl.style.display      = state === 'no-pdf'      ? 'block' : 'none';
    if (comingSoonEl) comingSoonEl.style.display = state === 'coming-soon' ? 'flex'  : 'none';
  }

  function showErrorMsg(msg) {
    showState('no-pdf');
    if (noPdfEl) noPdfEl.innerHTML = `
      <div style="font-size:3rem;margin-bottom:12px">⚠️</div>
      <p style="color:var(--neon-orange,#ff6d00);font-size:0.9rem;">${msg}</p>`;
  }

  // ─── Load ePaper ──────────────────────────────────────────
  async function loadEPaper() {
    if (typeof pdfjsLib === 'undefined') {
      showState('no-pdf');
      if (noPdfEl) noPdfEl.innerHTML = `
        <div style="font-size:3.5rem;margin-bottom:16px">📰</div>
        <p style="font-size:1rem;font-weight:600;color:var(--text-secondary)">ই-পেপার ভিউয়ার প্রস্তুত</p>
        <p style="font-size:0.82rem;color:var(--text-muted)">Admin প্যানেল থেকে PDF আপলোড করুন।</p>`;
      return;
    }

    const meta = getMeta();

    if (!meta) { showState('no-pdf'); return; }

    if (isExpiredMeta(meta)) { showState('coming-soon'); updateNextIssueCD(meta); return; }

    // Need to load PDF from IndexedDB
    if (!meta.id) { showState('no-pdf'); return; }

    showState('loading');

    try {
      if (typeof BipBooksDB === 'undefined') {
        throw new Error('IndexedDB helper (idb.js) not loaded.');
      }

      const arrayBuffer = await BipBooksDB.getPDF(meta.id);
      if (!arrayBuffer) {
        // PDF not found in IndexedDB (maybe different browser/cleared)
        showErrorMsg('PDF ডেটা খুঁজে পাওয়া যায়নি। Admin থেকে পুনরায় আপলোড করুন।');
        return;
      }

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

      loadingTask.promise.then(function(pdf) {
        pdfDoc     = pdf;
        totalPages = pdf.numPages;
        if (totalPgEl) totalPgEl.textContent = bn(totalPages);
        renderPage(1);
      }).catch(function(err) {
        console.error('PDF.js load error:', err);
        showErrorMsg('PDF লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      });

    } catch(err) {
      console.error('loadEPaper error:', err);
      showErrorMsg('ত্রুটি: ' + err.message);
    }
  }

  // ─── Render Page ──────────────────────────────────────────
  function renderPage(num) {
    if (!pdfDoc || isRendering) return;
    isRendering = true;
    pageNum = num;

    pdfDoc.getPage(num).then(function(page) {
      const viewport = page.getViewport({ scale });
      canvas.height  = viewport.height;
      canvas.width   = viewport.width;

      if (renderTask) { renderTask.cancel(); }

      renderTask = page.render({ canvasContext: ctx, viewport });
      renderTask.promise.then(function() {
        isRendering = false; renderTask = null;
        showState('canvas');
        updateUI();


      }).catch(function(err) {
        if (err?.name !== 'RenderingCancelledException') console.error('Render:', err);
        isRendering = false;
      });
    }).catch(function(err) {
      console.error('getPage:', err); isRendering = false;
    });
  }

  // ─── Navigation ───────────────────────────────────────────
  function prevPage() {
    if (!pdfDoc || pageNum <= 1) return;
    flipAnim('right'); renderPage(pageNum - 1);
  }
  function nextPage() {
    if (!pdfDoc || pageNum >= totalPages) return;
    flipAnim('left'); renderPage(pageNum + 1);
  }
  function goToPage(num) {
    if (!pdfDoc) return;
    num = Math.max(1, Math.min(totalPages, num));
    if (num === pageNum) return;
    flipAnim(num > pageNum ? 'left' : 'right');
    renderPage(num);
  }

  function flipAnim(dir) {
    if (!canvas) return;
    canvas.classList.remove('flip-left', 'flip-right');
    void canvas.offsetWidth;
    canvas.classList.add('flip-' + dir);
    setTimeout(() => canvas.classList.remove('flip-left', 'flip-right'), 500);
  }

  // ─── Zoom ─────────────────────────────────────────────────
  function zoomIn()  { if (scale < MAX_SCALE)  { scale = Math.min(MAX_SCALE, +(scale+SCALE_STEP).toFixed(1)); renderPage(pageNum); updateZoom(); } }
  function zoomOut() { if (scale > MIN_SCALE)  { scale = Math.max(MIN_SCALE, +(scale-SCALE_STEP).toFixed(1)); renderPage(pageNum); updateZoom(); } }
  function updateZoom() { if (zoomValEl) zoomValEl.textContent = Math.round(scale * 100) + '%'; }

  // ─── UI update ────────────────────────────────────────────
  function updateUI() {
    if (pageNumEl) pageNumEl.textContent = bn(pageNum);
    if (totalPgEl) totalPgEl.textContent = bn(totalPages);
    updateZoom();
    if (progressEl && totalPages > 0) progressEl.style.width = (pageNum / totalPages * 100) + '%';

    const btnPrev = document.getElementById('ep-btn-prev');
    const btnNext = document.getElementById('ep-btn-next');
    if (btnPrev) btnPrev.style.opacity = pageNum <= 1           ? '0.3' : '1';
    if (btnNext) btnNext.style.opacity = pageNum >= totalPages  ? '0.3' : '1';

    document.querySelectorAll('.cat-btn').forEach(btn => {
      const p = parseInt(btn.dataset.page);
      btn.classList.toggle('active', p === pageNum);
      btn.setAttribute('aria-selected', p === pageNum ? 'true' : 'false');
    });
  }

  // ─── Next issue countdown (coming soon screen) ────────────
  function updateNextIssueCD(meta) {
    if (!meta?.publishedAt) return;
    const expAt = new Date(meta.publishedAt).getTime() + EXPIRE_DAYS * 86400000;
    const nextIssue = expAt + 86400000;
    const diff = nextIssue - Date.now();
    if (diff < 0) return;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000)  / 60000);
    const el = id => document.getElementById(id);
    if (el('ni-days'))  el('ni-days').textContent  = pad(d);
    if (el('ni-hours')) el('ni-hours').textContent = pad(h);
    if (el('ni-mins'))  el('ni-mins').textContent  = pad(m);
  }

  // ─── Bengali number + pad helper ─────────────────────────
  function bn(n) {
    return String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  // ─── Events ───────────────────────────────────────────────
  // Left zone = prev, right zone = next
  const leftZone  = document.getElementById('ep-left-zone');
  const rightZone = document.getElementById('ep-right-zone');
  if (leftZone)  leftZone.addEventListener('click',  prevPage);
  if (rightZone) rightZone.addEventListener('click', nextPage);

  // Right-click on viewer = next page
  const canvasArea = document.getElementById('epaper-canvas-area');
  if (canvasArea) {
    canvasArea.addEventListener('contextmenu', e => { e.preventDefault(); if (pdfDoc) nextPage(); });
    canvasArea.addEventListener('click', e => {
      if (!pdfDoc) return;
      if (e.target === canvas || e.target === canvasArea) {
        const rect = canvasArea.getBoundingClientRect();
        if (e.clientX - rect.left < rect.width / 2) prevPage();
        else nextPage();
      }
    });
  }

  // Toolbar buttons
  const btnPrev    = document.getElementById('ep-btn-prev');
  const btnNext    = document.getElementById('ep-btn-next');
  const btnZoomIn  = document.getElementById('ep-btn-zoom-in');
  const btnZoomOut = document.getElementById('ep-btn-zoom-out');
  const btnFS      = document.getElementById('ep-btn-fullscreen');
  const btnHelp    = document.getElementById('ep-btn-help');

  if (btnPrev)    btnPrev.addEventListener('click',    prevPage);
  if (btnNext)    btnNext.addEventListener('click',    nextPage);
  if (btnZoomIn)  btnZoomIn.addEventListener('click',  zoomIn);
  if (btnZoomOut) btnZoomOut.addEventListener('click', zoomOut);

  if (btnFS) btnFS.addEventListener('click', function() {
    const wrap = document.getElementById('epaper-viewer-wrap');
    if (!wrap) return;
    if (!document.fullscreenElement) {
      wrap.requestFullscreen().catch(() => {});
      btnFS.textContent = '✕'; wrap.classList.add('epaper-fullscreen');
    } else {
      document.exitFullscreen();
      btnFS.textContent = '⛶'; wrap.classList.remove('epaper-fullscreen');
    }
  });

  if (btnHelp) btnHelp.addEventListener('click', () => shortcutEl?.classList.toggle('show'));

  // Keyboard
  document.addEventListener('keydown', e => {
    if (!pdfDoc) return;
    if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); prevPage(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); nextPage(); }
    if (e.key === 'f' || e.key === 'F') btnFS?.click();
    if (e.key === '+' || e.key === '=') zoomIn();
    if (e.key === '-') zoomOut();
  });

  // Mouse wheel zoom (Ctrl+scroll)
  document.getElementById('epaper-viewer-wrap')?.addEventListener('wheel', e => {
    if (e.ctrlKey) { e.preventDefault(); e.deltaY < 0 ? zoomIn() : zoomOut(); }
  }, { passive: false });

  // Category buttons
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.cat-btn').forEach(b => {
        b.classList.remove('active'); b.setAttribute('aria-selected', 'false');
      });
      this.classList.add('active'); this.setAttribute('aria-selected', 'true');
      goToPage(parseInt(this.dataset.page) || 1);
      document.getElementById('epaper-viewer-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Storage change (admin uploaded new PDF → auto-reload)
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) { pdfDoc = null; pageNum = 1; loadEPaper(); }
  });

  // Poll for expire every 30s
  setInterval(() => {
    if (!pdfDoc) { loadEPaper(); return; }
    const meta = getMeta();
    if (meta && isExpiredMeta(meta)) {
      pdfDoc = null; showState('coming-soon'); updateNextIssueCD(meta);
    }
  }, 30000);

  // ─── Init ────────────────────────────────────────────────
  function init() {
    setTimeout(loadEPaper, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.bipbooksEpaper = { loadEPaper, prevPage, nextPage, goToPage };
})();
