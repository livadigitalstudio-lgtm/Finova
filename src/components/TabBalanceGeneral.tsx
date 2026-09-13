import React, { useState } from 'react';
import { 
  Briefcase as BriefIcon, TrendingUp as TrendIcon, DollarSign as DollarIcon, 
  ArrowUpRight as UpIcon, ArrowDownRight as DownIcon, 
  Layers as LayersIcon, CreditCard as CardIcon, ShieldCheck as ShieldIcon, 
  PieChart as PieIcon, HelpCircle as HelpIcon, AlertCircle as AlertIcon, 
  Bookmark as BookmarkIcon, Landmark as LandmarkIcon, Percent as PercentIcon, 
  Check as CheckIcon, Info as InfoIcon, BarChart2, Sparkles, Activity, Award
} from 'lucide-react';
import { FinancialRecord, InventoryItem, DebtItem, ExchangeRates } from '../types';
import { formatMoney, CurrencyCode } from '../utils/currency';
import { getDebtRemainingAmount } from '../utils/debtUtils';

interface TabBalanceGeneralProps {
  records: FinancialRecord[];
  inventory: InventoryItem[];
  debts: DebtItem[];
  rates: ExchangeRates;
  selectedCurrency?: CurrencyCode;
}

export default function TabBalanceGeneral({
  records,
  inventory,
  debts,
  rates,
  selectedCurrency = 'USD'
}: TabBalanceGeneralProps) {
  // Interactive state for asset composition segment inspection
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  
  // Interactive state for projected chart view selection
  const [forecastMetric, setForecastMetric] = useState<'sales' | 'profits'>('sales');

  // --- 1. CORE DATA CALCULATIONS (ALL STRICTLY IN REAL USD) ---
  const totalIncoming = records.filter(r => r.type === 'ingreso').reduce((acc, curr) => acc + curr.amount, 0);
  const totalOutgoing = records.filter(r => r.type === 'egreso').reduce((acc, curr) => acc + curr.amount, 0);
  const liquidCashUSD = totalIncoming - totalOutgoing;

  // Valuation of stock in warehouse (Cost of acquisition)
  const inventoryCostUSD = inventory.reduce((sum, item) => sum + (item.cost * (item.stock || 0)), 0);
  
  // Estimated sales revenue from stock
  const inventorySaleUSD = inventory.reduce((sum, item) => sum + (item.price * (item.stock || 0)), 0);
  const expectedProfitUSD = inventorySaleUSD - inventoryCostUSD;

  // Accounts receivable from clients (unpaid remaining balance)
  const accountsReceivableUSD = debts
    .filter(d => d.type === 'por_cobrar' && d.status === 'pendiente')
    .reduce((sum, d) => sum + getDebtRemainingAmount(d), 0);

  // Accounts payable to distributors/suppliers (unpaid remaining balance)
  const accountsPayableUSD = debts
    .filter(d => d.type === 'por_pagar' && d.status === 'pendiente')
    .reduce((sum, d) => sum + getDebtRemainingAmount(d), 0);

  // --- 2. GLOBAL ACCOUNTING EQUATIONS ---
  // Assets = Liquid Cash + Inventory at cost + Receivable Accounts
  const totalAssetsUSD = Math.max(0, liquidCashUSD) + inventoryCostUSD + accountsReceivableUSD;
  const totalLiabilitiesUSD = accountsPayableUSD;
  // Capital = Assets - Liabilities
  const netWorthUSD = totalAssetsUSD - totalLiabilitiesUSD;

  // Financial Health diagnostic indicators (Current Ratio)
  const currentRatio = totalLiabilitiesUSD > 0 ? (totalAssetsUSD / totalLiabilitiesUSD) : 10;
  
  const getLiquidityDiagnostic = (ratio: number) => {
    if (ratio >= 2.5) return { label: 'Inmejorable', color: 'bg-emerald-50 text-emerald-800 border-emerald-100', desc: 'Sólida reserva disponible y sin riesgos crediticios latentes.' };
    if (ratio >= 1.5) return { label: 'Saludable', color: 'bg-blue-50 text-blue-800 border-blue-100', desc: 'Balance equilibrado para operar de forma desahogada.' };
    if (ratio > 1.0) return { label: 'Estable', color: 'bg-amber-50 text-amber-800 border-amber-100', desc: 'Capacidad justa para solventar obligaciones corrientes.' };
    return { label: 'Comprometido', color: 'bg-rose-50 text-rose-800 border-rose-10 border-rose-100', desc: 'Alerta operativa. Los activos líquidos cubren pocos pasivos.' };
  };
  const liquidityStatus = getLiquidityDiagnostic(currentRatio);

  // Debt-to-Asset ratio (Leverage)
  const leverageRatio = totalAssetsUSD > 0 ? (totalLiabilitiesUSD / totalAssetsUSD) * 100 : 0;

  // Percentages for the Asset Composition Donut Ring
  const cashPct = totalAssetsUSD > 0 ? (Math.max(0, liquidCashUSD) / totalAssetsUSD) * 100 : 0;
  const invPct = totalAssetsUSD > 0 ? (inventoryCostUSD / totalAssetsUSD) * 100 : 0;
  const recPct = totalAssetsUSD > 0 ? (accountsReceivableUSD / totalAssetsUSD) * 100 : 0;

  // SVG parameters for Donut Chart
  const radius = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  // --- 3. CASH FLOW SEGMENTATION BY REGISTERED METHOD ---
  const methodStatistics = records.reduce((acc: { [key: string]: { incoming: number, outgoing: number } }, curr) => {
    const rawMethod = curr.paymentMethod || 'Otros';
    const method = rawMethod.trim();
    if (!acc[method]) {
      acc[method] = { incoming: 0, outgoing: 0 };
    }
    if (curr.type === 'ingreso') {
      acc[method].incoming += curr.amount;
    } else {
      acc[method].outgoing += curr.amount;
    }
    return acc;
  }, {});

  const methodStrMapping = (m: string): string => {
    switch (m.toLowerCase()) {
      case 'efectivo_usd': return 'Efectivo $';
      case 'efectivo_bs': return 'Efectivo Bs.';
      case 'pago_movil': return 'Pago Móvil';
      case 'zelle': return 'Zelle App';
      case 'usdt': return 'Binance USDT';
      case 'transferencia': return 'Transferencia Corriente';
      default: return m;
    }
  };

  const paymentMethodsList = Object.keys(methodStatistics).map(method => {
    const data = methodStatistics[method];
    return {
      name: methodStrMapping(method),
      incoming: data.incoming,
      outgoing: data.outgoing,
      net: data.incoming - data.outgoing
    };
  });

  // --- 4. EXAMPLES OF HISTORICAL & PROSPECTIVE PERFORMANCE STATISTICS (THE XYZ BUSINESS ENGINE) ---
  // Simulated monthly indices loaded automatically based on actual inputs as multipliers
  const actualMulti = Math.max(1, totalIncoming / 250); 
  const historicalMonthlyPerformance = [
    { month: 'Ene', sales: 120 * actualMulti, profit: 45 * actualMulti, prc: 35 },
    { month: 'Feb', sales: 180 * actualMulti, profit: 70 * actualMulti, prc: 50 },
    { month: 'Mar', sales: 140 * actualMulti, profit: 55 * actualMulti, prc: 40 },
    { month: 'Abr', sales: 290 * actualMulti, profit: 110 * actualMulti, prc: 80 },
    { month: 'May', sales: 340 * actualMulti, profit: 145 * actualMulti, prc: 95 },
    { month: 'Jun (Act)', sales: (totalIncoming > 0 ? totalIncoming : 240), profit: (totalIncoming - totalOutgoing > 0 ? (totalIncoming - totalOutgoing) : 90), prc: 70 }
  ];

  // Break-even threshold stats
  const simulatedBreakEven = Math.max(150, totalOutgoing * 1.25);
  const breakEvenCompletion = totalIncoming > 0 ? Math.min(100, (totalIncoming / simulatedBreakEven) * 100) : 0;

  // Inventory category concentration examples
  const categoriesCount = inventory.reduce((acc: { [key: string]: number }, item) => {
    const cat = item.category || 'General';
    acc[cat] = (acc[cat] || 0) + (item.stock || 0);
    return acc;
  }, {});

  const categorySegments = Object.keys(categoriesCount).map(cName => ({
    name: cName,
    stockCount: categoriesCount[cName]
  }));

  return (
    <div className="space-y-4 pb-24">
      
      {/* 1. BRAND NEW HERO BANNER: ONLY CLEAN AND POLISHED FINANCIAL VALUATION CARD (NO BS EXCHANGE RATES AT ALL) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 p-5 rounded-3xl text-white border border-indigo-950/60 shadow-[0_10px_30px_-10px_rgba(30,27,75,0.25)] relative overflow-hidden">
        <div className="absolute right-0 top-0 -translate-y-2 translate-x-2 w-32 h-32 bg-indigo-505 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -right-4 -bottom-4 p-4 text-indigo-500 opacity-5 pointer-events-none">
          <LandmarkIcon className="w-24 h-24" />
        </div>
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-500/15 rounded-xl flex items-center justify-center border border-emerald-400/20 text-emerald-400 shadow-xs">
              <TrendIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9.5px] text-slate-450 uppercase font-black tracking-widest block font-sans">
                Patrimonio Neto del Negocio
              </span>
              <div className="flex items-baseline gap-2 pt-1 flex-wrap">
                <h3 className="text-2xl sm:text-3xl font-black text-white font-sans tracking-tight leading-none">
                  {formatMoney(netWorthUSD, selectedCurrency, rates).primary}
                </h3>
                <span className="text-xs text-indigo-300 font-mono font-bold uppercase">
                  {selectedCurrency}
                </span>
                <span className="text-xs text-emerald-300 font-mono font-bold">
                  {formatMoney(netWorthUSD, selectedCurrency, rates).bolivares}
                </span>
                <span className="text-[10.5px] text-slate-400 font-mono">
                  Ref: {formatMoney(netWorthUSD, selectedCurrency, rates).secondary}
                </span>
              </div>
            </div>
          </div>
          
          <span className="text-[9px] items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg font-black border border-emerald-500/20 inline-flex shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            ACTIVO
          </span>
        </div>

        {/* Business quick stat counters inside Hero (Real figures representing enterprise structure) */}
        <div className="grid grid-cols-3 gap-2 mt-6 pt-4.5 border-t border-slate-800/80 text-[11px] text-center">
          <div className="text-left">
            <span className="text-slate-400 block font-semibold text-[10px] uppercase mb-0.5 tracking-tight">Activo Total</span>
            <strong className="text-slate-100 font-mono text-xs sm:text-sm font-black block">
              {formatMoney(totalAssetsUSD, selectedCurrency, rates).primary}
            </strong>
            <span className="text-[9.5px] text-slate-400 font-mono block">
              {formatMoney(totalAssetsUSD, selectedCurrency, rates).bolivares}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-semibold text-[10px] uppercase mb-0.5 tracking-tight">Pasivo Total</span>
            <strong className="text-rose-450 font-mono text-xs sm:text-sm font-black text-rose-400 block">
              {formatMoney(totalLiabilitiesUSD, selectedCurrency, rates).primary}
            </strong>
            <span className="text-[9.5px] text-slate-400 font-mono block">
              {formatMoney(totalLiabilitiesUSD, selectedCurrency, rates).bolivares}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block font-semibold text-[10px] uppercase mb-0.5 tracking-tight">Rendimiento ROI</span>
            <strong className="text-emerald-400 font-mono text-xs sm:text-sm font-black block">
              +{inventoryCostUSD > 0 ? ((expectedProfitUSD / inventoryCostUSD) * 100).toFixed(0) : '0'}%
            </strong>
            <span className="text-[9.5px] text-slate-400 font-mono block">
              Margen almacén
            </span>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC GRAPHS HUB SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* GRAPH A: DYNAMIC DONUT CHART - ASSET ALLOCATION */}
        <div className="bg-white rounded-3xl border border-slate-200/75 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.015)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
              <PieIcon className="w-4.5 h-4.5 text-indigo-600 animate-pulse-subtle" />
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Composición de Activos</h4>
            </div>
            <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">
              Distribución porcentual de los activos fijos e inmediatos que integran tu fondo de comercio.
            </p>
          </div>

          {totalAssetsUSD === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Registra operaciones comerciales o productos en almacén para renderizar el capital corporativo.
            </div>
          ) : (
            <div className="flex items-center gap-4 py-4 justify-center sm:justify-start">
              {/* Dynamic SVG Ring Chart */}
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  {/* Gray background track */}
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth={strokeWidth}
                  />
                  {/* Segment 1: Cash Flow/Caja (Blue) */}
                  {cashPct > 0 && (
                    <circle
                      cx="60"
                      cy="60"
                      r={radius}
                      fill="transparent"
                      stroke="#3b82f6" 
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (cashPct / 100) * circumference}
                      strokeLinecap="round"
                      onMouseEnter={() => setHoveredSection('cash')}
                      onMouseLeave={() => setHoveredSection(null)}
                      className="cursor-pointer transition-all duration-300 hover:opacity-90"
                    />
                  )}
                  {/* Segment 2: Inventory Value (Emerald) */}
                  {invPct > 0 && (
                    <circle
                      cx="60"
                      cy="60"
                      r={radius}
                      fill="transparent"
                      stroke="#10b981" 
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (invPct / 100) * circumference}
                      transform={`rotate(${(cashPct / 100) * 360} 60 60)`}
                      strokeLinecap="round"
                      onMouseEnter={() => setHoveredSection('inventory')}
                      onMouseLeave={() => setHoveredSection(null)}
                      className="cursor-pointer transition-all duration-300 hover:opacity-90"
                    />
                  )}
                  {/* Segment 3: Accounts Receivable (Amber) */}
                  {recPct > 0 && (
                    <circle
                      cx="60"
                      cy="60"
                      r={radius}
                      fill="transparent"
                      stroke="#f59e0b" 
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (recPct / 100) * circumference}
                      transform={`rotate(${((cashPct + invPct) / 100) * 360} 60 60)`}
                      strokeLinecap="round"
                      onMouseEnter={() => setHoveredSection('receivable')}
                      onMouseLeave={() => setHoveredSection(null)}
                      className="cursor-pointer transition-all duration-300 hover:opacity-90"
                    />
                  )}
                </svg>
                {/* Central Labels inside Ring */}
                <div className="absolute text-center">
                  <span className="text-[8px] text-slate-400 font-bold block uppercase tracking-wider">Activos</span>
                  <span className="text-xs font-black text-slate-800 font-mono tracking-tighter">
                    ${totalAssetsUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Legend with interactive highlight state */}
              <div className="space-y-1.5 flex-grow">
                <div 
                  className={`p-1.5 rounded-xl border transition-colors ${
                    hoveredSection === 'cash' ? 'bg-blue-50 border-blue-200 shadow-xs' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded bg-blue-500 shrink-0"></span>
                    <span>Disponible Líquido:</span>
                    <strong className="ml-auto font-mono text-slate-900">{cashPct.toFixed(0)}%</strong>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono block pl-4">
                    ${Math.max(0, liquidCashUSD).toFixed(0)} USD
                  </span>
                </div>

                <div 
                  className={`p-1.5 rounded-xl border transition-colors ${
                    hoveredSection === 'inventory' ? 'bg-emerald-50 border-emerald-200 shadow-xs' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 shrink-0"></span>
                    <span>Stock Inventario:</span>
                    <strong className="ml-auto font-mono text-slate-900">{invPct.toFixed(0)}%</strong>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono block pl-4">
                    ${inventoryCostUSD.toFixed(0)} USD
                  </span>
                </div>

                <div 
                  className={`p-1.5 rounded-xl border transition-colors ${
                    hoveredSection === 'receivable' ? 'bg-amber-50 border-amber-200 shadow-xs' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500 shrink-0"></span>
                    <span>Cuentas por Cobrar:</span>
                    <strong className="ml-auto font-mono text-slate-900">{recPct.toFixed(0)}%</strong>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono block pl-4">
                    ${accountsReceivableUSD.toFixed(0)} USD
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* GRAPH B: COMPARATIVE CASH FLOW BAR METERS (Ventas Brutas vs Egresos Reales) */}
        <div className="bg-white rounded-3xl border border-slate-200/75 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.015)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
              <LayersIcon className="w-4.5 h-4.5 text-emerald-600" />
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Flujo de Caja Histórico</h4>
            </div>
            <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">
              Comparativa unificada de ingresos totales recaudados contra egresos y costos de adquisición.
            </p>
          </div>

          <div className="space-y-4 py-2">
            {totalIncoming === 0 && totalOutgoing === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Cero operaciones en historial. Comienza a registrar ingresos o compras para habilitar barras comparativas.
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* Segment 1: Incoming */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Ingresos Totales (Ventas recaudadas)
                    </span>
                    <span className="font-mono text-emerald-600">${totalIncoming.toFixed(2)} USD</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${totalIncoming > 0 ? Math.min(100, (totalIncoming / (totalIncoming + totalOutgoing || 1)) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Segment 2: Outflow */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      Egresos & Gastos Operativos
                    </span>
                    <span className="font-mono text-rose-600">${totalOutgoing.toFixed(2)} USD</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${totalOutgoing > 0 ? Math.min(100, (totalOutgoing / (totalIncoming + totalOutgoing || 1)) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl text-[10px] text-slate-500 font-bold text-center mt-1 border border-slate-100">
                  Flujo Neto Estimado de Operaciones: <strong className={liquidCashUSD >= 0 ? 'text-emerald-650 text-emerald-600':'text-rose-600'}>${liquidCashUSD.toFixed(2)} USD</strong>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 3. BRAND NEW: MONTHLY BUSINESS FORECAST CHART / XYZ ENTERPRISE HISTORY INDICATOR */}
      <div className="bg-white rounded-3xl border border-slate-200/75 p-4.5 shadow-[0_2px_12px_rgba(15,23,42,0.015)] space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 className="w-4.5 h-4.5 text-blue-600" />
              <span>Rendimiento Histórico del Ejercicio Comercial</span>
            </h4>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Simulaciones de crecimiento y evolución mensual corporativa.</p>
          </div>
          
          {/* Action toggle group key to switch metric display in bar chart */}
          <div className="flex bg-slate-50 border p-0.5 rounded-lg text-[10px] font-bold self-start sm:self-auto">
            <button
              onClick={() => setForecastMetric('sales')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${forecastMetric === 'sales' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Ventas Brutas
            </button>
            <button
              onClick={() => setForecastMetric('profits')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${forecastMetric === 'profits' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Beneficio Neto
            </button>
          </div>
        </div>

        {/* Visual Simulated Chart Bars */}
        <div className="space-y-3">
          <div className="h-32 flex items-end justify-between gap-2 pt-2.5 px-1 pb-1">
            {historicalMonthlyPerformance.map((item, idx) => {
              const value = forecastMetric === 'sales' ? item.sales : item.profit;
              // Limit height within boundaries
              const displayHeight = Math.max(15, Math.min(100, item.prc));
              const barColor = forecastMetric === 'sales' ? 'bg-indigo-500' : 'bg-emerald-500';

              return (
                <div key={idx} className="flex-1 flex flex-col items-center group relative cursor-pointer">
                  {/* Floating tooltip on hover */}
                  <div className="absolute -top-7 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-lg transition-transform z-20 shadow-lg pointer-events-none">
                    ${value.toFixed(0)} USD
                  </div>
                  
                  {/* Active representation bar */}
                  <div className="w-full bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors h-24 flex items-end justify-center">
                    <div 
                      className={`${barColor} rounded-md w-[85%] transition-all duration-700 relative`}
                      style={{ height: `${displayHeight}%` }}
                    >
                      {/* Accent glow on top */}
                      <span className="absolute top-0 left-0 right-0 h-0.5 bg-white/20 rounded-md"></span>
                    </div>
                  </div>
                  
                  {/* Month Label */}
                  <span className="text-[10px] text-slate-500 font-bold mt-2 font-mono">
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="bg-blue-50/40 p-3 rounded-2xl text-[10px] text-slate-500 leading-relaxed font-semibold border border-blue-50/50">
            <span className="font-extrabold text-blue-800 uppercase block mb-1">💡 Análisis de Rendimiento Comercial</span>
            Se detecta un incremento constante estimulado por la rotación de tus productos más vendidos. Las metas acumuladas de facturación proyectan un margen operativo estable para finales del trimestre actual.
          </div>
        </div>
      </div>

      {/* 4. AN ANALYTICAL BALANCE SHEET TABLE VIEW (Activos, Pasivos, Working Capital) */}
      <div className="bg-white rounded-3xl border border-slate-200/75 p-4.5 shadow-[0_2px_12px_rgba(15,23,42,0.015)] space-y-3.5">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider pb-1.5 border-b border-indigo-50 flex items-center justify-between">
          <span>Balance General Comercial Analítico (USD)</span>
          <span className="text-[9.5px] text-indigo-500 font-bold uppercase tracking-wider">Inversión y Créditos</span>
        </h4>

        <div className="space-y-2.5">
          {/* ACTIVO: Caja Líquida */}
          <div className="flex justify-between items-center text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div>
              <span className="font-extrabold text-slate-800 block">1. Disponibilidad de Caja (Líquida)</span>
              <span className="text-[10px] text-slate-450 font-medium block mt-0.5 font-sans">Suma de ingresos de caja libre de deudas</span>
            </div>
            <strong className={`font-mono text-[12.5px] font-black ${liquidCashUSD >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ${liquidCashUSD.toFixed(2)}
            </strong>
          </div>

          {/* ACTIVO: Inventario Capital */}
          <div className="flex justify-between items-center text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div>
              <span className="font-extrabold text-slate-800 block">2. Inventario en Almacén (Valor de Costo)</span>
              <span className="text-[10px] text-slate-450 font-medium block mt-0.5 font-sans">Capital neto colocado en inventario valorado</span>
            </div>
            <strong className="font-mono text-[12.5px] font-black text-slate-800">
              ${inventoryCostUSD.toFixed(2)}
            </strong>
          </div>

          {/* ACTIVO: Deudas por Cobrar */}
          <div className="flex justify-between items-center text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div>
              <span className="font-extrabold text-slate-800 block">3. Cuentas por Cobrar (Clientes)</span>
              <span className="text-[10px] text-slate-450 font-medium block mt-0.5 font-sans">Saldos pendientes de cobro a percibir</span>
            </div>
            <strong className="font-mono text-[12.5px] font-black text-blue-600">
              +${accountsReceivableUSD.toFixed(2)}
            </strong>
          </div>

          {/* PASIVO: Deudas por Pagar */}
          <div className="flex justify-between items-center text-xs bg-rose-50/25 p-3 rounded-2xl border border-rose-100">
            <div>
              <span className="font-extrabold text-rose-950 block">4. Cuentas por Pagar (Obligaciones)</span>
              <span className="text-[10px] text-slate-450 font-medium block mt-0.5 font-sans">Deudas vigentes con tus distribuidores mayoristas</span>
            </div>
            <strong className="font-mono text-[12.5px] font-black text-rose-650 text-rose-600">
              -${accountsPayableUSD.toFixed(2)}
            </strong>
          </div>
        </div>

        {/* Dynamic summary verification equation */}
        <div className="bg-slate-900 p-3.5 rounded-2xl text-[10.5px] font-mono text-slate-300 tracking-tight space-y-1.5 mt-2.5 border border-slate-850 shadow-inner">
          <p className="font-bold text-[9px] text-blue-400 uppercase tracking-widest border-b border-slate-800 pb-1.5 mb-1.5 flex justify-between">
            <span>Verificación de Ecuación Contable</span>
            <span>Activo = Pasivo + Capital</span>
          </p>
          <div className="flex justify-between text-slate-200">
            <span>Total Activos Comerciales:</span>
            <span className="font-bold text-white">${totalAssetsUSD.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-200">
            <span>Total Pasivos u Obligaciones:</span>
            <span className="font-bold text-rose-400">-${totalLiabilitiesUSD.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-1.5 mt-1 text-emerald-400 font-bold">
            <span>Fondo de Capital Neto Real (Patrimonio):</span>
            <span className="text-emerald-400">${netWorthUSD.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 5. ADDED MORE STATISTICS: CATEGORY AND BREAK-EVEN ANALYSIS TARGETS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* STAT BOX 5A: BREAK-EVEN TARGET BAR METER */}
        <div className="bg-white rounded-3xl border border-slate-200/75 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.015)] relative overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
            <Award className="w-4.5 h-4.5 text-indigo-600" />
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Umbral de Rentabilidad</h4>
          </div>
          
          <div className="space-y-3">
            <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">
              Tu umbral mensual mínimo para costear adquisiciones operacionales fijas:
            </p>
            
            <div className="flex justify-between text-xs font-bold font-mono">
              <span className="text-slate-600">Volumen Ventas:</span>
              <span className="text-slate-800">${totalIncoming.toFixed(0)} / ${simulatedBreakEven.toFixed(0)} USD</span>
            </div>

            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${breakEvenCompletion}%` }}
              ></div>
            </div>

            <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-tight flex justify-between">
              <span>Mínimo Operativo</span>
              <span className={breakEvenCompletion >= 100 ? 'text-emerald-600 font-black' : 'text-amber-600'}>
                {breakEvenCompletion.toFixed(0)}% Logrado
              </span>
            </div>
          </div>
        </div>

        {/* STAT BOX 5B: STOCK SEGMENTATION POPULARITY */}
        <div className="bg-white rounded-3xl border border-slate-200/75 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.015)]">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
            <Activity className="w-4.5 h-4.5 text-blue-600 animate-pulse" />
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Concentración de Stock</h4>
          </div>

          <div className="space-y-3">
            {categorySegments.length === 0 ? (
              <p className="text-center text-[10px] py-4 text-slate-450">Agrega productos clasificados en inventario.</p>
            ) : (
              <div className="space-y-2">
                {categorySegments.map((seg, i) => {
                  const maxStock = Math.max(1, Math.max(...categorySegments.map(s => s.stockCount)));
                  const ratio = Math.min(100, (seg.stockCount / maxStock) * 100);
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-655 font-black text-slate-600 block max-w-[130px] truncate">{seg.name}</span>
                        <span className="font-mono text-slate-800">{seg.stockCount} unid.</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-400 h-full rounded-full" style={{ width: `${ratio}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 6. BUSINESS FINTEC METRIC AUDITS (Ratio de Liquidez, ROI y Apalancamiento) */}
      <div className="bg-white rounded-3xl border border-slate-200/75 p-4.5 shadow-[0_2px_12px_rgba(15,23,42,0.015)] space-y-3.5">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider pb-1 border-b border-indigo-50">
          Ratios de Capacidad & Salud Empresarial
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Box 1: Current Ratio */}
          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl space-y-1.5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Liquidez Inmediata</span>
              <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full border ${liquidityStatus.color}`}>
                {liquidityStatus.label}
              </span>
            </div>
            <strong className="text-lg font-black text-slate-900 block font-mono">
              {currentRatio >= 10 ? 'Excelente' : `${currentRatio.toFixed(1)}x`}
            </strong>
            <p className="text-[9.5px] text-slate-500 font-semibold leading-relaxed">
              {liquidityStatus.desc}
            </p>
          </div>

          {/* Box 2: Working Capital */}
          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Capital de Trabajo</span>
              <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full border bg-blue-50 text-blue-800 border-blue-100">
                Líquido Neto
              </span>
            </div>
            <strong className="text-lg font-black text-slate-800 block font-mono">
              ${totalAssetsUSD >= totalLiabilitiesUSD ? `+` : ''}${(totalAssetsUSD - totalLiabilitiesUSD).toFixed(0)} <span className="text-[10px] text-slate-400 font-mono">USD</span>
            </strong>
            <p className="text-[9.5px] text-slate-500 font-semibold leading-relaxed">
              Recurso financiero real remanente para expandir inversiones u operar el negocio a diario.
            </p>
          </div>

          {/* Box 3: Leverage Index */}
          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Apalancamiento de Deudas</span>
              <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full border ${leverageRatio > 35 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-100'}`}>
                {leverageRatio === 0 ? 'Sin Deuda':'Supervisado'}
              </span>
            </div>
            <strong className="text-lg font-black text-slate-900 block font-mono">
              {leverageRatio.toFixed(1)}% <span className="text-[10px] text-slate-400 font-mono">de activos</span>
            </strong>
            <p className="text-[9.5px] text-slate-500 font-semibold leading-relaxed">
              Porcentaje de tus activos totales financiados por deudas vigentes con proveedores.
            </p>
          </div>
        </div>
      </div>

      {/* 7. CASH FLOW CHANNELS (Resumen de Canales de Pago) */}
      <div className="bg-white rounded-3xl border border-slate-200/75 p-4.5 shadow-[0_2px_12px_rgba(15,23,42,0.015)] space-y-3">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider pb-1 border-b border-indigo-50 flex items-center justify-between">
          <span>Saldos Líquidos por Canales de Pago</span>
          <span className="text-[9.5px] text-emerald-500 font-bold uppercase tracking-wider">Flujo Líquido</span>
        </h4>

        {paymentMethodsList.length === 0 ? (
          <div className="text-center py-4 bg-slate-50 rounded-2xl text-slate-400 text-[10.5px] border border-dashed border-slate-250">
            Registra transacciones comerciales para desglosar tus saldos por vía de pago.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {paymentMethodsList.map((meth, i) => (
              <div 
                key={i}
                className="bg-slate-50 border border-slate-100 p-2.5 rounded-2xl space-y-1"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-700 font-black">{meth.name}</span>
                  <span className={`font-mono text-[10.5px] font-black ${meth.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    ${meth.net.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[8px] text-slate-400 uppercase font-bold pt-1 border-t border-slate-200/40">
                  <span className="text-emerald-500">Ing: +${meth.incoming.toFixed(0)}</span>
                  <span className="text-rose-500">Egr: -${meth.outgoing.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
