import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, Filter, ArrowUpRight, ArrowDownRight, 
  Trash2, FileText, Download, TrendingUp, Search, 
  ChevronLeft, ChevronRight, X, Plus, Minus, Check, 
  Clock, DollarSign, Wallet, CalendarDays, RefreshCw, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FinancialRecord, ExchangeRates } from '../types';
import { formatMoney, CurrencyCode } from '../utils/currency';
import { 
  getLocalDateString, 
  parseDateSafe, 
  getDaysInMonth, 
  MONTH_NAMES_ES, 
  MONTH_SHORT_ES, 
  WEEKDAYS_SHORT_ES 
} from '../utils/dateUtils';

interface TabBalanceProps {
  records: FinancialRecord[];
  onDeleteRecord: (id: string) => void;
  onOpenSale: () => void;
  onOpenExpense: () => void;
  rates: ExchangeRates;
  onNavigateToGeneralBalance?: () => void;
  selectedCurrency?: CurrencyCode;
}

export default function TabBalance({
  records = [],
  onDeleteRecord,
  onOpenSale,
  onOpenExpense,
  rates,
  onNavigateToGeneralBalance,
  selectedCurrency = 'USD'
}: TabBalanceProps) {
  // Current local time reference
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => getLocalDateString(today), [today]);
  const currentYear = useMemo(() => today.getFullYear(), [today]);
  const currentMonth = useMemo(() => today.getMonth() + 1, [today]);
  const currentDay = useMemo(() => today.getDate(), [today]);

  // Selected date & filter states (Always in local time)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth); // 1-12
  const [selectedWeek, setSelectedWeek] = useState<number>(() => {
    return Math.min(5, Math.ceil(currentDay / 7));
  });
  const [periodMode, setPeriodMode] = useState<'diario' | 'semanal' | 'mensual' | 'anual'>('diario');
  const [balanceSubTab, setBalanceSubTab] = useState<'ingreso' | 'egreso'>('ingreso');
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Years available for historical audits (past 4 years, current, next, plus any year from records)
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>([
      currentYear - 3,
      currentYear - 2,
      currentYear - 1,
      currentYear,
      currentYear + 1
    ]);
    (records || []).forEach(r => {
      if (r?.date) {
        const { year } = parseDateSafe(r.date);
        if (year > 2000 && year < 2100) yearSet.add(year);
      }
    });
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [records, currentYear]);

  // Days in currently selected month
  const daysInSelectedMonth = useMemo(() => {
    return getDaysInMonth(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Clamp week if month has less than 29 days
  useEffect(() => {
    if (daysInSelectedMonth < 29 && selectedWeek > 4) {
      setSelectedWeek(4);
    }
  }, [daysInSelectedMonth, selectedWeek]);

  // Sync date when user selects a specific date
  const handleSelectDate = (dateStr: string) => {
    const parsed = parseDateSafe(dateStr);
    setSelectedDate(parsed.formatted);
    setSelectedYear(parsed.year);
    setSelectedMonth(parsed.month);
    setSelectedWeek(Math.min(5, Math.ceil(parsed.day / 7)));
  };

  // Sync when user changes month
  const handleChangeMonth = (newMonth: number, newYear?: number) => {
    const yr = newYear ?? selectedYear;
    setSelectedMonth(newMonth);
    if (newYear !== undefined) setSelectedYear(yr);

    const maxDays = getDaysInMonth(yr, newMonth);
    const prevDay = parseDateSafe(selectedDate).day;
    const safeDay = Math.min(Math.max(1, prevDay || 1), maxDays);
    const padM = String(newMonth).padStart(2, '0');
    const padD = String(safeDay).padStart(2, '0');
    const newDateStr = `${yr}-${padM}-${padD}`;
    setSelectedDate(newDateStr);
    setSelectedWeek(Math.min(5, Math.ceil(safeDay / 7)));
  };

  // Sync when user changes year
  const handleChangeYear = (newYear: number) => {
    setSelectedYear(newYear);
    const maxDays = getDaysInMonth(newYear, selectedMonth);
    const prevDay = parseDateSafe(selectedDate).day;
    const safeDay = Math.min(Math.max(1, prevDay || 1), maxDays);
    const padM = String(selectedMonth).padStart(2, '0');
    const padD = String(safeDay).padStart(2, '0');
    const newDateStr = `${newYear}-${padM}-${padD}`;
    setSelectedDate(newDateStr);
    setSelectedWeek(Math.min(5, Math.ceil(safeDay / 7)));
  };

  // Previous Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      handleChangeMonth(12, selectedYear - 1);
    } else {
      handleChangeMonth(selectedMonth - 1);
    }
  };

  // Next Month navigation
  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      handleChangeMonth(1, selectedYear + 1);
    } else {
      handleChangeMonth(selectedMonth + 1);
    }
  };

  // Set to today
  const handleSetToday = () => {
    handleSelectDate(todayStr);
    setPeriodMode('diario');
  };

  // Map of dates with records for visual status indicators (dots)
  const recordsDateMap = useMemo(() => {
    const map = new Map<string, { hasIngreso: boolean; hasEgreso: boolean; count: number }>();
    (records || []).forEach(r => {
      if (!r?.date) return;
      const { formatted } = parseDateSafe(r.date);
      if (!formatted) return;
      const prev = map.get(formatted) || { hasIngreso: false, hasEgreso: false, count: 0 };
      if (r.type === 'ingreso') prev.hasIngreso = true;
      if (r.type === 'egreso') prev.hasEgreso = true;
      prev.count += 1;
      map.set(formatted, prev);
    });
    return map;
  }, [records]);

  // Generate days pills for "diario"
  const monthDayPills = useMemo(() => {
    const list: { 
      label: string; 
      dateStr: string; 
      isToday: boolean; 
      dayNum: number;
      hasIngreso: boolean;
      hasEgreso: boolean;
    }[] = [];

    const mStr = String(selectedMonth).padStart(2, '0');
    for (let d = 1; d <= daysInSelectedMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const fullDate = `${selectedYear}-${mStr}-${dStr}`;
      const dObj = new Date(selectedYear, selectedMonth - 1, d);
      const weekday = dObj.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
      const status = recordsDateMap.get(fullDate);

      list.push({
        label: `${dStr} ${weekday}`,
        dateStr: fullDate,
        isToday: fullDate === todayStr,
        dayNum: d,
        hasIngreso: Boolean(status?.hasIngreso),
        hasEgreso: Boolean(status?.hasEgreso)
      });
    }
    return list;
  }, [selectedYear, selectedMonth, daysInSelectedMonth, todayStr, recordsDateMap]);

  // Week configuration for selected month
  const weekList = useMemo(() => {
    const maxDays = daysInSelectedMonth;
    const list = [
      { week: 1, label: 'Semana 1', range: '1 - 7', start: 1, end: 7 },
      { week: 2, label: 'Semana 2', range: '8 - 14', start: 8, end: 14 },
      { week: 3, label: 'Semana 3', range: '15 - 21', start: 15, end: 21 },
      { week: 4, label: 'Semana 4', range: '22 - 28', start: 22, end: 28 },
    ];
    if (maxDays >= 29) {
      list.push({
        week: 5,
        label: 'Semana 5',
        range: `29 - ${maxDays}`,
        start: 29,
        end: maxDays
      });
    }
    return list;
  }, [daysInSelectedMonth]);

  // Filter records strictly by selected periodMode and date boundaries
  const filteredRecords = useMemo(() => {
    if (!Array.isArray(records)) return [];

    return records.filter(rec => {
      if (!rec || !rec.date) return false;
      const { year: rYear, month: rMonth, day: rDay, formatted: rDateStr } = parseDateSafe(rec.date);
      if (!rDateStr) return false;

      // 1. DIARIO: Matches exact day
      if (periodMode === 'diario') {
        if (rDateStr !== selectedDate) return false;
      }
      // 2. SEMANAL: Matches selected week within selected month & year
      else if (periodMode === 'semanal') {
        if (rYear !== selectedYear || rMonth !== selectedMonth) return false;
        if (selectedWeek === 1 && (rDay < 1 || rDay > 7)) return false;
        if (selectedWeek === 2 && (rDay < 8 || rDay > 14)) return false;
        if (selectedWeek === 3 && (rDay < 15 || rDay > 21)) return false;
        if (selectedWeek === 4 && (rDay < 22 || rDay > 28)) return false;
        if (selectedWeek === 5 && (rDay < 29 || rDay > 31)) return false;
      }
      // 3. MENSUAL: Matches whole month and year (Enero to Diciembre)
      else if (periodMode === 'mensual') {
        if (rYear !== selectedYear || rMonth !== selectedMonth) return false;
      }
      // 4. ANUAL: Matches whole year
      else if (periodMode === 'anual') {
        if (rYear !== selectedYear) return false;
      }

      // Search query filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = (rec.description || '').toLowerCase().includes(q);
        const matchCat = (rec.category || '').toLowerCase().includes(q);
        const matchMethod = (rec.paymentMethod || '').toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchMethod) return false;
      }

      return true;
    });
  }, [records, selectedDate, periodMode, selectedYear, selectedMonth, selectedWeek, searchQuery]);

  // Financial Stats
  const { totalIngreso, totalEgreso, netBalance } = useMemo(() => {
    let ing = 0;
    let eg = 0;
    filteredRecords.forEach(r => {
      const amt = Number(r.amount) || 0;
      if (r.type === 'ingreso') ing += amt;
      else if (r.type === 'egreso') eg += amt;
    });
    return {
      totalIngreso: ing,
      totalEgreso: eg,
      netBalance: ing - eg
    };
  }, [filteredRecords]);

  const netMoney = useMemo(() => formatMoney(netBalance, selectedCurrency, rates), [netBalance, selectedCurrency, rates]);
  const ingresoMoney = useMemo(() => formatMoney(totalIngreso, selectedCurrency, rates), [totalIngreso, selectedCurrency, rates]);
  const egresoMoney = useMemo(() => formatMoney(totalEgreso, selectedCurrency, rates), [totalEgreso, selectedCurrency, rates]);

  // Active sub-tab records
  const tabRecords = useMemo(() => {
    return filteredRecords.filter(r => r.type === balanceSubTab);
  }, [filteredRecords, balanceSubTab]);

  const triggerDownload = (type: 'pdf' | 'excel') => {
    setNotification(`Generando reporte de balance (${type.toUpperCase()})...`);
    setShowReportModal(false);
    setTimeout(() => {
      setNotification(null);
    }, 2500);
  };

  // Visual calendar grid generation for the Period Modal
  const calendarGrid = useMemo(() => {
    const firstDayIndex = (new Date(selectedYear, selectedMonth - 1, 1).getDay() + 6) % 7; // Monday = 0
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const mStr = String(selectedMonth).padStart(2, '0');

    const blanks = Array.from({ length: firstDayIndex }, (_, i) => ({ type: 'blank' as const, key: `b-${i}` }));
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dStr = String(d).padStart(2, '0');
      const dateString = `${selectedYear}-${mStr}-${dStr}`;
      const status = recordsDateMap.get(dateString);
      return {
        type: 'day' as const,
        day: d,
        dateString,
        isToday: dateString === todayStr,
        isSelected: dateString === selectedDate,
        hasIngreso: Boolean(status?.hasIngreso),
        hasEgreso: Boolean(status?.hasEgreso),
        key: `d-${d}`
      };
    });

    return [...blanks, ...days];
  }, [selectedYear, selectedMonth, todayStr, selectedDate, recordsDateMap]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 max-w-5xl mx-auto pb-36 sm:pb-28"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-55 flex items-center gap-2 bg-slate-900 border border-slate-700 text-white py-3 px-5 rounded-2xl shadow-2xl text-xs font-bold"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. COMPREHENSIVE PERIOD & DATE SELECTOR (Diario, Semanal, Mensual, Anual) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-3 sm:p-4 shadow-xs space-y-3">
        {/* Mode switcher tabs: Diario, Semanal, Mensual, Anual */}
        <div className="flex items-center justify-between gap-2">
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5 flex-1 bg-slate-100 p-1 rounded-2xl">
            {(['diario', 'semanal', 'mensual', 'anual'] as const).map((mode) => {
              const labels = {
                diario: 'Diario',
                semanal: 'Semanal',
                mensual: 'Mensual',
                anual: 'Anual'
              };
              const isSelected = periodMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPeriodMode(mode)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-black transition-all text-center cursor-pointer ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {labels[mode]}
                </button>
              );
            })}
          </div>

          {/* Period Modal / Calendar Button */}
          <button
            type="button"
            onClick={() => setShowPeriodModal(true)}
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-xs"
            title="Abrir calendario completo y filtros"
          >
            <Calendar className="w-4 h-4 text-amber-500" />
          </button>
        </div>

        {/* Dynamic Controls based on Period Mode */}
        {/* MODE A: DIARIO - Days of the selected month */}
        {periodMode === 'diario' && (
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  title="Mes anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-black text-slate-800">
                  {MONTH_NAMES_ES[selectedMonth - 1]} {selectedYear}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  title="Mes siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleSetToday}
                className="text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1"
              >
                <span>Ir a Hoy</span>
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Horizontal list of days in selected month */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {monthDayPills.map((pill) => {
                const isSelected = selectedDate === pill.dateStr;
                return (
                  <button
                    key={pill.dateStr}
                    type="button"
                    onClick={() => handleSelectDate(pill.dateStr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer relative shrink-0 ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs font-black'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                    <span>{pill.label}</span>

                    {/* Today indicator dot */}
                    {pill.isToday && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute top-1 right-1"></span>
                    )}

                    {/* Transaction presence indicators */}
                    {(pill.hasIngreso || pill.hasEgreso) && !isSelected && (
                      <span className="flex items-center gap-0.5 absolute -bottom-0.5 left-1/2 -translate-x-1/2">
                        {pill.hasIngreso && <span className="w-1 h-1 rounded-full bg-emerald-500"></span>}
                        {pill.hasEgreso && <span className="w-1 h-1 rounded-full bg-rose-500"></span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MODE B: SEMANAL - Weeks in a single horizontal row */}
        {periodMode === 'semanal' && (
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  title="Mes anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-black text-slate-800">
                  {MONTH_NAMES_ES[selectedMonth - 1]} {selectedYear}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  title="Mes siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <span className="text-[11px] font-semibold text-slate-500">
                Semana {selectedWeek} seleccionada
              </span>
            </div>

            {/* Weeks inline pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {weekList.map(({ week, label, range }) => {
                const isSelected = selectedWeek === week;
                return (
                  <button
                    key={week}
                    type="button"
                    onClick={() => setSelectedWeek(week)}
                    className={`px-3.5 py-2 rounded-xl text-xs whitespace-nowrap shrink-0 transition-all text-center cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs font-black'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className="font-extrabold">{label}</span>
                    <span className={`ml-1.5 text-[10px] ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                      (Días {range})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MODE C: MENSUAL - 12 Months in a single horizontal row */}
        {periodMode === 'mensual' && (
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleChangeYear(selectedYear - 1)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  title="Año anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-black text-slate-800">
                  Año {selectedYear}
                </span>
                <button
                  type="button"
                  onClick={() => handleChangeYear(selectedYear + 1)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  title="Año siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <span className="text-[11px] font-semibold text-slate-500">
                {MONTH_NAMES_ES[selectedMonth - 1]} {selectedYear}
              </span>
            </div>

            {/* 12 Months horizontal pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {MONTH_SHORT_ES.map((shortName, idx) => {
                const monthNum = idx + 1;
                const isSelected = selectedMonth === monthNum;
                return (
                  <button
                    key={shortName}
                    type="button"
                    onClick={() => handleChangeMonth(monthNum)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap shrink-0 transition-all text-center cursor-pointer border ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {shortName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MODE D: ANUAL - Multi-year selection */}
        {periodMode === 'anual' && (
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="font-bold text-slate-500">
                Selecciona el año que deseas auditar:
              </span>
              <span className="font-black text-slate-900 text-xs font-mono">
                Año {selectedYear}
              </span>
            </div>

            {/* Year pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {availableYears.map((yr) => {
                const isSelected = selectedYear === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => handleChangeYear(yr)}
                    className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-100'
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. MAIN BALANCE CARD */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4 relative">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Balance Total
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                {periodMode === 'diario' && (() => {
                  const parts = selectedDate.split('-');
                  if (parts.length === 3) {
                    return `Día ${Number(parts[2])}/${Number(parts[1])}`;
                  }
                  return `Día ${selectedDate}`;
                })()}
                {periodMode === 'semanal' && `Semana ${selectedWeek} • ${MONTH_NAMES_ES[selectedMonth - 1]} ${selectedYear}`}
                {periodMode === 'mensual' && `${MONTH_NAMES_ES[selectedMonth - 1]} ${selectedYear}`}
                {periodMode === 'anual' && `Año Completo ${selectedYear}`}
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-sans mt-0.5">
              {netMoney.primary}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 font-mono mt-0.5 flex items-center gap-2">
              <span>{netMoney.bolivares}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-400">Ref: {netMoney.secondary}</span>
            </div>
          </div>
        </div>

        {/* Sub-row: Ingresos and Egresos */}
        <div className="grid grid-cols-2 gap-4 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-semibold leading-none">Ingresos</p>
              <p className="text-sm sm:text-base font-black text-emerald-600 font-sans mt-0.5">
                {ingresoMoney.primary}
              </p>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{ingresoMoney.bolivares}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
              <ArrowDownRight className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-semibold leading-none">Egresos</p>
              <p className="text-sm sm:text-base font-black text-rose-600 font-sans mt-0.5">
                {egresoMoney.primary}
              </p>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{egresoMoney.bolivares}</p>
            </div>
          </div>
        </div>

        {/* Action links row */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="text-amber-600 hover:text-amber-700 flex items-center gap-1.5 hover:underline cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Reportes</span>
          </button>

          {onNavigateToGeneralBalance && (
            <button
              type="button"
              onClick={onNavigateToGeneralBalance}
              className="text-slate-600 hover:text-slate-900 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span>Ver Balance General</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. SUBTABS: "Ingresos" | "Egresos" */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60 relative">
        <button
          type="button"
          onClick={() => setBalanceSubTab('ingreso')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer relative z-10 ${
            balanceSubTab === 'ingreso' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Ingresos ({filteredRecords.filter(r => r.type === 'ingreso').length})
          {balanceSubTab === 'ingreso' && (
            <motion.div
              layoutId="balanceTabIndicator"
              className="absolute inset-0 bg-white rounded-xl shadow-xs -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 35 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setBalanceSubTab('egreso')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer relative z-10 ${
            balanceSubTab === 'egreso' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Egresos ({filteredRecords.filter(r => r.type === 'egreso').length})
          {balanceSubTab === 'egreso' && (
            <motion.div
              layoutId="balanceTabIndicator"
              className="absolute inset-0 bg-white rounded-xl shadow-xs -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 35 }}
            />
          )}
        </button>
      </div>

      {/* Search Filter Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Buscar movimientos por descripción o método de pago..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 4. TRANSACTION ITEMS OR EMPTY STATE */}
      <div className="space-y-2.5">
        {tabRecords.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[300px] shadow-xs"
          >
            {/* Clock Illustration vector */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4 relative shadow-sm">
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-xs">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
              <Clock className="w-12 h-12 sm:w-14 sm:h-14 text-amber-500" strokeWidth={1.5} />
            </div>

            <h4 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight max-w-sm">
              No tienes registros creados en este periodo.
            </h4>
            <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
              Registra tus ventas o egresos para comenzar a ver el flujo de caja en tiempo real.
            </p>

            <div className="flex items-center gap-2.5 mt-5">
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={onOpenSale}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nueva venta</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={onOpenExpense}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
                <span>- Nuevo gasto</span>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          tabRecords.map((rec) => {
            const isIngreso = rec.type === 'ingreso';
            const { formatted: recordDateFormatted } = parseDateSafe(rec.date);

            return (
              <motion.div
                key={rec.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-200/80 hover:border-slate-300 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xs transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isIngreso 
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                      : 'bg-rose-50 text-rose-600 border border-rose-100'
                  }`}>
                    {isIngreso ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {rec.description}
                    </p>
                    {rec.soldItems && rec.soldItems.length > 0 && (
                      <div className="flex items-center gap-1 my-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-blue-700 bg-blue-50 border border-blue-200/70 px-1.5 py-0.2 rounded-md">
                          <Package className="w-2.5 h-2.5 text-blue-600" />
                          <span>{rec.soldItems.map(si => `${si.quantity}x ${si.name}`).join(', ')}</span>
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 mt-0.5 flex-wrap">
                      <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded-md uppercase text-[9.5px]">
                        {rec.paymentMethod}
                      </span>
                      <span>•</span>
                      <span>{rec.category || (isIngreso ? 'Venta' : 'Gasto')}</span>
                      <span>•</span>
                      <span>{recordDateFormatted || rec.date}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    {(() => {
                      const rMoney = formatMoney(rec.amount, selectedCurrency, rates);
                      return (
                        <>
                          <div className={`text-sm sm:text-base font-black font-sans ${
                            isIngreso ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {isIngreso ? '+' : '-'}{rMoney.primary}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 font-semibold">
                            {rMoney.bolivares}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteRecord(rec.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                    title="Eliminar movimiento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* 5. FLOATING BOTTOM ACTION BUTTONS */}
      <div className="fixed bottom-24 sm:bottom-8 left-0 right-0 max-w-md mx-auto px-4 z-30 pointer-events-none">
        <div className="grid grid-cols-2 gap-3 p-1.5 bg-white/80 backdrop-blur-md rounded-2xl border border-white/80 shadow-2xl shadow-slate-900/15 pointer-events-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={onOpenSale}
            className="py-3 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer border border-emerald-500/80 whitespace-nowrap"
            id="btn-balance-sale"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>+ Nueva venta</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={onOpenExpense}
            className="py-3 px-3.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer border border-rose-500/80 whitespace-nowrap"
            id="btn-balance-expense"
          >
            <Minus className="w-4 h-4 shrink-0" />
            <span>- Nuevo gasto</span>
          </motion.button>
        </div>
      </div>

      {/* MODAL: Calendario Completo y Selector de Periodos */}
      {showPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900">
                  Filtro y Calendario de Balance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPeriodModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Period Switcher */}
            <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
              {(['diario', 'semanal', 'mensual', 'anual'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPeriodMode(mode)}
                  className={`py-2 px-1 rounded-xl text-center capitalize transition-all cursor-pointer ${
                    periodMode === mode 
                      ? 'bg-amber-400 text-slate-950 font-black shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* INTERACTIVE CALENDAR MONTH GRID */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <span>{MONTH_NAMES_ES[selectedMonth - 1]}</span>
                  <span>{selectedYear}</span>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-slate-400 uppercase">
                {WEEKDAYS_SHORT_ES.map(day => (
                  <span key={day} className="py-1">{day}</span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarGrid.map((item) => {
                  if (item.type === 'blank') {
                    return <div key={item.key} className="h-8" />;
                  }

                  const isSelected = item.isSelected;
                  const isToday = item.isToday;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        handleSelectDate(item.dateString);
                        setPeriodMode('diario');
                        setShowPeriodModal(false);
                      }}
                      className={`h-8 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center relative cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white font-black shadow-xs'
                          : isToday
                          ? 'bg-amber-100 text-amber-900 font-extrabold border border-amber-300'
                          : 'hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{item.day}</span>
                      {(item.hasIngreso || item.hasEgreso) && !isSelected && (
                        <span className="flex items-center gap-0.5 absolute bottom-0.5">
                          {item.hasIngreso && <span className="w-1 h-1 rounded-full bg-emerald-500"></span>}
                          {item.hasEgreso && <span className="w-1 h-1 rounded-full bg-rose-500"></span>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Date Shortcuts */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => {
                  handleSetToday();
                  setShowPeriodModal(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0 cursor-pointer"
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  handleSelectDate(getLocalDateString(yesterday));
                  setPeriodMode('diario');
                  setShowPeriodModal(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0 cursor-pointer"
              >
                Ayer
              </button>

              <button
                type="button"
                onClick={() => {
                  setPeriodMode('semanal');
                  setShowPeriodModal(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0 cursor-pointer"
              >
                Esta Semana
              </button>

              <button
                type="button"
                onClick={() => {
                  setPeriodMode('mensual');
                  setShowPeriodModal(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0 cursor-pointer"
              >
                Este Mes
              </button>

              <button
                type="button"
                onClick={() => {
                  setPeriodMode('anual');
                  setShowPeriodModal(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0 cursor-pointer"
              >
                Año {selectedYear}
              </button>
            </div>

            {/* Manual Date Input */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                O introduce una fecha directa:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    handleSelectDate(e.target.value);
                    setPeriodMode('diario');
                    setShowPeriodModal(false);
                  }
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono"
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: Descargar Reportes */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Descargar Reporte Financiero
              </h3>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Exporta los movimientos de balance correspondientes al periodo seleccionado ({periodMode.toUpperCase()}).
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => triggerDownload('pdf')}
                className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>Documento PDF</span>
              </button>

              <button
                type="button"
                onClick={() => triggerDownload('excel')}
                className="p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
              >
                <FileText className="w-5 h-5" />
                <span>Hoja de Cálculo XLS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
