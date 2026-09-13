import { useState, useEffect } from 'react';
import { ExchangeRates } from '../types';
import { INITIAL_RATES } from '../data/defaultData';

const CACHE_KEY = 'gt_rates_system';
const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// Service class to handle fetch and caching
export const ratesService = {
  // Returns cached rates if valid, else returns null
  getCachedRates(): ExchangeRates | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      
      const parsed = JSON.parse(cached) as ExchangeRates;
      
      // Make sure it has required fields and isn't expired
      if (parsed && typeof parsed.bcvUsd === 'number' && typeof parsed.bcvEur === 'number' && parsed.bcvUsd > 0) {
        // Parse last updated, check if within 1 hour
        const lastUpdatedTime = new Date(parsed.lastUpdated).getTime();
        const now = Date.now();
        if (!isNaN(lastUpdatedTime) && now - lastUpdatedTime < CACHE_EXPIRY_MS) {
          return parsed;
        }
      }
      return null;
    } catch (e) {
      console.warn('Failed to read exchange rates cache:', e);
      return null;
    }
  },

  // Save rates to the cache
  saveToCache(rates: ExchangeRates): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
    } catch (e) {
      console.warn('Failed to save exchange rates cache:', e);
    }
  },

  // Fetch from public API and merge with user parameters
  async fetchRates(): Promise<ExchangeRates> {
    try {
      // 1. Primary: Official Banco Central de Venezuela (BCV) & Paralelo APIs via ve.dolarapi.com
      const [usdRes, eurRes, parRes] = await Promise.allSettled([
        fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' }),
        fetch('https://ve.dolarapi.com/v1/euros/oficial', { cache: 'no-store' }),
        fetch('https://ve.dolarapi.com/v1/dolares/paralelo', { cache: 'no-store' })
      ]);

      let bcvUsd: number | null = null;
      let bcvEur: number | null = null;
      let paraleloUsd: number = 0;
      let lastUpdatedStr = new Date().toISOString();

      if (usdRes.status === 'fulfilled' && usdRes.value.ok) {
        const usdData = await usdRes.value.json();
        const val = Number(usdData.promedio || usdData.venta || usdData.compra);
        if (val && !isNaN(val) && val > 0) {
          bcvUsd = parseFloat(val.toFixed(2));
          if (usdData.fechaActualizacion) lastUpdatedStr = usdData.fechaActualizacion;
        }
      }

      if (eurRes.status === 'fulfilled' && eurRes.value.ok) {
        const eurData = await eurRes.value.json();
        const val = Number(eurData.promedio || eurData.venta || eurData.compra);
        if (val && !isNaN(val) && val > 0) {
          bcvEur = parseFloat(val.toFixed(2));
        }
      }

      if (parRes.status === 'fulfilled' && parRes.value.ok) {
        const parData = await parRes.value.json();
        const val = Number(parData.promedio || parData.venta || parData.compra);
        if (val && !isNaN(val) && val > 0) {
          paraleloUsd = parseFloat(val.toFixed(2));
        }
      }

      if (bcvUsd) {
        // If EUR wasn't returned, approximate via official USD * 1.08 ratio
        const finalEur = bcvEur ?? parseFloat((bcvUsd * 1.08).toFixed(2));
        const finalPar = paraleloUsd > 0 ? paraleloUsd : parseFloat((bcvUsd * 1.15).toFixed(2));
        const finalUsdt = parseFloat((finalPar * 1.02).toFixed(2));

        const liveRates: ExchangeRates = {
          bcvUsd,
          bcvEur: finalEur,
          paraleloUsd: finalPar,
          usdtUsd: finalUsdt,
          lastUpdated: lastUpdatedStr,
          source: 'Banco Central de Venezuela (BCV) Oficial',
          verifiedByAdmin: true
        };

        this.saveToCache(liveRates);
        return liveRates;
      }

      // 2. Secondary fallback: Global Exchange Rate API
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (response.ok) {
        const data = await response.json();
        const baseVes = data.rates?.VES;
        if (baseVes && baseVes > 10) {
          const computedRates: ExchangeRates = {
            bcvUsd: parseFloat(baseVes.toFixed(2)),
            bcvEur: parseFloat((baseVes * 1.08).toFixed(2)),
            paraleloUsd: parseFloat((baseVes * 1.15).toFixed(2)),
            usdtUsd: parseFloat((baseVes * 1.18).toFixed(2)),
            lastUpdated: new Date().toISOString(),
            source: 'Open Exchange Feed Oficial BCV',
            verifiedByAdmin: false
          };
          this.saveToCache(computedRates);
          return computedRates;
        }
      }

      // 3. Fallback to cache if valid
      const cached = this.getCachedRates();
      if (cached) return cached;

      const defaultLiveRates: ExchangeRates = {
        ...INITIAL_RATES,
        lastUpdated: new Date().toISOString(),
        source: 'Tasa Referencial de Emergencia'
      };
      this.saveToCache(defaultLiveRates);
      return defaultLiveRates;

    } catch (error) {
      console.warn('Live rates fetch failed, using cached or fallback:', error);
      const cached = this.getCachedRates();
      if (cached) return cached;

      const fallback: ExchangeRates = {
        ...INITIAL_RATES,
        lastUpdated: new Date().toISOString(),
        source: 'Valores base'
      };
      this.saveToCache(fallback);
      return fallback;
    }
  },

  saveManualRates(rates: ExchangeRates): void {
    const updated: ExchangeRates = {
      ...rates,
      lastUpdated: new Date().toISOString(),
      verifiedByAdmin: true
    };
    this.saveToCache(updated);
  }
};

// Hook to automatically load, refresh every hour, and update exchange rates state
export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRates>(() => {
    // Check cache on load
    const cached = ratesService.getCachedRates();
    if (cached) return cached;
    return INITIAL_RATES;
  });

  const [loading, setLoading] = useState<boolean>(false);

  const refreshRates = async () => {
    setLoading(true);
    try {
      const freshRates = await ratesService.fetchRates();
      setRates(freshRates);
    } catch (error) {
      console.error('Rates refresh hook failure:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Immediate initial fetch if cache is empty or expired
    const cached = ratesService.getCachedRates();
    if (!cached) {
      refreshRates();
    }

    // Set interval to update every 1 hour (3600000 ms)
    const intervalId = setInterval(() => {
      console.log('useExchangeRates: Loading hourly cached rate update');
      refreshRates();
    }, 60 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  return {
    rates,
    loading,
    refreshRates,
    setRates
  };
}
