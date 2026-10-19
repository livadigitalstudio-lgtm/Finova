import Dexie, { type Table } from 'dexie';
import { FinancialRecord, InventoryItem, DebtItem, AuditLog } from '../types';

export interface LocalAppMeta {
  key: string;
  value: any;
  updatedAt: number;
}

export interface LocalClient {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  location?: string;
  notes?: string;
  balanceUsd?: number;
}

export interface LocalSupplier {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  category?: string;
  notes?: string;
}

export interface LocalEmployee {
  id: string;
  userId: string;
  name: string;
  role?: string;
  phone?: string;
  salary?: number;
  salaryCurrency?: string;
}

export interface PendingSyncItem {
  id: string;
  userId: string;
  collection: 'records' | 'inventory' | 'debts' | 'auditLogs' | 'clients' | 'suppliers' | 'employees';
  action: 'upsert' | 'delete';
  docId: string;
  payload?: any;
  timestamp: number;
}

export class FinovaLocalDatabase extends Dexie {
  records!: Table<FinancialRecord & { userId: string }, string>;
  inventory!: Table<InventoryItem & { userId: string }, string>;
  debts!: Table<DebtItem & { userId: string }, string>;
  auditLogs!: Table<AuditLog & { userId: string }, string>;
  clients!: Table<LocalClient, string>;
  suppliers!: Table<LocalSupplier, string>;
  employees!: Table<LocalEmployee, string>;
  pendingSync!: Table<PendingSyncItem, string>;
  appMeta!: Table<LocalAppMeta, string>;

  constructor() {
    super('finova_local_db');
    this.version(1).stores({
      records: 'id, userId, type, date, category',
      inventory: 'id, userId, name, status, category',
      debts: 'id, userId, type, debtorName, status, dueDate',
      auditLogs: 'id, userId, timestamp, category',
      clients: 'id, userId, name',
      suppliers: 'id, userId, name',
      employees: 'id, userId, name',
      pendingSync: 'id, userId, collection, docId, timestamp',
      appMeta: 'key'
    });
  }

  // --- Helper Methods ---

  async isUserMigrated(userId: string): Promise<boolean> {
    const meta = await this.appMeta.get(`is_migrated_to_local_${userId}`);
    return Boolean(meta?.value);
  }

  async setUserMigrated(userId: string, val: boolean = true): Promise<void> {
    await this.appMeta.put({
      key: `is_migrated_to_local_${userId}`,
      value: val,
      updatedAt: Date.now()
    });
  }

  async getUserRecords(userId: string): Promise<FinancialRecord[]> {
    const list = await this.records.where('userId').equals(userId).toArray();
    return list.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
  }

  async putUserRecords(userId: string, records: FinancialRecord[]): Promise<void> {
    await this.transaction('rw', this.records, async () => {
      // Clear old and write current
      await this.records.where('userId').equals(userId).delete();
      const withUser = records.map(r => ({ ...r, userId }));
      await this.records.bulkPut(withUser);
    });
  }

  async getUserInventory(userId: string): Promise<InventoryItem[]> {
    return await this.inventory.where('userId').equals(userId).toArray();
  }

  async putUserInventory(userId: string, items: InventoryItem[]): Promise<void> {
    await this.transaction('rw', this.inventory, async () => {
      await this.inventory.where('userId').equals(userId).delete();
      const withUser = items.map(i => ({ ...i, userId }));
      await this.inventory.bulkPut(withUser);
    });
  }

  async getUserDebts(userId: string): Promise<DebtItem[]> {
    const list = await this.debts.where('userId').equals(userId).toArray();
    return list.sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''));
  }

  async putUserDebts(userId: string, debts: DebtItem[]): Promise<void> {
    await this.transaction('rw', this.debts, async () => {
      await this.debts.where('userId').equals(userId).delete();
      const withUser = debts.map(d => ({ ...d, userId }));
      await this.debts.bulkPut(withUser);
    });
  }

  async getUserAuditLogs(userId: string): Promise<AuditLog[]> {
    const list = await this.auditLogs.where('userId').equals(userId).toArray();
    return list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }

  async putUserAuditLogs(userId: string, logs: AuditLog[]): Promise<void> {
    await this.transaction('rw', this.auditLogs, async () => {
      await this.auditLogs.where('userId').equals(userId).delete();
      const withUser = logs.map(l => ({ ...l, userId }));
      await this.auditLogs.bulkPut(withUser);
    });
  }

  /**
   * Complete, secure destruction of user data from IndexedDB on logout
   * To protect financial privacy across shared devices.
   */
  async purgeUserData(userId: string): Promise<void> {
    await this.transaction(
      'rw',
      [
        this.records,
        this.inventory,
        this.debts,
        this.auditLogs,
        this.clients,
        this.suppliers,
        this.employees,
        this.pendingSync,
        this.appMeta
      ],
      async () => {
        await this.records.where('userId').equals(userId).delete();
        await this.inventory.where('userId').equals(userId).delete();
        await this.debts.where('userId').equals(userId).delete();
        await this.auditLogs.where('userId').equals(userId).delete();
        await this.clients.where('userId').equals(userId).delete();
        await this.suppliers.where('userId').equals(userId).delete();
        await this.employees.where('userId').equals(userId).delete();
        await this.pendingSync.where('userId').equals(userId).delete();
        await this.appMeta.delete(`is_migrated_to_local_${userId}`);
      }
    );
  }
}

export const localDb = new FinovaLocalDatabase();
