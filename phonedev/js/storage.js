const Storage = {
    _db: null,
    DB_NAME: 'phonedev',
    DB_VERSION: 1,

    async init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('kv')) {
                    db.createObjectStore('kv');
                }
                if (!db.objectStoreNames.contains('chat_history')) {
                    db.createObjectStore('chat_history', { keyPath: 'id', autoIncrement: true });
                }
            };
            req.onsuccess = (e) => { this._db = e.target.result; resolve(); };
            req.onerror = () => reject(req.error);
        });
    },

    async get(key) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction('kv', 'readonly');
            const req = tx.objectStore('kv').get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async set(key, value) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction('kv', 'readwrite');
            tx.objectStore('kv').put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async delete(key) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction('kv', 'readwrite');
            tx.objectStore('kv').delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async getJSON(key) {
        const val = await this.get(key);
        if (!val) return null;
        try { return JSON.parse(val); } catch { return null; }
    },

    async setJSON(key, obj) {
        await this.set(key, JSON.stringify(obj));
    },
};
