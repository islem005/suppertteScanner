const Storage = (() => {
  const DB_NAME = 'shelf-scanner';
  const STORE_NAME = 'items';
  const dbPromise = (() => {
    if (!('indexedDB' in window)) return null;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  })();

  async function getDb() {
    try { return await dbPromise; } catch { return null; }
  }

  async function getAll() {
    const db = await getDb();
    if (!db) return fallbackGetAll();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(item) {
    const db = await getDb();
    if (!db) return fallbackPut(item);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function remove(id) {
    const db = await getDb();
    if (!db) return fallbackRemove(id);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clear() {
    const db = await getDb();
    if (!db) return fallbackClear();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function fallbackGetAll() {
    try {
      return JSON.parse(localStorage.getItem('scanned_items') || '[]');
    } catch { return []; }
  }

  function fallbackPut(item) {
    const items = fallbackGetAll();
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    localStorage.setItem('scanned_items', JSON.stringify(items));
  }

  function fallbackRemove(id) {
    const items = fallbackGetAll().filter(i => i.id !== id);
    localStorage.setItem('scanned_items', JSON.stringify(items));
  }

  function fallbackClear() {
    localStorage.removeItem('scanned_items');
  }

  let _clientId = null;

  async function getClientId() {
    if (_clientId) return _clientId;
    // Try IndexedDB first
    try {
      const db = await getDb();
      if (db) {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get('client_id');
          req.onsuccess = () => {
            if (req.result && req.result.value) {
              _clientId = req.result.value;
              resolve(_clientId);
            } else {
              _clientId = crypto.randomUUID();
              put({ id: 'client_id', value: _clientId }).then(() => resolve(_clientId)).catch(() => resolve(_clientId));
            }
          };
          req.onerror = () => {
            _clientId = crypto.randomUUID();
            resolve(_clientId);
          };
        });
      }
    } catch {}
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem('scanner_client_id');
      if (stored) { _clientId = stored; return _clientId; }
      _clientId = crypto.randomUUID();
      localStorage.setItem('scanner_client_id', _clientId);
      return _clientId;
    } catch {
      _clientId = crypto.randomUUID();
      return _clientId;
    }
  }

  return { getAll, put, remove, clear, getClientId };
})();
