import React, { useMemo, useState } from 'react';
import { 
  BarChart2, TrendingUp, TrendingDown, DollarSign, Calendar, 
  Layers, CreditCard, ChevronRight, PieChart, Activity, Briefcase, Sparkles
} from 'lucide-react';
import { FinancialRecord, InventoryItem, ExchangeRates } from '../types';
import { getLocalDateString, parseDateSafe, MONTH_SHORT_ES } from '../utils/dateUtils';

interface SuggestedStatsProps {
  records: FinancialRecord[];
  inventory: InventoryItem[];
  rates: ExchangeRates;
  onClose?: () => void;
}

export default function SuggestedStats({ records, inventory, rates, onClose }: SuggestedStatsProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; income: number; expense: number } | null>(null);

  // 1. Dynamic aggregations from actual live database
  const statsSummary = useMemo(() => {
    const incomesList = records.filter(r => r.type === 'ingreso');
    const expensesList = records.filter(r => r.type === 'egreso');

    const totalIncomeUSD = incomesList.reduce((acc, r) => acc + r.amount, 0);
    const totalExpenseUSD = expensesList.reduce((acc, r) => acc + r.amount, 0);
    const cashNetUSD = totalIncomeUSD - totalExpenseUSD;

    const totalIncomeBs = incomesList.reduce((acc, r) => acc + (r.amountBs || r.amount * rates.bcvUsd), 0);
    const totalExpenseBs = expensesList.reduce((acc, r) => acc + (r.amountBs || r.amount * rates.bcvUsd), 0);

    const averageSaleUSD = incomesList.length > 0 ? (totalIncomeUSD / incomesList.length) : 0;
    
    // Payment channels frequency counter
    const methodAggrs: { [method: string]: number } = {};
    records.forEach(r => {
      const method = r.paymentMethod || 'Otros';
      methodAggrs[method] = (methodAggrs[method] || 0) + r.amount;
    });

    const parsedChannels = Object.keys(methodAggrs).map(chName => ({
      name: chName,
      amountUsd: methodAggrs[chName]
    })).sort((a, b) => b.amountUsd - a.amountUsd);

    return {
      totalIncomeUSD,
      totalExpenseUSD,
      cashNetUSD,
      totalIncomeBs,
      totalExpenseBs,
      averageSaleUSD,
      salesCount: incomesList.length,
      expensesCount: expensesList.length,
      channels: parsedChannels
    };
  }, [records, rates]);

  // 2. Timeline Aggregator (Last 7 Days) for professional trend graph
  const chartData = useMemo(() => {
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(getLocalDateString(d));
    }

    return dates.map(dt => {
      const dayRecs = (records || []).filter(r => parseDateSafe(r.date).formatted === dt);
      const income = dayRecs.filter(r => r.type === 'ingreso').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const expense = dayRecs.filter(r => r.type === 'egreso').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      
      const { month, day } = parseDateSafe(dt);
      const label = `${day} ${MONTH_SHORT_ES[month - 1] || ''}`;

      return {
        date: dt,
        label,
        income,
        expense
      };
    });
  }, [records]);

  // Helper variables for SVG Coordinate calculations
  const chartLayout = useMemo(() => {
    const width = 500;
    const height = 180;
    const paddingLeft = 40;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 30;

    const rawMax = Math.max(15, ...chartData.map(d => Math.max(d.income, d.expense)));
    const maxVal = rawMax * 1.15;

    const getX = (index: number) => {
      const scaleWidth = width - paddingLeft - paddingRight;
      return paddingLeft + (index / 6) * scaleWidth;
    };

    const getY = (val: number) => {
      const scaleHeight = height - paddingTop - paddingBottom;
      return height - paddingBottom - (val / maxVal) * scaleHeight;
    };

    // Construct line strings
    const incomePoints = chartData.map((d, index) => `${getX(index)},${getY(d.income)}`).join(' L ');
    const expensePoints = chartData.map((d, index) => `${getX(index)},${getY(d.expense)}`).join(' L ');

    const incomeAreaPath = chartData.length > 0 
      ? `M ${getX(0)},${height - paddingBottom} L ${incomePoints} L ${getX(6)},${height - paddingBottom} Z` 
      : '';
    const expenseAreaPath = chartData.length > 0 
      ? `M ${getX(0)},${height - paddingBottom} L ${expensePoints} L ${getX(6)},${height - paddingBottom} Z` 
      : '';

    return {
      width,
      height,
      paddingLeft,
      paddingBottom,
      maxVal,
      getX,
      getY,
      incomePoints,
      expensePoints,
      incomeAreaPath,
      expenseAreaPath
    };
  }, [chartData]);

  // Translate channel labels to beautifully styled tokens
  const getChannelLabel = (name: string) => {
    switch (name.toLowerCase()) {
      case 'efectivo usd': return 'Dólares Efectivo';
      case 'efectivo bs': return 'Bolívares Efectivo';
      case 'pago móvil': return 'Pago Móvil';
      case 'zelle': return 'Zelle Transfer';
      case 'usdt': return 'Binance Pay USDT';
      case 'transferencia': return 'Transferencia';
      default: return name;
    }
  };

  const getChannelColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'efectivo usd': return 'bg-emerald-500 text-emerald-500';
      case 'efectivo bs': return 'bg-amber-500 text-amber-500';
      case 'pago móvil': return 'bg-indigo-500 text-indigo-500';
      case 'zelle': return 'bg-purple-500 text-purple-500';
      case 'usdt': return 'bg-teal-500 text-teal-500';
      case 'transferencia': return 'bg-blue-500 text-blue-500';
      default: return 'bg-slate-400 text-slate-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Total Ingresado</span>
            <span className="p-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-bold">Ventas</span>
          </div>
          <div className="mt-2">
            <strong className="text-xl font-sans font-black text-slate-800 font-mono block leading-none">
              ${statsSummary.totalIncomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>{statsSummary.salesCount} ventas cobradas</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Total Egresado</span>
            <span className="p-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-bold">Gastos</span>
          </div>
          <div className="mt-2">
            <strong className="text-xl font-sans font-black text-rose-600 font-mono block leading-none">
              -${statsSummary.totalExpenseUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            <span>{statsSummary.expensesCount} compras/pagos</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between text-white shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-black tracking-wider text-indigo-300">Liquidez Neta</span>
            <span className="p-1 bg-white/10 text-emerald-300 rounded-lg text-[9px] font-bold">Balance</span>
          </div>
          <div className="mt-2">
            <strong className="text-xl font-sans font-black text-emerald-400 font-mono block leading-none">
              ${statsSummary.cashNetUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/10 text-[10px] text-blue-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Caja Consolidada $ / €</span>
          </div>
        </div>
      </div>

      {/* 2. Advanced Professional Graphic Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Chart Column 1: Timeline Line/Area Chart */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 p-4.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4.5 h-4.5 text-indigo-650" />
              <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider">Historial de Flujo de Caja (7D)</h4>
            </div>
            <div className="flex items-center gap-2.5 text-[9px] font-bold">
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Ingresos
              </span>
              <span className="flex items-center gap-1 text-rose-500">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Egresos
              </span>
            </div>
          </div>

          {records.length === 0 ? (
            <div className="text-center py-12 text-slate-405 font-semibold text-slate-400 text-xs">
              Registra transacciones en tu balance para dibujar el gráfico comercial de los últimos 7 días.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Dynamic Coordinate Chart render */}
              <div className="relative">
                <svg className="w-full h-auto overflow-visible" viewBox={`0 0 ${chartLayout.width} ${chartLayout.height}`}>
                  {/* Definition for elegant translucent area gradients */}
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guide lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                    const hRange = chartLayout.height - 20 - chartLayout.paddingBottom;
                    const y = 20 + p * hRange;
                    const gridVal = chartLayout.maxVal * (1 - p);
                    return (
                      <g key={i} className="opacity-40">
                        <line 
                          x1={chartLayout.paddingLeft} 
                          y1={y} 
                          x2={chartLayout.width - 15} 
                          y2={y} 
                          stroke="#e2e8f0" 
                          strokeDasharray="4,4" 
                          strokeWidth="1"
                        />
                        <text 
                          x={chartLayout.paddingLeft - 8} 
                          y={y + 3} 
                          textAnchor="end" 
                          className="font-mono text-[8px] font-bold fill-slate-400"
                        >
                          ${Math.round(gridVal)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Income Area & Line Path */}
                  <path d={chartLayout.incomeAreaPath} fill="url(#incomeGrad)" />
                  <path d={`M ${chartLayout.incomePoints}`} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Expense Area & Line Path */}
                  <path d={chartLayout.expenseAreaPath} fill="url(#expenseGrad)" />
                  <path d={`M ${chartLayout.expensePoints}`} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Interactive node indicator overlay for coordinates hover */}
                  {chartData.map((d, idx) => {
                    const x = chartLayout.getX(idx);
                    const yInc = chartLayout.getY(d.income);
                    const yExp = chartLayout.getY(d.expense);

                    return (
                      <g key={idx} className="cursor-pointer group">
                        {/* Hidden tall interaction rect */}
                        <rect
                          x={x - 12}
                          y={10}
                          width={24}
                          height={chartLayout.height - chartLayout.paddingBottom - 10}
                          fill="transparent"
                          onMouseEnter={() => setHoveredPoint(d)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />

                        {/* Income node dot */}
                        <circle cx={x} cy={yInc} r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" className="transition-all group-hover:r-5 shadow-sm" />
                        
                        {/* Expense node dot */}
                        <circle cx={x} cy={yExp} r="3.5" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.5" className="transition-all group-hover:r-5 shadow-sm" />

                        {/* Hover vertical alignment bar guide */}
                        {hoveredPoint?.date === d.date && (
                          <line x1={x} y1={15} x2={x} y2={chartLayout.height - chartLayout.paddingBottom} stroke="#6366f1" strokeWidth="1.5" strokeDasharray="2,2" className="pointer-events-none" />
                        )}
                      </g>
                    );
                  })}

                  {/* X Axis Labels */}
                  {chartData.map((d, idx) => {
                    const x = chartLayout.getX(idx);
                    const y = chartLayout.height - 12;
                    return (
                      <text 
                        key={idx} 
                        x={x} 
                        y={y} 
                        textAnchor="middle" 
                        className="text-[8.5px] font-sans font-bold fill-slate-550 fill-slate-400"
                      >
                        {d.label}
                      </text>
                    );
                  })}
                </svg>
              </div>

              {/* Dynamic tooltip box layout below the chart */}
              <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-center min-h-[46px] flex flex-col justify-center">
                {hoveredPoint ? (
                  <div>
                    <span className="text-[9.5px] font-black uppercase text-indigo-700 tracking-wider">Fecha: {hoveredPoint.label}</span>
                    <div className="flex justify-center gap-4 text-xs font-mono font-black mt-0.5">
                      <span className="text-emerald-600">Ingresos: ${hoveredPoint.income.toFixed(2)}</span>
                      <span className="text-rose-500">Egresos: ${hoveredPoint.expense.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 font-semibold italic">
                    Desliza el mouse o toca los puntos del gráfico para auditar balances diarios
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chart Column 2: Payment Channels Share Donut */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2.5 mb-3">
              <PieChart className="w-4.5 h-4.5 text-blue-600" />
              <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider">Vías de Captación</h4>
            </div>

            {statsSummary.channels.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-medium">
                Sin datos de caja
              </div>
            ) : (
              <div className="space-y-4">
                {/* Circular indicator widget layout */}
                <div className="flex justify-center py-1">
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    {/* SVG Circular Ring sectors structure */}
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.91549430918954" fill="none" stroke="#f1f5f9" strokeWidth="4.2" />
                      {(() => {
                        let offset = 0;
                        return statsSummary.channels.map((chan, idx) => {
                          const totalUSD = statsSummary.totalIncomeUSD || 1;
                          const percent = (chan.amountUsd / totalUSD) * 100;
                          const currentOffset = offset;
                          offset += percent;
                          
                          // Determine color matching SVG fill rules
                          let labelColor = '#d1d5db';
                          if (chan.name.toLowerCase() === 'efectivo usd') labelColor = '#10b981';
                          else if (chan.name.toLowerCase() === 'efectivo bs') labelColor = '#f59e0b';
                          else if (chan.name.toLowerCase() === 'pago móvil') labelColor = '#6366f1';
                          else if (chan.name.toLowerCase() === 'zelle') labelColor = '#a855f7';
                          else if (chan.name.toLowerCase() === 'usdt') labelColor = '#14b8a6';
                          else if (chan.name.toLowerCase() === 'transferencia') labelColor = '#3b82f6';

                          return (
                            <circle
                              key={idx}
                              cx="18"
                              cy="18"
                              r="15.91549430918954"
                              fill="none"
                              stroke={labelColor}
                              strokeWidth="4.2"
                              strokeDasharray={`${percent} ${100 - percent}`}
                              strokeDashoffset={100 - currentOffset}
                              className="transition-all duration-300"
                            />
                          );
                        });
                      })()}
                    </svg>
                    
                    {/* Centered balance label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Flujo Total</span>
                      <strong className="text-xs font-black text-slate-800 font-mono">
                        ${statsSummary.totalIncomeUSD.toFixed(0)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Styled legend checklist */}
                <div className="space-y-2 text-xs">
                  {statsSummary.channels.slice(0, 4).map((chan, idx) => {
                    const percent = Math.min(100, (chan.amountUsd / (statsSummary.totalIncomeUSD || 1)) * 100);
                    const colorClasses = getChannelColor(chan.name);
                    
                    return (
                      <div key={idx} className="flex items-center justify-between font-medium">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full ${colorClasses.split(' ')[0]}`}></span>
                          <span className="text-slate-600 truncate text-[10.5px] font-semibold">{getChannelLabel(chan.name)}</span>
                        </div>
                        <span className="font-mono text-slate-800 font-bold ml-1.5 shrink-0 text-[10.5px]">
                          {percent.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-2 text-[9px] text-slate-400 mt-2">
            Métricas calculadas en base a ingresos reales históricos por ventas registradas.
          </div>
        </div>
      </div>

      {/* 3. Horizontal bar segment / Category metric metrics */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4.5 shadow-xs space-y-3">
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
          <Layers className="w-4.5 h-4.5 text-indigo-600" />
          <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider">Margen Operativo y Rendimiento</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5">
            <span className="text-slate-550 text-slate-500 uppercase text-[9px] font-bold tracking-wider">Ticket de Venta Promedio</span>
            <div className="flex justify-between items-baseline">
              <strong className="text-lg font-black text-indigo-900 font-mono">
                ${statsSummary.averageSaleUSD.toFixed(2)} <span className="text-xs text-slate-400 font-normal">USD</span>
              </strong>
            </div>
            <p className="text-[9.5px] text-slate-450 leading-normal text-slate-500 pt-1 border-t border-slate-100">
              Valor promedio facturado en cada una de tus ventas del catálogo general.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5">
            <span className="text-slate-550 text-slate-500 uppercase text-[9px] font-bold tracking-wider">Margen de Liquidez Bruta</span>
            <div className="flex justify-between items-baseline">
              <strong className="text-lg font-black text-emerald-600 font-mono">
                {statsSummary.totalIncomeUSD > 0 ? ((statsSummary.cashNetUSD / statsSummary.totalIncomeUSD) * 100).toFixed(0) : '0'}%
              </strong>
              <span className="text-[10px] font-bold text-slate-400">Coeficiente neta</span>
            </div>
            <p className="text-[9.5px] text-slate-455 leading-normal text-slate-500 pt-1 border-t border-slate-100">
              Rentabilidad disponible neta después de restar los gastos corrientes y de proveedores.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
