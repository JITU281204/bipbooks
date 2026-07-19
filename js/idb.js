/* ============================================================
   BipBooks — IndexedDB Helper
   PDF data stored in IndexedDB (supports 100MB+ files)
   Metadata stored in localStorage
   ============================================================ */

const BipBooksDB = (function() {
  const DB_NAME    = 'bipbooks_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'pdfs';

  let _db = null;

  // ─── Open / Init DB ────────────────────────────────────
  function openDB() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = function(e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      req.onsuccess = function(e) {
        _db = e.target.result;
        resolve(_db);
      };

      req.onerror = function(e) {
        reject(e.target.error);
      };
    });
  }

  // ─── Save PDF (ArrayBuffer) ─────────────────────────────
  async function savePDF(id, arrayBuffer) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id: String(id), data: arrayBuffer });
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ─── Get PDF (ArrayBuffer) ──────────────────────────────
  async function getPDF(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(String(id));
      req.onsuccess = (e) => resolve(e.target.result ? e.target.result.data : null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ─── Delete PDF ─────────────────────────────────────────
  async function deletePDF(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(String(id));
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ─── Clear all PDFs ─────────────────────────────────────
  async function clearAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  return { savePDF, getPDF, deletePDF, clearAll };
})();
