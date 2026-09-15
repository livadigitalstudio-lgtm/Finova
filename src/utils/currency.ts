import { ExchangeRates, ProductCurrency } from '../types';

export type CurrencyCode = 'USD' | 'EUR';
export type { ProductCurrency };

export function getCurrencySymbol(curr?: ProductCurrency | CurrencyCode | string): string {
  if (curr === 'EUR') return '€';
  if (curr === 'VES') return 'Bs. ';
  return '$';
}

export function getCurrencyLabel(curr?: ProductCurrency | CurrencyCode | string): string {
  if (curr === 'EUR') return 'EUR (€)';
  if (curr === 'VES') return 'BCV (Bs.)';
  return 'USD ($)';
}

export interface FormattedMoney {
  primary: string;         // e.g. "$120.00" or "€103.17"
  primaryWithCode: string; // e.g. "$120.00 USD" or "€103.17 EUR"
  bolivares: string;       // e.g. "Bs. 67,594.80"
  secondary: string;       // e.g. "€103.17 EUR" (if USD) or "$120.00 USD" (if EUR)
  primarySymbol: string;   // "$" or "€"
  amountInActive: number;
  amountInBs: number;
  activeCurrency: CurrencyCode;
}

export interface FormattedRecordDisplay {
  originalText: string;          // e.g. "+€50.00" or "-$100.00"
  originalSymbol: string;        // "€" or "$"
  originalCurrency: CurrencyCode;// "EUR" or "USD"
  originalAmount: number;        // 50
  sign: string;                  // "+" or "-"
  formattedOriginal: string;     // "€50.00" or "$100.00"
  bolivares: string;             // "Bs. 48,403.50"
  bolivaresAmount: number;       // 48403.50
  normalizedAmount: number;      // Amount converted to targetCurrency
  normalizedText: string;        // e.g. "+$58.14" if targetCurrency is USD
  normalizedSymbol: string;      // "$" or "€"
  isDifferentFromTarget: boolean;// true if originalCurrency !== targetCurrency
  equilibriumNotice?: string;    // "Equiv: $58.14 USD" when converted via Bs.
}

const nf = (val: number, minDec = 2, maxDec = 2) => {
  return Math.abs(val).toLocaleString('es-VE', { 
    minimumFractionDigits: minDec, 
    maximumFractionDigits: maxDec 
  });
};

/**
 * Formats an amount that is already denominated in `currency` ('USD' or 'EUR').
 * Computes exact Bolívares using the corresponding BCV rate, and the secondary foreign currency.
 */
export function formatMoney(
  amountInCurrency: number, 
  currency: CurrencyCode = 'USD', 
  rates: ExchangeRates
): FormattedMoney {
  const bcvUsd = rates?.bcvUsd && rates.bcvUsd > 0 ? rates.bcvUsd : 832.49;
  const bcvEur = rates?.bcvEur && rates.bcvEur > 0 ? rates.bcvEur : 968.07;
  
  const isNeg = amountInCurrency < 0;
  const sign = isNeg ? '-' : '';
  const absAmount = Math.abs(amountInCurrency);

  if (currency === 'EUR') {
    // Amount is in Euros (€)
    const amountBs = absAmount * bcvEur;
    const amountUsd = bcvUsd > 0 ? (amountBs / bcvUsd) : absAmount * 1.16;

    return {
      primary: `${sign}€${nf(absAmount)}`,
      primaryWithCode: `${sign}€${nf(absAmount)} EUR`,
      bolivares: `${sign}Bs. ${nf(amountBs)}`,
      secondary: `${sign}$${nf(amountUsd)} USD`,
      primarySymbol: '€',
      amountInActive: amountInCurrency,
      amountInBs: isNeg ? -amountBs : amountBs,
      activeCurrency: 'EUR'
    };
  }

  // Amount is in Dollars ($)
  const amountBs = absAmount * bcvUsd;
  const amountEur = bcvEur > 0 ? (amountBs / bcvEur) : absAmount * 0.86;

  return {
    primary: `${sign}$${nf(absAmount)}`,
    primaryWithCode: `${sign}$${nf(absAmount)} USD`,
    bolivares: `${sign}Bs. ${nf(amountBs)}`,
    secondary: `${sign}€${nf(amountEur)} EUR`,
    primarySymbol: '$',
    amountInActive: amountInCurrency,
    amountInBs: isNeg ? -amountBs : amountBs,
    activeCurrency: 'USD'
  };
}

