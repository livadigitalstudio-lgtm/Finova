/**
 * Transparent Local Migration & Cloud Disaster Recovery Service
 *
 * Implements:
 * 1. Automatic migration from Firestore to local-first IndexedDB (Dexie) on login
 *    if `is_migrated_to_local` is missing.
 * 2. Automatic cloud recovery on new devices when local database is detected empty.
 * 3. 100% silent and background execution without blocking UI or showing manual dialogs.
 */

import { localDb } from '../db/localDb';
import { db, isFirebaseConfigured } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { FinancialRecord, InventoryItem, DebtItem, AuditLog } from '../types';
import { storageService } from './storageService';

export interface MigrationResult {
  migratedFromCloud: boolean;
  records: FinancialRecord[];
  inventory: InventoryItem[];
  debts: DebtItem[];
  auditLogs: AuditLog[];
}

class LocalMigrationService {
  private inProgressMigrations = new Map<string, Promise<MigrationResult>>();

  /**
   * Checks whether the user's data is already in local IndexedDB.
   * If not migrated or empty, silently pulls historical data from Firestore
   * and populates IndexedDB.
   */
  async ensureUserDataReady(userId: string, userEmail: string): Promise<MigrationResult> {
    if (!userId) {
      return {
        migratedFromCloud: false,
        records: [],
        inventory: [],
        debts: [],
        auditLogs: []
      };
    }

    // Prevent concurrent duplicate migrations for the same user
    if (this.inProgressMigrations.has(userId)) {
      return this.inProgressMigrations.get(userId)!;
    }

    const migrationPromise = this.executeEnsureReady(userId, userEmail);
    this.inProgressMigrations.set(userId, migrationPromise);

    try {
      return await migrationPromise;
    } finally {
      this.inProgressMigrations.delete(userId);
    }
  }

  private async executeEnsureReady(userId: string, userEmail: string): Promise<MigrationResult> {
    const isMigrated = await localDb.isUserMigrated(userId);

    // Read current local data
    const localRecords = await localDb.getUserRecords(userId);
    const localInventory = await localDb.getUserInventory(userId);
    const localDebts = await localDb.getUserDebts(userId);
    const localAuditLogs = await localDb.getUserAuditLogs(userId);

    const hasLocalData = localRecords.length > 0 || localInventory.length > 0 || localDebts.length > 0;

    // Condition: Already migrated AND has data in local DB -> Ready immediately!
    if (isMigrated && hasLocalData) {
      return {
        migratedFromCloud: false,
        records: localRecords,
        inventory: localInventory,
        debts: localDebts,
        auditLogs: localAuditLogs
      };
    }

    // If NOT migrated, OR local DB is empty (e.g. new phone or fresh browser device):
    // Perform silent migration/recovery from Firestore cloud backup
    if (!isFirebaseConfigured) {
      // If Firebase isn't configured, check localStorage legacy caches
      const fallbackRecs = storageService.getSync<FinancialRecord[]>(`gt_records_${userEmail}`, []);
      const fallbackInv = storageService.getSync<InventoryItem[]>(`gt_inventory_${userEmail}`, []);
      const fallbackDebts = storageService.getSync<DebtItem[]>(`gt_debts_${userEmail}`, []);

      if (fallbackRecs.length > 0) await localDb.putUserRecords(userId, fallbackRecs);
      if (fallbackInv.length > 0) await localDb.putUserInventory(userId, fallbackInv);
      if (fallbackDebts.length > 0) await localDb.putUserDebts(userId, fallbackDebts);
      await localDb.setUserMigrated(userId, true);

      return {
        migratedFromCloud: false,
        records: fallbackRecs,
        inventory: fallbackInv,
        debts: fallbackDebts,
        auditLogs: localAuditLogs
      };
    }

    try {
      console.log(`[LocalMigrationService] Checking Firestore cloud backup for user ${userId}...`);

      // 1. Fetch historical financial records from Firestore
      const recordsCol = collection(db, 'users', userId, 'records');
      const recordsSnap = await getDocs(recordsCol);
      const cloudRecords: FinancialRecord[] = [];
      recordsSnap.forEach(docSnap => {
        cloudRecords.push(docSnap.data() as FinancialRecord);
      });
      cloudRecords.sort((a, b) => (b.id || '').localeCompare(a.id || ''));

      // 2. Fetch inventory items
      const inventoryCol = collection(db, 'users', userId, 'inventory');
      const invSnap = await getDocs(inventoryCol);
      const cloudInventory: InventoryItem[] = [];
      invSnap.forEach(docSnap => {
        cloudInventory.push(docSnap.data() as InventoryItem);
      });

      // 3. Fetch debts items
      const debtsCol = collection(db, 'users', userId, 'debts');
      const debtsSnap = await getDocs(debtsCol);
      const cloudDebts: DebtItem[] = [];
      debtsSnap.forEach(docSnap => {
        cloudDebts.push(docSnap.data() as DebtItem);
      });
      cloudDebts.sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''));

