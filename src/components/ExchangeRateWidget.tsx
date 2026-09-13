import React, { useState, useEffect } from 'react';
import { RefreshCw, Coins, ArrowRightLeft, Landmark, TrendingUp } from 'lucide-react';
import { ExchangeRates } from '../types';
import { ratesService } from '../services/ratesService';

interface ExchangeRateWidgetProps {
  rates: ExchangeRates;
  onRefresh: (newRates: ExchangeRates) => void;
}

export default function ExchangeRateWidget({ rates, onRefresh }: ExchangeRateWidgetProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [calcAmount, setCalcAmount] = useState<string>('10');
  const [calcFrom, setCalcFrom] = useState<'USD' | 'BS'>('USD');
  const [calcRateType, setCalcRateType] = useState<'bcv' | 'euro' | 'usdt'>('bcv');
  const [calcResult, setCalcResult] = useState<string>('');

  // Auto-calculate when amount, direction, or rate selection matches
  useEffect(() => {
    const rawVal = parseFloat(calcAmount);
    if (isNaN(rawVal) || rawVal <= 0) {
      setCalcResult('0.00');
      return;
    }

    let rate = rates.bcvUsd;
    if (calcRateType === 'euro') {
      rate = rates.bcvEur;
    } else if (calcRateType === 'usdt') {
      rate = rates.usdtUsd || 735.37;
    }

    if (calcFrom === 'USD') {
      const bsResult = rawVal * rate;
      setCalcResult(bsResult.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' BS');
    } else {
      const usdResult = rawVal / rate;
      setCalcResult('$' + usdResult.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD');
    }
  }, [calcAmount, calcFrom, calcRateType, rates]);

  // Attempt live exchange rates fetch using services/ratesService
  const handleRefreshRates = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await ratesService.fetchRates();
      onRefresh(fresh);
    } catch (e) {
      console.warn('Refresh rates failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleDirection = () => {
    setCalcFrom(prev => prev === 'USD' ? 'BS' : 'USD');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/75 p-4.5 shadow-[0_4px_16px_rgba(15,23,42,0.015)] relative overflow-hidden">
      {/* Background soft accent */}
      <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 text-slate-100 opacity-20 pointer-events-none">
        <Landmark className="w-24 h-24" />
      </div>

      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <Coins className="w-4.5 h-4.5 text-blue-600" />
          <div>
            <h4 className="text-xs font-bold text-slate-900 tracking-tight leading-none">Tasas de Cambio Oficiales</h4>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1 block">Tasa Real de Referencia</span>
          </div>
        </div>

        <button
          onClick={handleRefreshRates}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-blue-600 border border-slate-250/60 text-[10px] px-3 py-1.5 rounded-xl font-bold transition-all disabled:opacity-60 active:scale-95 cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Consultando...' : 'Actualizar'}
        </button>
      </div>

      {/* Grid of Rates: ORDER SHOULD BE BCV, EURO, USDT */}
      <div className="grid grid-cols-3 gap-2.5 mb-4 relative z-10">
        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/50 text-center">
          <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-1">BCV</p>
          <p className="text-xs font-black text-slate-800 font-mono">
            Bs. {rates.bcvUsd.toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/50 text-center">
          <p className="text-[8px] text-slate-450 uppercase font-black tracking-wider mb-1">EURO</p>
          <p className="text-xs font-black text-indigo-650 font-mono">
            Bs. {rates.bcvEur.toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/50 text-center animate-pulse-subtle">
          <p className="text-[8px] text-slate-450 uppercase font-black tracking-wider mb-1">USDT</p>
          <p className="text-xs font-black text-emerald-600 font-mono">
            Bs. {(rates.usdtUsd ?? 735.37).toFixed(2)}
          </p>
        </div>
      </div>

      {/* INTEGRATED INSTANT CURRENCY CONVERTER */}
      <div className="bg-slate-50/60 rounded-2xl p-3 border border-slate-200/60 relative z-10">
        <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
          Conversor Rápido de Divisas
        </p>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-100">
            {/* Input amount */}
            <input
              type="number"
              value={calcAmount}
              onChange={(e) => setCalcAmount(e.target.value)}
              placeholder="10.00"
              className="w-full bg-transparent font-mono font-black text-xs text-slate-800 focus:outline-none"
            />
            
            {/* Currency badge source */}
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-mono font-bold border border-slate-200/50">
              {calcFrom}
            </span>

            {/* Switch conversion direction */}
            <button
              onClick={toggleDirection}
              type="button"
              className="p-1 hover:bg-slate-105 active:scale-95 rounded-lg text-slate-500 transition-all cursor-pointer"
              title="Cambiar dirección"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-1 text-[10px]">
            {/* Select Tasa */}
            <div className="flex bg-white/80 p-0.5 rounded-xl border border-slate-200 font-bold">
              <button
                type="button"
                onClick={() => setCalcRateType('bcv')}
                className={`px-2 py-0.5 rounded-lg transition-all text-[9.5px] cursor-pointer ${calcRateType === 'bcv' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-400'}`}
              >
                BCV
              </button>
              <button
                type="button"
                onClick={() => setCalcRateType('euro')}
                className={`px-2 py-0.5 rounded-lg transition-all text-[9.5px] cursor-pointer ${calcRateType === 'euro' ? 'bg-indigo-900 text-white shadow-xs' : 'text-slate-400'}`}
              >
                EURO
              </button>
              <button
                type="button"
                onClick={() => setCalcRateType('usdt')}
                className={`px-2 py-0.5 rounded-lg transition-all text-[9.5px] cursor-pointer ${calcRateType === 'usdt' ? 'bg-emerald-900 text-white shadow-xs' : 'text-slate-400'}`}
              >
                USDT
              </button>
            </div>

            {/* Calculations display */}
            <div className="text-right">
              <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Monto Convertido</span>
              <span className="text-xs font-black text-slate-900 font-mono">{calcResult}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