/**
 * Formats an amount known to be in USD into the target viewing currency ('USD' or 'EUR')
 */
export function formatMoneyFromUSD(
  amountInUsd: number, 
  targetCurrency: CurrencyCode = 'USD', 
  rates: ExchangeRates
): FormattedMoney {
  const bcvUsd = rates?.bcvUsd && rates.bcvUsd > 0 ? rates.bcvUsd : 832.49;
  const bcvEur = rates?.bcvEur && rates.bcvEur > 0 ? rates.bcvEur : 968.07;

  if (targetCurrency === 'EUR') {
    const amountBs = amountInUsd * bcvUsd;
    const amountEur = bcvEur > 0 ? (amountBs / bcvEur) : amountInUsd * 0.86;
    return formatMoney(amountEur, 'EUR', rates);
  }

  return formatMoney(amountInUsd, 'USD', rates);
}

/**
 * Determines whether a payment was made/held in foreign cash or foreign currency accounts
 * (e.g. Efectivo USD, Efectivo EUR, Zelle, Binance, USDT, etc.)
 * These do NOT devalue when the Bolívares exchange rate rises.
 */
export function isForeignCashOrDigital(paymentMethod?: string): boolean {
  if (!paymentMethod) return false;
  const lower = paymentMethod.toLowerCase();
  
  // Bolívares banking channels
  const isBs = lower.includes('pago móvil') || 
               lower.includes('pago movil') || 
               lower.includes('punto') || 
               lower.includes('tarjeta de débito') ||
               lower.includes('tarjeta de debito') ||
               lower.includes('biopago') ||
               lower.includes('bs');

  if (isBs) return false;

  return lower.includes('efectivo') || 
         lower.includes('dólar') || 
         lower.includes('dolar') || 
         lower.includes('usd') || 
         lower.includes('euro') || 
         lower.includes('eur') || 
         lower.includes('zelle') || 
         lower.includes('binance') || 
         lower.includes('usdt') || 
         lower.includes('zinli') || 
         lower.includes('wally');
}

/**
 * Calculates the exact Bolívares value of any transaction or debt item.
 * - If paid in cash/foreign currency: the foreign amount is fixed, and its Bolívares
 *   value increases proportionally as the exchange rate goes up (amount * currentRate).
 * - If paid in Bolívares: the Bolívares amount (amountBs) is fixed.
 */
export function getRecordBolivares(
  record: { 
    amount: number; 
    amountBs?: number; 
    currency?: 'USD' | 'EUR'; 
    exchangeRateUsed?: number;
    paymentMethod?: string;
  },
  rates: ExchangeRates
): number {
  const cur: CurrencyCode = record.currency || 'USD';
  const bcvUsd = rates?.bcvUsd && rates.bcvUsd > 0 ? rates.bcvUsd : 832.49;
  const bcvEur = rates?.bcvEur && rates.bcvEur > 0 ? rates.bcvEur : 968.07;
  const currentRate = cur === 'EUR' ? bcvEur : bcvUsd;
  const recAmount = Number(record.amount) || 0;

  // If paid in foreign cash or digital foreign account, foreign currency never devalues:
  // Bolívares value is calculated with current active rate
  if (isForeignCashOrDigital(record.paymentMethod)) {
    return Number((recAmount * currentRate).toFixed(2));
  }

  // If paid in Bolívares (Pago Móvil, Punto de Venta, Transferencia Bs.), Bolívares is fixed:
  if (typeof record.amountBs === 'number' && record.amountBs > 0) {
    return record.amountBs;
  }

  const rateUsed = record.exchangeRateUsed && record.exchangeRateUsed > 0 ? record.exchangeRateUsed : currentRate;
  return Number((recAmount * rateUsed).toFixed(2));
}

/**
 * Normalizes any transaction record or debt amount to the active viewing currency ('USD' or 'EUR')
 * - If paid in foreign cash/currency: maintains its nominal balance fixed in that currency.
 *   If viewed in another foreign currency, converts via live BCV cross-equilibrium.
 * - If paid in Bolívares: the fixed Bolívares balance is devalued at current BCV rate.
 */
