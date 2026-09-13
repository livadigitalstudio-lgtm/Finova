export type PlanType = 'basic' | 'premium';
export type UserStatus = 'active' | 'blocked';

export interface UserSession {
  email: string;
  name: string;
  companyName?: string;
  plan: PlanType;
  status: UserStatus;
  role?: 'admin' | 'user';
  uid?: string;
  lastActive?: string;
  createdAt?: string;
  securityHash?: string;
  authProvider?: string;
  isBanned?: boolean;
  banReason?: string;
  bannedAt?: string;
  loginCount?: number;
  lastLogin?: string;
  passwordHash?: string;
}

export type ProFeatureId = 'clientes' | 'deudas' | 'estadisticas' | 'balance_general' | 'cotizaciones' | 'inventario';

export interface ProFeaturesConfig {
  clientes: boolean;        // true = requires PRO, false = free
  deudas: boolean;          // true = requires PRO, false = free
  estadisticas: boolean;    // true = requires PRO, false = free
  balance_general: boolean; // true = requires PRO, false = free
  cotizaciones: boolean;    // true = requires PRO, false = free
  inventario: boolean;      // true = requires PRO, false = free
}

export const DEFAULT_PRO_FEATURES_CONFIG: ProFeaturesConfig = {
  clientes: false,
  deudas: false,
  estadisticas: false,
  balance_general: false,
  cotizaciones: false,
  inventario: false
};

export type TransactionType = 'ingreso' | 'egreso';

export interface SoldItemDetail {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface PurchasedItemDetail {
  productId: string;
  name: string;
  quantity: number;
  unitCost: number;
}

export interface FinancialRecord {
  id: string;
  type: TransactionType;
  amount: number; // Stored in the entered currency (USD or EUR)
  amountBs: number; // in BS computed at transaction exchange rate
  exchangeRateUsed: number;
  description: string;
  category: string;
  date: string; // YYYY-MM-DD
  paymentMethod: string;
  currency?: 'USD' | 'EUR'; // If missing, defaults to 'USD'
  soldItems?: SoldItemDetail[]; // Detail of inventory items sold
  purchasedItems?: PurchasedItemDetail[]; // Detail of inventory items purchased/restocked
  supplier?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  stock: number;
  cost: number; // Cost price in USD
  price: number; // Sale price in USD
  status: 'disponible' | 'no_disponible';
  iconColor?: string;
  category?: string;
}

export interface DebtPayment {
  id: string;
  date: string; // YYYY-MM-DD or ISO
  amount: number; // Stored in debt currency (USD or EUR)
  amountBs?: number; // In Bolívares
  exchangeRateUsed?: number;
  currency?: 'USD' | 'EUR';
  paymentMethod: string; // e.g. 'Efectivo USD', 'Pago Móvil', 'Transferencia', 'Zelle', 'Punto de Venta'
  reference?: string; // Nro. de comprobante o referencia bancaria
  notes?: string;
  createdRecordId?: string; // Optional linked cash-flow record ID
}

export interface DebtItem {
  id: string;
  type: 'por_cobrar' | 'por_pagar';
  debtorName: string;
  amount: number; // Original entered total debt
  paidAmount?: number; // Total amount paid via abonos
  remainingAmount?: number; // Remaining balance to be paid
  payments?: DebtPayment[]; // Detailed installment history
  amountBs?: number; // In Bolívares computed with the exchange rate
  exchangeRateUsed?: number;
  currency?: 'USD' | 'EUR';
  dueDate: string; // YYYY-MM-DD
  status: 'pendiente' | 'pagado';
  description: string;
  dateCreated: string;
  paidAt?: string;
  clientPhone?: string; // WhatsApp / Phone for sending invoices
  clientEmail?: string;
  clientIdNumber?: string; // C.I. or RIF (e.g. V-12345678)
}

export interface ExchangeRates {
  bcvUsd: number;      // BCV USD to BS
  paraleloUsd: number; // Dolar Today / Paralelo USD to BS
  bcvEur: number;      // BCV EUR to BS
  usdtUsd?: number;    // USDT to BS
  lastUpdated: string;
  source?: string;
  verifiedByAdmin?: boolean;
}

export interface MonetizationPlan {
  id: string;
  name: string;
  price: number;
  discount: number; // percentage
  frequency: string; // "mes", "año", etc.
  popular?: boolean;
  features: string[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userEmail: string;
  action: string;
  details: string;
  ipAddress?: string;
  category?: 'finanzas' | 'inventario' | 'deudas' | 'sistema' | 'tasas';
}
