import React, { useMemo } from 'react';
import { 
  Camera, TrendingUp, ChevronRight, FileText, 
  Receipt, BarChart2, Package, Sparkles, Crown,
  ArrowUpRight, ArrowDownRight, Wallet, Users, Plus, Minus
} from 'lucide-react';
import { motion } from 'motion/react';
import { ExchangeRates, PlanType, InventoryItem, FinancialRecord, DebtItem, ProFeaturesConfig } from '../types';
import { formatMoney, CurrencyCode, getRecordAmountInCurrency } from '../utils/currency';
import { getLocalDateString, parseDateSafe } from '../utils/dateUtils';

interface TabInicioProps {
  userPlan: PlanType;
  rates: ExchangeRates;
  onRefreshRates: (newRates: ExchangeRates) => void;
  onOpenSale: () => void;
  onOpenExpense: () => void;
  onChangeTab: (tabId: 'inicio' | 'balance' | 'cotizaciones' | 'inventario' | 'deudas' | 'clientes' | 'estadisticas' | 'proveedores' | 'empleados' | 'balance_general') => void;
  onShowPlansDialog: () => void;
  inventory: InventoryItem[];
  userEmail: string;
  records: FinancialRecord[];
  onAddRecord: (newRec: Omit<FinancialRecord, 'id'>) => void;
  debts?: DebtItem[];
  onAddDebt?: (newDebt: Omit<DebtItem, 'id'>) => void;
  onDeleteDebt?: (id: string) => void;
  onToggleDebtPaid?: (id: string) => void;
  selectedCurrency?: CurrencyCode;
  proFeaturesConfig?: ProFeaturesConfig;
  isOnline?: boolean;
  isCloudActive?: boolean;
  onOpenVoiceAssistant?: () => void;
}

