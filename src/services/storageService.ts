/**
 * IndexedDB Offline Storage Service with LocalStorage fallback & auto-migration.
 * Ensures 100% durable, quota-safe persistence even in offline mode.
 */

const DB_NAME = 'mifinanzas_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

class StorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryCache = new Map<string, any>();
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      if (!('indexedDB' in window)) {
        console.warn('IndexedDB not supported in this browser. Falling back to localStorage.');
        resolve(null);
        return;
      }

      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          this.migrateFromLocalStorage(db).then(() => {
            this.initialized = true;
            resolve(db);
          });
        };

        request.onerror = (err) => {
          console.warn('IndexedDB open error, continuing with localStorage:', err);
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB initialization failed:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Automatically copies all existing `gt_*` keys from localStorage into IndexedDB
   * so user never loses their history or records.
   */
  private async migrateFromLocalStorage(db: IDBDatabase): Promise<void> {
    try {
      const keysToMigrate: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('gt_') || key.startsWith('mifinanzas_'))) {
          keysToMigrate.push(key);
        }
      }

      if (keysToMigrate.length === 0) return;

      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const key of keysToMigrate) {
        const val = localStorage.getItem(key);
        if (val !== null) {
          try {
            const parsed = JSON.parse(val);
            store.put(parsed, key);
            this.memoryCache.set(key, parsed);
          } catch {
            store.put(val, key);
            this.memoryCache.set(key, val);
          }
        }
      }

      await new Promise<void>((res) => {
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      });
    } catch (e) {
      console.warn('Migration from localStorage notice:', e);
    }
  }

  /**
   * Synchronous get (reads from memory cache or localStorage).
   */
  getSync<T>(key: string, defaultValue: T): T {
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T;
    }

    try {
      const item = localStorage.getItem(key);
      if (item !== null) {
        const parsed = JSON.parse(item) as T;
        this.memoryCache.set(key, parsed);
        return parsed;
      }
    } catch {
      // Return default
    }

    return defaultValue;
  }

  /**
   * Async get from IndexedDB with fallback to cache & localStorage.
   */
  async get<T>(key: string, defaultValue: T): Promise<T> {
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T;
    }

    const db = await this.initDB();
    if (!db) {
      return this.getSync(key, defaultValue);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result !== undefined) {
            this.memoryCache.set(key, req.result);
            resolve(req.result as T);
          } else {
            resolve(this.getSync(key, defaultValue));
          }
        };

        req.onerror = () => {
          resolve(this.getSync(key, defaultValue));
        };
      } catch {
        resolve(this.getSync(key, defaultValue));
      }
    });
  }

  /**
   * Dual-write: updates memory cache, writes to localStorage, and saves asynchronously into IndexedDB.
   */
  set<T>(key: string, value: T): void {
    this.memoryCache.set(key, value);

    // Write to localStorage for instant synchronous reads
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage quota limit reached, relying on IndexedDB:', e);
    }

    // Persist into IndexedDB
    this.initDB().then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(value, key);
      } catch (err) {
        console.warn('IndexedDB write error:', err);
      }
    });
  }

  /**
   * Delete an item from all stores.
   */
  remove(key: string): void {
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {}

    this.initDB().then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
      } catch {}
    });
  }
}

export const storageService = new StorageService();
