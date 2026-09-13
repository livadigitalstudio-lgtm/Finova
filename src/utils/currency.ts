import { ExchangeRates } from '../types';

export type CurrencyCode = 'USD' | 'EUR';

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

export function formatMoney(amountInUsd: number, currency: CurrencyCode = 'USD', rates: ExchangeRates): FormattedMoney {
  const bcvUsd = rates?.bcvUsd && rates.bcvUsd > 0 ? rates.bcvUsd : 563.29;
  const bcvEur = rates?.bcvEur && rates.bcvEur > 0 ? rates.bcvEur : 654.87;
  
  // Bolívares conversion is always based on the exact official BCV rate
  const amountBs = amountInUsd * bcvUsd;
  // 1 USD = bcvUsd Bs.
  // 1 EUR = bcvEur Bs.
  // amountEur = (amountInUsd * bcvUsd) / bcvEur
  const amountEur = bcvEur > 0 ? (amountBs / bcvEur) : amountInUsd * 0.86;

  const nf = (val: number, minDec = 2, maxDec = 2) => {
    return Math.abs(val).toLocaleString('es-VE', { 
      minimumFractionDigits: minDec, 
      maximumFractionDigits: maxDec 
    });
  };

  const isNeg = amountInUsd < 0;
  const sign = isNeg ? '-' : '';

  if (currency === 'EUR') {
    return {
      primary: `${sign}€${nf(amountEur)}`,
      primaryWithCode: `${sign}€${nf(amountEur)} EUR`,
      bolivares: `${sign}Bs. ${nf(amountBs)}`,
      secondary: `${sign}$${nf(amountInUsd)} USD`,
      primarySymbol: '€',
      amountInActive: amountEur,
      amountInBs: amountBs,
      activeCurrency: 'EUR'
    };
  }

  return {
    primary: `${sign}$${nf(amountInUsd)}`,
    primaryWithCode: `${sign}$${nf(amountInUsd)} USD`,
    bolivares: `${sign}Bs. ${nf(amountBs)}`,
    secondary: `${sign}€${nf(amountEur)} EUR`,
    primarySymbol: '$',
    amountInActive: amountInUsd,
    amountInBs: amountBs,
    activeCurrency: 'USD'
  };
}

/**
 * Normalizes any transaction record or amount to the active viewing currency ('USD' or 'EUR')
 * Takes into account whether the record was in USD or EUR and the exchange rate used.
 */
export function getRecordAmountInCurrency(
  record: { amount: number; amountBs?: number; currency?: 'USD' | 'EUR'; exchangeRateUsed?: number },
  targetCurrency: CurrencyCode = 'USD',
  rates: ExchangeRates
): number {
  const recCurrency: CurrencyCode = record.currency || 'USD';
  const recAmount = Number(record.amount) || 0;

  if (recCurrency === targetCurrency) {
    return recAmount;
  }

  const bcvUsd = rates?.bcvUsd && rates.bcvUsd > 0 ? rates.bcvUsd : 832.49;
  const bcvEur = rates?.bcvEur && rates.bcvEur > 0 ? rates.bcvEur : 968.07;

  // If amountBs exists and is positive, convert directly to target currency
  if (record.amountBs && record.amountBs > 0) {
    if (targetCurrency === 'USD') {
      return record.amountBs / bcvUsd;
    } else {
      return record.amountBs / bcvEur;
    }
  }

  // Cross rate fallback
  if (recCurrency === 'EUR' && targetCurrency === 'USD') {
    const usedEurRate = record.exchangeRateUsed && record.exchangeRateUsed > 0 ? record.exchangeRateUsed : bcvEur;
    return (recAmount * usedEurRate) / bcvUsd;
  } else if (recCurrency === 'USD' && targetCurrency === 'EUR') {
    const usedUsdRate = record.exchangeRateUsed && record.exchangeRateUsed > 0 ? record.exchangeRateUsed : bcvUsd;
    return (recAmount * usedUsdRate) / bcvEur;
  }

  return recAmount;
}