export function getRecordAmountInCurrency(
  record: { 
    amount: number; 
    amountBs?: number; 
    currency?: 'USD' | 'EUR'; 
    exchangeRateUsed?: number;
    paymentMethod?: string;
  },
  targetCurrency: CurrencyCode = 'USD',
  rates: ExchangeRates
): number {
  const recCurrency: CurrencyCode = record.currency || 'USD';
  const recAmount = Number(record.amount) || 0;
  if (recAmount === 0) return 0;

  const bcvUsd = rates?.bcvUsd && rates.bcvUsd > 0 ? rates.bcvUsd : 832.49;
  const bcvEur = rates?.bcvEur && rates.bcvEur > 0 ? rates.bcvEur : 968.07;

  const isCash = isForeignCashOrDigital(record.paymentMethod);

  if (isCash) {
    // Foreign cash or digital foreign funds: amount does NOT devalue when the dollar goes up!
    if (recCurrency === targetCurrency) {
      return recAmount;
    }
    // Cross-equilibrium between EUR and USD via BCV
    if (targetCurrency === 'USD') {
      // Record was EUR cash, convert to USD
      return Number(((recAmount * bcvEur) / bcvUsd).toFixed(2));
    } else {
      // Record was USD cash, convert to EUR
      return Number(((recAmount * bcvUsd) / bcvEur).toFixed(2));
    }
  }

  // Payment was received in Bolívares (Pago Móvil, Punto de Venta, etc.)
  // The Bolívares balance is fixed. As BCV rises, its equivalent in USD/EUR devalues.
  const bolivares = (typeof record.amountBs === 'number' && record.amountBs > 0)
    ? record.amountBs
    : recAmount * (recCurrency === 'EUR' ? (record.exchangeRateUsed || bcvEur) : (record.exchangeRateUsed || bcvUsd));

  if (targetCurrency === 'USD') {
    return bcvUsd > 0 ? Number((bolivares / bcvUsd).toFixed(2)) : recAmount;
  } else {
    return bcvEur > 0 ? Number((bolivares / bcvEur).toFixed(2)) : recAmount;
  }
}

/**
 * Formats a transaction record for display in transaction lists.
 * Preserves its native registered currency (EUR or USD), shows true Bolívares,
 * and if viewed in a different active currency, shows the exact BCV equilibrium conversion.
 */
export function formatRecordDisplay(
  record: { 
    type: 'ingreso' | 'egreso'; 
    amount: number; 
    amountBs?: number; 
    currency?: 'USD' | 'EUR'; 
    exchangeRateUsed?: number;
    paymentMethod?: string;
  },
  targetCurrency: CurrencyCode = 'USD',
  rates: ExchangeRates
): FormattedRecordDisplay {
  const origCurrency: CurrencyCode = record.currency || 'USD';
  const origSymbol = origCurrency === 'EUR' ? '€' : '$';
  const targetSymbol = targetCurrency === 'EUR' ? '€' : '$';
  const isIngreso = record.type === 'ingreso';
  const sign = isIngreso ? '+' : '-';

  const origAmount = Number(record.amount) || 0;
  const bolivares = getRecordBolivares(record, rates);
  const normalized = getRecordAmountInCurrency(record, targetCurrency, rates);

  const isDifferent = origCurrency !== targetCurrency;
  let equilibriumNotice: string | undefined = undefined;

  if (isDifferent) {
    equilibriumNotice = `Equiv. ${targetSymbol}${nf(normalized)} ${targetCurrency}`;
  }

  return {
    originalText: `${sign}${origSymbol}${nf(origAmount)}`,
    originalSymbol: origSymbol,
    originalCurrency: origCurrency,
    originalAmount: origAmount,
    sign,
    formattedOriginal: `${origSymbol}${nf(origAmount)}`,
    bolivares: `Bs. ${nf(bolivares)}`,
    bolivaresAmount: bolivares,
    normalizedAmount: normalized,
    normalizedText: `${sign}${targetSymbol}${nf(normalized)}`,
    normalizedSymbol: targetSymbol,
    isDifferentFromTarget: isDifferent,
    equilibriumNotice
  };
}

