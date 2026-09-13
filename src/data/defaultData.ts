import { InventoryItem, ExchangeRates, MonetizationPlan } from '../types';

export const INITIAL_RATES: ExchangeRates = {
  bcvUsd: 832.49,
  paraleloUsd: 940.65,
  bcvEur: 968.07,
  usdtUsd: 950.00,
  lastUpdated: new Date().toISOString()
};

export const INITIAL_PRODUCTS: InventoryItem[] = [];

export const INITIAL_PLANS: MonetizationPlan[] = [
  {
    id: 'plan-basic',
    name: 'Plan Básico',
    price: 4.99,
    discount: 0,
    frequency: 'mes',
    features: [
      'Registro ilimitado de balances',
      'Inventario básico (hasta 20 productos)',
      'Soporte por correo electrónico',
      'Control de cuentas por cobrar',
      'Contiene publicidad de Google AdSense'
    ]
  },
  {
    id: 'plan-premium',
    name: 'Plan Premium',
    price: 9.99,
    discount: 15,
    frequency: 'mes',
    features: [
      'Visualización de Estadísticas Avanzadas',
      'Clientes, Proveedores y Empleados ilimitados',
      'Soporte Prioritario 24/7',
      'Impresión de Tickets de Venta',
      'Reportes y métricas avanzadas',
      'Sin anuncios (Publicidad AdSense 100% removida)'
    ]
  }
];

export interface SuggestedItem {
  id: string;
  label: string;
  iconName: string;
  badge?: string;
  isPremium: boolean;
}

export const SUGGESTED_ITEMS: SuggestedItem[] = [
  { id: 'cotizaciones', label: 'Cotizaciones', iconName: 'FileText', badge: 'Pro', isPremium: false },
  { id: 'deudas', label: 'Deudas', iconName: 'CreditCard', isPremium: false },
  { id: 'clientes', label: 'Clientes', iconName: 'Users', isPremium: false },
  { id: 'estadisticas', label: 'Estadísticas', iconName: 'BarChart2', isPremium: false },
  { id: 'proveedores', label: 'Proveedores', iconName: 'Truck', isPremium: false },
  { id: 'empleados', label: 'Empleados', iconName: 'Briefcase', isPremium: false }
];
