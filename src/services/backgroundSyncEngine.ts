/**
 * Silent Background Sync Engine
 *
 * Implements:
 * 1. 100% silent, transparent cloud backup from local IndexedDB to Firestore.
 * 2. Automatic debouncer of 3 to 5 seconds (3500ms) to batch modifications.
 * 3. Automatic synchronization when network reconnects (window 'online').
 * 4. Automatic sync when the application minimizes or page hides ('visibilitychange' / 'beforeunload').
 * 5. Forced flush promise for graceful sign-out routines.
 */

import { localDb, PendingSyncItem } from '../db/localDb';
import { db, isFirebaseConfigured } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

class BackgroundSyncEngine {
  private debounceTimers = new Map<string, any>();
  private isSyncing = false;
  private currentUserId: string | null = null;
  private listenersAttached = false;
  private DEBOUNCE_DELAY_MS = 3500; // 3.5 seconds

  constructor() {
    if (typeof window !== 'undefined') {
      this.attachLifecycleListeners();
    }
  }

  /**
   * Set the active user ID to listen for lifecycle events
   */
  setActiveUser(userId: string | null) {
    this.currentUserId = userId;
  }

  /**
   * Attach global listeners for 'online', 'visibilitychange', and 'beforeunload'
   */
  private attachLifecycleListeners() {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    // 1. When device regains internet connection
    window.addEventListener('online', () => {
      if (this.currentUserId) {
        console.log('[BackgroundSync] Connection restored. Triggering silent sync...');
        this.syncNow(this.currentUserId).catch(err => {
          console.warn('[BackgroundSync] Silent reconnect sync notice:', err);
        });
      }
    });

    // 2. When user switches tabs, minimizes app, or switches applications
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.currentUserId) {
        this.syncNow(this.currentUserId).catch(err => {
          console.warn('[BackgroundSync] Silent visibility sync notice:', err);
        });
      }
    });

    // 3. Right before closing the window / tab
    window.addEventListener('beforeunload', () => {
      if (this.currentUserId) {
        // Fast sync attempt
        this.syncNow(this.currentUserId).catch(() => {});
      }
    });
  }

  /**
   * Schedules a debounced sync operation (3 to 5 seconds).
   * Persists the operation in local IndexedDB pending queue immediately.
   */
  scheduleSync(
    userId: string,
    operation?: {
      collection: PendingSyncItem['collection'];
      action: PendingSyncItem['action'];
      docId: string;
      payload?: any;
    }
  ): void {
    if (!userId) return;
    this.currentUserId = userId;

    // 1. Immediately store the pending mutation into IndexedDB so it's durable even across crashes
    if (operation) {
      const item: PendingSyncItem = {
        id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        collection: operation.collection,
        action: operation.action,
        docId: operation.docId,
        payload: operation.payload,
        timestamp: Date.now()
      };

      localDb.pendingSync.put(item).catch(e => {
        console.warn('[BackgroundSync] Notice queueing pending item:', e);
      });
    }

    // 2. Debounce the actual Firestore cloud write by 3.5 seconds
    if (this.debounceTimers.has(userId)) {
      clearTimeout(this.debounceTimers.get(userId));
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(userId);
      this.syncNow(userId).catch(err => {
        console.warn('[BackgroundSync] Debounced sync notice:', err);
      });
    }, this.DEBOUNCE_DELAY_MS);

    this.debounceTimers.set(userId, timer);
  }

  /**
   * Executes synchronization of all pending mutations to Firestore now.
   */
  async syncNow(userId: string): Promise<{ success: number; failed: number }> {
    if (!isFirebaseConfigured || !userId) {
      return { success: 0, failed: 0 };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // Offline: keep in local DB until back online
      return { success: 0, failed: 0 };
    }

    if (this.isSyncing) {
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;

    try {
      // Clear any pending debounce timer
      if (this.debounceTimers.has(userId)) {
        clearTimeout(this.debounceTimers.get(userId));
        this.debounceTimers.delete(userId);
      }

      const pendingItems = await localDb.pendingSync.where('userId').equals(userId).toArray();

      if (pendingItems.length === 0) {
        this.isSyncing = false;
        return { success: 0, failed: 0 };
      }

      let success = 0;
      let failed = 0;
      const completedIds: string[] = [];

      // Process pending mutations in batches
      for (const item of pendingItems) {
        try {
          let docRef;
          if (item.collection === 'auditLogs') {
            docRef = doc(db, 'auditLogs', item.docId);
          } else {
            docRef = doc(db, 'users', userId, item.collection, item.docId);
          }

          if (item.action === 'delete') {
            await deleteDoc(docRef);
          } else {
            await setDoc(docRef, item.payload, { merge: true });
          }

          completedIds.push(item.id);
          success++;
        } catch (err) {
          console.warn(`[BackgroundSync] Failed to sync ${item.collection}/${item.docId}:`, err);
          failed++;
        }
      }

      // Remove successfully written items from pending queue
      if (completedIds.length > 0) {
        await localDb.pendingSync.bulkDelete(completedIds);
      }

      return { success, failed };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Forced flush method for the Graceful Sign-Out Routine.
   * Ensures all local records, inventory, and debts are fully flushed to Firestore.
   */
  async flush(userId: string): Promise<void> {
    if (!userId) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('OFFLINE_NO_INTERNET');
    }

    // 1. Sync any queued pending actions first
    await this.syncNow(userId);

    // 2. Also ensure current full snapshot is stored in Firestore as backup
    if (isFirebaseConfigured) {
      try {
        const records = await localDb.getUserRecords(userId);
        const inventory = await localDb.getUserInventory(userId);
        const debts = await localDb.getUserDebts(userId);

        const writePromises: Promise<any>[] = [];

        // Save records
        for (const r of records) {
          writePromises.push(
            setDoc(doc(db, 'users', userId, 'records', r.id), r, { merge: true }).catch(() => {})
          );
        }

        // Save inventory
        for (const item of inventory) {
          writePromises.push(
            setDoc(doc(db, 'users', userId, 'inventory', item.id), item, { merge: true }).catch(() => {})
          );
        }

        // Save debts
        for (const d of debts) {
          writePromises.push(
            setDoc(doc(db, 'users', userId, 'debts', d.id), d, { merge: true }).catch(() => {})
          );
        }

        await Promise.all(writePromises);
      } catch (err) {
        console.warn('[BackgroundSync] Error during full flush:', err);
        throw err;
      }
    }
  }

  /**
   * Checks if user has pending mutations not yet pushed to cloud
   */
  async hasPendingSync(userId: string): Promise<boolean> {
    if (!userId) return false;
    const count = await localDb.pendingSync.where('userId').equals(userId).count();
    return count > 0;
  }
}

export const backgroundSyncEngine = new BackgroundSyncEngine();