/**
 * Converts any numeric amount between USD, EUR, and VES (Bolívares) using official BCV rates.
 */
export function convertAmount(
  amount: number,
  from: ProductCurrency | CurrencyCode = 'USD',
  to: ProductCurrency | CurrencyCode = 'USD',
  rates?: ExchangeRates
): number {
  const numericAmount = Number(amount) || 0;
  if (numericAmount === 0 || from === to) return numericAmount;

  const bcvUsd = rates?.bcvUsd && rates.bcvUsd > 0 ? rates.bcvUsd : 832.49;
  const bcvEur = rates?.bcvEur && rates.bcvEur > 0 ? rates.bcvEur : 968.07;

  // Step 1: Convert source currency to Bolívares (VES)
  let amountInBs = numericAmount;
  if (from === 'USD') {
    amountInBs = numericAmount * bcvUsd;
  } else if (from === 'EUR') {
    amountInBs = numericAmount * bcvEur;
  } else {
    // from is 'VES'
    amountInBs = numericAmount;
  }

  // Step 2: Convert Bolívares to target currency
  if (to === 'VES') {
    return Number(amountInBs.toFixed(2));
  } else if (to === 'USD') {
    return bcvUsd > 0 ? Number((amountInBs / bcvUsd).toFixed(2)) : numericAmount;
  } else if (to === 'EUR') {
    return bcvEur > 0 ? Number((amountInBs / bcvEur).toFixed(2)) : numericAmount;
  }

  return numericAmount;
}

export interface ProductProfitMetrics {
  costCur: ProductCurrency;
  priceCur: ProductCurrency;
  costInViewing: number;
  priceInViewing: number;
  costInPriceCur: number;
  unitProfitInPriceCur: number;
  unitProfitInViewing: number;
  profitMarginPct: number;
  costInBs: number;
  priceInBs: number;
  profitInBs: number;
  hasMixedCurrencies: boolean;
}

/**
 * Calculates profit and margin for an inventory item with independent cost and price currencies.
 * Supports any combination:
 * - Cost in USD, Price in EUR
 * - Cost in EUR, Price in USD
 * - Cost in USD, Price in VES (BCV)
 * - Cost in EUR, Price in VES (BCV)
 * - Cost in VES, Price in USD / EUR
 * - Both in USD, both in EUR, both in VES
 */
export function getProductProfitMetrics(
  item: {
    cost: number;
    price: number;
    costCurrency?: ProductCurrency;
    priceCurrency?: ProductCurrency;
    currency?: 'USD' | 'EUR';
  },
  rates: ExchangeRates,
  viewingCurrency: CurrencyCode = 'USD'
): ProductProfitMetrics {
  const costCur: ProductCurrency = item.costCurrency || item.currency || 'USD';
  const priceCur: ProductCurrency = item.priceCurrency || item.currency || 'USD';
  const hasMixedCurrencies = costCur !== priceCur;

  // Cost and Price normalized to viewing currency
  const costInViewing = convertAmount(item.cost, costCur, viewingCurrency, rates);
  const priceInViewing = convertAmount(item.price, priceCur, viewingCurrency, rates);

  // Cost converted to the price's currency to compute unit profit in that currency
  const costInPriceCur = convertAmount(item.cost, costCur, priceCur, rates);
  const unitProfitInPriceCur = Number((item.price - costInPriceCur).toFixed(2));

  // Profit in viewing currency
  const unitProfitInViewing = Number((priceInViewing - costInViewing).toFixed(2));

  // Margin percentage relative to sale price
  const profitMarginPct = item.price > 0 
    ? Number(((unitProfitInPriceCur / item.price) * 100).toFixed(1)) 
    : 0;

  // Exact Bolívares equivalents
  const costInBs = convertAmount(item.cost, costCur, 'VES', rates);
  const priceInBs = convertAmount(item.price, priceCur, 'VES', rates);
  const profitInBs = Number((priceInBs - costInBs).toFixed(2));

  return {
    costCur,
    priceCur,
    costInViewing,
    priceInViewing,
    costInPriceCur,
    unitProfitInPriceCur,
    unitProfitInViewing,
    profitMarginPct,
    costInBs,
    priceInBs,
    profitInBs,
    hasMixedCurrencies
  };
}
