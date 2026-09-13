/**
 * Offline Sync Queue Service for Mifinanzas.com
 *
 * Ensures 100% offline-first functionality:
 * - When disconnected, all financial transactions, products, stock edits,
 *   and debt records are saved locally and queued.
 * - When internet connection is restored, the queue automatically syncs
 *   with Firebase Firestore in the background seamlessly.
 */

import { storageService } from './storageService';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

export interface PendingSyncAction {
  id: string;
  type: 
    | 'set_record' 
    | 'delete_record' 
    | 'set_product' 
    | 'delete_product' 
    | 'update_stock' 
    | 'set_debt' 
    | 'delete_debt'
    | 'update_debt_status';
  collectionPath: string; // e.g. 'records', 'inventory', 'debts'
  docId: string;
  payload?: any;
  timestamp: number;
  userId: string;
}

const QUEUE_STORAGE_KEY = 'mifinanzas_offline_queue';

class SyncQueueService {
  private queue: PendingSyncAction[] = [];
  private isProcessing = false;

  constructor() {
    this.loadQueue();
  }

  private loadQueue() {
    this.queue = storageService.getSync<PendingSyncAction[]>(QUEUE_STORAGE_KEY, []);
  }

  private saveQueue() {
    storageService.set(QUEUE_STORAGE_KEY, this.queue);
  }

  /**
   * Enqueues an action to be executed when back online.
   */
  enqueue(action: Omit<PendingSyncAction, 'id' | 'timestamp'>): void {
    const item: PendingSyncAction = {
      ...action,
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now()
    };

    // Remove any redundant earlier operations on the same doc if this is a delete or overwrite
    if (item.type === 'delete_record' || item.type === 'delete_product' || item.type === 'delete_debt') {
      this.queue = this.queue.filter(
        q => !(q.docId === item.docId && q.userId === item.userId)
      );
    }

    this.queue.push(item);
    this.saveQueue();
    console.log(`[OfflineQueue] Enqueued ${item.type} for doc ${item.docId}. Queue size: ${this.queue.length}`);
  }

  /**
   * Returns current pending queue length
   */
  getPendingCount(userId?: string): number {
    if (!userId) return this.queue.length;
    return this.queue.filter(q => q.userId === userId).length;
  }

  /**
   * Flushes all pending actions to Firebase Firestore
   */
  async flush(userId: string): Promise<{ success: number; failed: number }> {
    if (this.isProcessing) return { success: 0, failed: 0 };
    this.loadQueue();

    const userActions = this.queue.filter(q => q.userId === userId);
    if (userActions.length === 0) return { success: 0, failed: 0 };

    this.isProcessing = true;
    let successCount = 0;
    let failedCount = 0;
    const remainingActions: PendingSyncAction[] = [];

    console.log(`[OfflineQueue] Flushing ${userActions.length} pending operations for user ${userId}...`);

    for (const action of userActions) {
      try {
        const docRef = doc(db, 'users', userId, action.collectionPath, action.docId);

        switch (action.type) {
          case 'set_record':
          case 'set_product':
          case 'set_debt':
            await setDoc(docRef, action.payload, { merge: true });
            break;

          case 'delete_record':
          case 'delete_product':
          case 'delete_debt':
            await deleteDoc(docRef);
            break;

          case 'update_stock':
            await updateDoc(docRef, {
              stock: action.payload.stock,
              status: action.payload.stock > 0 ? 'disponible' : 'no_disponible'
            });
            break;

          case 'update_debt_status':
            await updateDoc(docRef, {
              status: action.payload.status,
              paidAt: action.payload.paidAt || null
            });
            break;
        }

        successCount++;
      } catch (err) {
        console.warn(`[OfflineQueue] Failed to execute ${action.type} for ${action.docId}:`, err);
        failedCount++;
        remainingActions.push(action);
      }
    }

    // Keep actions that belonged to other users + actions that failed
    const otherUsersActions = this.queue.filter(q => q.userId !== userId);
    this.queue = [...otherUsersActions, ...remainingActions];
    this.saveQueue();
    this.isProcessing = false;

    console.log(`[OfflineQueue] Flush complete. Synced: ${successCount}, Remaining failed: ${failedCount}`);
    return { success: successCount, failed: failedCount };
  }
}

export const syncQueueService = new SyncQueueService();