      // 4. Fetch audit logs (by email)
      let cloudAuditLogs: AuditLog[] = [];
      try {
        const auditCol = collection(db, 'auditLogs');
        const auditQuery = query(auditCol, where('userEmail', '==', userEmail.toLowerCase()));
        const auditSnap = await getDocs(auditQuery);
        auditSnap.forEach(docSnap => {
          cloudAuditLogs.push(docSnap.data() as AuditLog);
        });
        cloudAuditLogs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      } catch (auditErr) {
        console.warn('[LocalMigrationService] Notice reading audit logs:', auditErr);
      }

      // Merge with any existing local data (preferring cloud if local is empty, or union by ID)
      const mergedRecords = mergeById(localRecords, cloudRecords);
      const mergedInventory = mergeById(localInventory, cloudInventory);
      const mergedDebts = mergeById(localDebts, cloudDebts);
      const mergedAuditLogs = mergeById(localAuditLogs, cloudAuditLogs);

      // Write into local IndexedDB
      if (mergedRecords.length > 0) await localDb.putUserRecords(userId, mergedRecords);
      if (mergedInventory.length > 0) await localDb.putUserInventory(userId, mergedInventory);
      if (mergedDebts.length > 0) await localDb.putUserDebts(userId, mergedDebts);
      if (mergedAuditLogs.length > 0) await localDb.putUserAuditLogs(userId, mergedAuditLogs);

      // Also mirror to storageService caches for instant synchronous rendering
      storageService.set(`gt_records_${userEmail}`, mergedRecords);
      storageService.set(`gt_inventory_${userEmail}`, mergedInventory);
      storageService.set(`gt_debts_${userEmail}`, mergedDebts);

      // Set the local migration flag so future startups don't need cloud reads
      await localDb.setUserMigrated(userId, true);
      localStorage.setItem(`is_migrated_to_local_${userId}`, 'true');

      console.log(`[LocalMigrationService] Migration complete for ${userId}: ${mergedRecords.length} records, ${mergedInventory.length} products, ${mergedDebts.length} debts.`);

      return {
        migratedFromCloud: true,
        records: mergedRecords,
        inventory: mergedInventory,
        debts: mergedDebts,
        auditLogs: mergedAuditLogs
      };
    } catch (error) {
      console.warn('[LocalMigrationService] Silent cloud migration notice (operating with local state):', error);

      // Even on failure/offline, mark migrated so the app doesn't hang
      await localDb.setUserMigrated(userId, true);

      return {
        migratedFromCloud: false,
        records: localRecords,
        inventory: localInventory,
        debts: localDebts,
        auditLogs: localAuditLogs
      };
    }
  }
}

function mergeById<T extends { id: string }>(local: T[], cloud: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of cloud) {
    if (item?.id) map.set(item.id, item);
  }
  for (const item of local) {
    if (item?.id) map.set(item.id, item);
  }
  return Array.from(map.values());
}

export const localMigrationService = new LocalMigrationService();