export default function TabInicio({
  userPlan,
  rates,
  onRefreshRates,
  onOpenSale,
  onOpenExpense,
  onChangeTab,
  onShowPlansDialog,
  inventory,
  userEmail,
  records,
  onAddRecord,
  debts = [],
  onAddDebt,
  onDeleteDebt,
  onToggleDebtPaid,
  selectedCurrency = 'USD',
  proFeaturesConfig,
  isOnline = true,
  isCloudActive = true,
  onOpenVoiceAssistant
}: TabInicioProps) {
  // Compute real metrics for today (in local timezone)
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  
  const { todaySales, todayExpenses, todayBalance, totalInventoryValue } = useMemo(() => {
    const todayRecs = records.filter(r => parseDateSafe(r.date).formatted === todayStr);
    const sales = todayRecs
      .filter(r => r.type === 'ingreso')
      .reduce((sum, r) => sum + getRecordAmountInCurrency(r, selectedCurrency, rates), 0);
    const expenses = todayRecs
      .filter(r => r.type === 'egreso')
      .reduce((sum, r) => sum + getRecordAmountInCurrency(r, selectedCurrency, rates), 0);
    const balance = sales - expenses;

    const bcvUsd = rates?.bcvUsd && rates.bcvUsd > 0 ? rates.bcvUsd : 832.49;
    const bcvEur = rates?.bcvEur && rates.bcvEur > 0 ? rates.bcvEur : 968.07;
    const invValue = inventory.reduce((sum, item) => {
      const itemCur = item.currency || 'USD';
      let itemVal = (item.stock || 0) * (item.price || 0);
      if (itemCur !== selectedCurrency) {
        if (selectedCurrency === 'EUR' && bcvUsd > 0 && bcvEur > 0) {
          itemVal = (itemVal * bcvUsd) / bcvEur;
        } else if (selectedCurrency === 'USD' && bcvUsd > 0 && bcvEur > 0) {
          itemVal = (itemVal * bcvEur) / bcvUsd;
        }
      }
      return sum + itemVal;
    }, 0);

    return {
      todaySales: sales,
      todayExpenses: expenses,
      todayBalance: balance,
      totalInventoryValue: invValue
    };
  }, [records, todayStr, inventory, selectedCurrency, rates]);

  const salesMoney = useMemo(() => formatMoney(todaySales, selectedCurrency, rates), [todaySales, selectedCurrency, rates]);
  const balanceMoney = useMemo(() => formatMoney(todayBalance, selectedCurrency, rates), [todayBalance, selectedCurrency, rates]);
  const expensesMoney = useMemo(() => formatMoney(todayExpenses, selectedCurrency, rates), [todayExpenses, selectedCurrency, rates]);
  const invMoney = useMemo(() => formatMoney(totalInventoryValue, selectedCurrency, rates), [totalInventoryValue, selectedCurrency, rates]);

  const pendingReceivablesUSD = useMemo(() => {
    return debts
      .filter(d => d.type === 'por_cobrar' && d.status === 'pendiente')
      .reduce((sum, d) => sum + d.amount, 0);
  }, [debts]);
  const pendingMoney = useMemo(() => formatMoney(pendingReceivablesUSD, selectedCurrency, rates), [pendingReceivablesUSD, selectedCurrency, rates]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 max-w-5xl mx-auto"
    >
      {/* 1. HERO CARD: "Tu negocio hoy" */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
              Tu negocio hoy
            </h2>
          </div>
          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-100">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>0.0% vs ayer</span>
          </div>
        </div>

        {/* Large Sales Display with USD, EUR and Bs. */}
        <div className="my-3">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-sans">
              {salesMoney.primary}
            </span>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {selectedCurrency}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1 font-mono text-xs">
            <span className="font-bold text-slate-700">{salesMoney.bolivares}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500 font-medium">Ref: {salesMoney.secondary}</span>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Ventas hoy
          </p>
        </div>

        {/* Balance & Gastos hoy sub metrics */}
        <div className="grid grid-cols-2 gap-4 py-3 border-t border-slate-100 my-2">
          <div>
            <div className="text-base sm:text-lg font-black text-slate-800 font-sans">
              {balanceMoney.primary}
            </div>
            <div className="text-[11px] font-mono font-semibold text-slate-500 mt-0.5">
              {balanceMoney.bolivares}
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Balance neto
            </p>
          </div>
          <div 
            onClick={onOpenExpense}
            className="cursor-pointer hover:bg-slate-50/80 p-1 rounded-xl transition-colors"
            title="Registrar nuevo gasto"
          >
            <div className="text-base sm:text-lg font-black text-slate-800 font-sans">
              {expensesMoney.primary}
            </div>
            <div className="text-[11px] font-mono font-semibold text-slate-500 mt-0.5">
              {expensesMoney.bolivares}
            </div>
            <p className="text-xs text-rose-500 font-semibold mt-0.5 flex items-center gap-1">
              <span>Gastos hoy</span>
              <span className="text-[10px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded-sm font-bold">+</span>
            </p>
          </div>
        </div>

        {/* Registrar venta & Nuevo gasto action buttons */}
        <div className="flex gap-2 mt-2">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onOpenSale}
            className="flex-1 py-3 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            id="btn-hero-registrar-venta"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Registrar venta</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onOpenExpense}
            className="py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            id="btn-hero-registrar-gasto"
          >
            <Minus className="w-4 h-4 text-rose-600" />
            <span>Nuevo gasto</span>
          </motion.button>
        </div>
      </div>

      {/* 2. SECTION: "Descubre todo lo que puedes hacer" */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Descubre todo lo que puedes hacer
          </h3>
          <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/60 flex items-center gap-1 shadow-2xs">
            <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span>Herramientas Pro</span>
          </span>
        </div>

        {/* 1st ROW: The 4 core tools (Clientes, Deudas, Cotizaciones, Estadísticas) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Clientes */}
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => onChangeTab('clientes')}
            className="bg-blue-50/80 hover:bg-blue-50 border border-blue-200/60 rounded-2xl p-4 text-left flex flex-col justify-between min-h-[120px] transition-all cursor-pointer shadow-xs group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              {proFeaturesConfig?.clientes ? (
                <span className="text-[10px] font-black text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-500" /> Pro
                </span>
              ) : (
                <span className="text-[10px] font-black text-blue-800 bg-blue-200/60 px-1.5 py-0.5 rounded-md">
                  Gestión
                </span>
              )}
            </div>
            <div className="mt-3">
              <div className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                Clientes
              </div>
              <p className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-1">
                Registro y fichas
              </p>
            </div>
          </motion.button>

          {/* Card 2: Deudas */}
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => onChangeTab('deudas')}
            className="bg-emerald-50/80 hover:bg-emerald-50 border border-emerald-200/60 rounded-2xl p-4 text-left flex flex-col justify-between min-h-[120px] transition-all cursor-pointer shadow-xs group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Receipt className="w-5 h-5 text-emerald-600" />
              </div>
              {proFeaturesConfig?.deudas ? (
                <span className="text-[10px] font-black text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-500" /> Pro
                </span>
              ) : null}
            </div>
            <div className="mt-3">
              <div className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                Deudas
              </div>
              <p className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-1">
                Por cobrar y pagar
              </p>
            </div>
          </motion.button>

          {/* Card 3: Cotizaciones */}
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => onChangeTab('cotizaciones')}
            className="bg-amber-50/80 hover:bg-amber-50 border border-amber-200/60 rounded-2xl p-4 text-left flex flex-col justify-between min-h-[120px] transition-all cursor-pointer shadow-xs group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              {proFeaturesConfig?.cotizaciones ? (
                <span className="text-[10px] font-black text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-500" /> Pro
                </span>
              ) : (
                <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md">
                  Doc
                </span>
              )}
            </div>
            <div className="mt-3">
              <div className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                Cotizaciones
              </div>
              <p className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-1">
                Envía a clientes
              </p>
            </div>
          </motion.button>

          {/* Card 4: Estadísticas */}
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => onChangeTab('estadisticas')}
            className="bg-purple-50/80 hover:bg-purple-50 border border-purple-200/60 rounded-2xl p-4 text-left flex flex-col justify-between min-h-[120px] transition-all cursor-pointer shadow-xs group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BarChart2 className="w-5 h-5 text-purple-600" />
              </div>
              {proFeaturesConfig?.estadisticas ? (
                <span className="text-[10px] font-black text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-500" /> Pro
                </span>
              ) : null}
            </div>
            <div className="mt-3">
              <div className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                Estadísticas
              </div>
              <p className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-1">
                Rendimiento de ventas
              </p>
            </div>
          </motion.button>
        </div>

        {/* 2nd ROW (PLACED UNDERNEATH / DE ÚLTIMO): FINOVA AI ASISTENTE INTELIGENTE */}
        {onOpenVoiceAssistant && (
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onOpenVoiceAssistant}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-[#0a0f1d] to-slate-900 p-4 sm:p-5 text-white border border-blue-500/30 shadow-md cursor-pointer group"
          >
            {/* Ambient decorative glowing halo in Gemini colors */}
            <div className="absolute right-0 top-0 w-56 h-56 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-amber-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between relative z-10 gap-3">
              <div className="flex items-center gap-3.5">
                {/* Gemini 4-Point Multi-Color Sparkle Avatar */}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-amber-500 p-0.5 shadow-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <div className="w-full h-full bg-[#0d121f] rounded-[14px] flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-amber-400 fill-amber-400 animate-pulse" />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                      <span>Finova AI • Asistente Inteligente</span>
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-400 text-white px-2 py-0.5 rounded-full shadow-xs">
                      Control Total
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-300">
                    Interactúa por voz o chat: registra ventas, clientes, deudas, pérdidas y consultas de negocio.
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5 text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 px-3.5 py-2 rounded-xl group-hover:scale-105 shadow-md transition-all">
                <span>Abrir Chat</span>
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* 3. PROMOTIONAL BANNER */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative z-10 space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Novedad para tu negocio</span>
          </div>
          <h4 className="text-base sm:text-lg font-black tracking-tight text-white">
            ¡Agiliza tus ventas!
          </h4>
          <p className="text-xs text-emerald-100 leading-relaxed">
            Con el Plan Básico o Pro, genera tickets de venta profesionales e imprime resúmenes para tus clientes en divisas (USD / EUR) y bolívares.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={onShowPlansDialog}
          className="relative z-10 shrink-0 bg-white hover:bg-slate-50 text-slate-900 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
        >
          <span>Explorar planes</span>
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </motion.button>
      </div>

      {/* 4. SECTION: "Estadísticas y Resumen Real" */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Métricas del Negocio
              </h3>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-500 fill-amber-400" />
                <span>En tiempo real</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Valores calculados dinámicamente con tus registros reales.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onChangeTab('estadisticas')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
          >
            <span>Ver reporte completo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Insights Cards - Zero Mock Data */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              CUENTAS POR COBRAR
            </span>
            <p className="text-xs font-bold text-slate-800 mt-1">
              {debts.filter(d => d.type === 'por_cobrar' && d.status === 'pendiente').length} cobros pendientes
            </p>
            <span className="text-xs font-black text-emerald-600 font-mono block mt-0.5">
              {pendingMoney.primary}
            </span>
            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
              {pendingMoney.bolivares}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              VALOR EN INVENTARIO
            </span>
            <p className="text-xs font-bold text-slate-800 mt-1">
              {inventory.length === 0 ? '0 productos registrados' : inventory.length === 1 ? '1 producto registrado' : `${inventory.length} productos registrados`}
            </p>
            <span className="text-xs font-black text-blue-600 font-mono block mt-0.5">
              {invMoney.primary}
            </span>
            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
              {invMoney.bolivares}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              TASAS OFICIALES BCV
            </span>
            <p className="text-xs font-bold text-slate-800 mt-1">
              Dólar & Euro Oficial
            </p>
            <div className="text-xs font-black text-slate-900 font-mono block mt-0.5">
              $ Bs. {rates.bcvUsd.toFixed(2)}
            </div>
            <div className="text-[10.5px] font-black text-slate-600 font-mono block mt-0.5">
              € Bs. {rates.bcvEur.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

