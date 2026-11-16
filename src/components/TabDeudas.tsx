import React, { useState, useMemo } from 'react';
import { 
  CheckCircle, PlusCircle, Trash2, Calendar, 
  User, Check, AlertCircle, Sparkles, Receipt,
  Ban, Plus, Camera, DollarSign, X, FileText,
  Share2, Coins, ArrowRight, Clock, Percent,
  ChevronLeft, ChevronRight, RefreshCw, Filter,
  ArrowUpRight, ArrowDownRight, Wallet, Users,
  Phone, Send, CheckCircle2, History, ChevronDown,
  ChevronUp, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DebtItem, DebtPayment, ExchangeRates } from '../types';
import { formatMoney, CurrencyCode, getRecordAmountInCurrency } from '../utils/currency';
import { 
  getDebtRemainingAmount, 
  getDebtPaidAmount, 
  getDebtProgressPercentage 
} from '../utils/debtUtils';
import { 
  getLocalDateString, 
  parseDateSafe, 
  MONTH_NAMES_ES, 
  MONTH_SHORT_ES, 
  getDaysInMonth 
} from '../utils/dateUtils';
import DebtFlowModal from './DebtFlowModal';
import AddDebtPaymentModal from './AddDebtPaymentModal';
import DebtInvoiceModal from './DebtInvoiceModal';

export interface ClientDebtGroup {
  debtorName: string;
  debts: DebtItem[];
  totalAmount: number;
  totalRemaining: number;
  totalPaid: number;
  pendingCount: number;
  paidCount: number;
  isFullyPaid: boolean;
  clientPhone?: string;
  earliestDueDate?: string;
  currency: 'USD' | 'EUR';
}

interface TabDeudasProps {
  debts: DebtItem[];
  onAddDebt: (debt: Omit<DebtItem, 'id' | 'dateCreated'>) => void;
  onDeleteDebt: (id: string) => void;
  onToggleDebtPaid: (id: string) => void;
  onApplyPayment?: (debtId: string, payment: Omit<DebtPayment, 'id'>, registerAsIncome: boolean) => void;
  onApplyClientPayment?: (clientName: string, payment: Omit<DebtPayment, 'id'>, registerAsIncome: boolean) => void;
  onUpdateDebt?: (debtId: string, updates: Partial<DebtItem>) => void;
  rates: ExchangeRates;
  onOpenSale?: () => void;
  selectedCurrency?: CurrencyCode;
  userEmail?: string;
  companyName?: string;
  clients?: any[];
}

export default function TabDeudas({
  debts,
  onAddDebt,
  onDeleteDebt,
  onToggleDebtPaid,
  onApplyPayment,
  onApplyClientPayment,
  onUpdateDebt,
  rates,
  onOpenSale,
  selectedCurrency = 'USD',
  userEmail,
  companyName = 'Finova Comercio',
  clients = []
}: TabDeudasProps) {
  const [debtTypeTab, setDebtTypeTab] = useState<'por_cobrar' | 'por_pagar'>('por_cobrar');
  const [viewStyle, setViewStyle] = useState<'clientes' | 'notas'>('clientes');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalPreselectedName, setAddModalPreselectedName] = useState('');
  const [addModalPreselectedPhone, setAddModalPreselectedPhone] = useState('');
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<DebtItem | null>(null);
  const [selectedDebtForInvoice, setSelectedDebtForInvoice] = useState<DebtItem | null>(null);

  // Consolidated Client Payment Modal (Abonar a la cuenta consolidada del cliente)
  const [clientForConsolidatedPayment, setClientForConsolidatedPayment] = useState<ClientDebtGroup | null>(null);
  const [clientPaymentAmount, setClientPaymentAmount] = useState('');
  const [clientPaymentMethod, setClientPaymentMethod] = useState('Efectivo USD');
  const [clientPaymentRef, setClientPaymentRef] = useState('');
  const [clientPaymentRegisterIncome, setClientPaymentRegisterIncome] = useState(true);

  // Client Details Drawer / Modal
  const [clientForLedgerView, setClientForLedgerView] = useState<ClientDebtGroup | null>(null);

  // --- PERIOD FILTER STATE (Diario, Semanal, Mensual, Anual, Todos) ---
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => getLocalDateString(today), [today]);
  const currentYear = useMemo(() => today.getFullYear(), [today]);
  const currentMonth = useMemo(() => today.getMonth() + 1, [today]);
  const currentDay = useMemo(() => today.getDate(), [today]);

  const [periodMode, setPeriodMode] = useState<'diario' | 'semanal' | 'mensual' | 'anual' | 'todos'>('todos');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedWeek, setSelectedWeek] = useState<number>(() => Math.min(5, Math.ceil(currentDay / 7)));

  // Helper date checker for a date string against current period
  const isDateInSelectedPeriod = (dateStr?: string) => {
    if (!dateStr || periodMode === 'todos') return true;
    const { year: rYear, month: rMonth, day: rDay, formatted } = parseDateSafe(dateStr);
    if (!formatted) return false;

    if (periodMode === 'diario') {
      return formatted === selectedDate;
    } else if (periodMode === 'semanal') {
      if (rYear !== selectedYear || rMonth !== selectedMonth) return false;
      if (selectedWeek === 1 && (rDay < 1 || rDay > 7)) return false;
      if (selectedWeek === 2 && (rDay < 8 || rDay > 14)) return false;
      if (selectedWeek === 3 && (rDay < 15 || rDay > 21)) return false;
      if (selectedWeek === 4 && (rDay < 22 || rDay > 28)) return false;
      if (selectedWeek === 5 && (rDay < 29 || rDay > 31)) return false;
      return true;
    } else if (periodMode === 'mensual') {
      return rYear === selectedYear && rMonth === selectedMonth;
    } else if (periodMode === 'anual') {
      return rYear === selectedYear;
    }
    return true;
  };

  // Base debts matching active sub tab
  const activeDebtsBase = useMemo(() => {
    return debts.filter(d => d.type === debtTypeTab);
  }, [debts, debtTypeTab]);

  // Debts filtered by selected period
  const activeDebts = useMemo(() => {
    if (periodMode === 'todos') return activeDebtsBase;
    return activeDebtsBase.filter(d => {
      const debtDate = d.dateCreated || d.dueDate || todayStr;
      const createdInPeriod = isDateInSelectedPeriod(debtDate);
      const hasPaymentInPeriod = (d.payments || []).some(p => isDateInSelectedPeriod(p.date));
      return createdInPeriod || hasPaymentInPeriod;
    });
  }, [activeDebtsBase, periodMode, selectedDate, selectedYear, selectedMonth, selectedWeek, todayStr]);

  // Consolidated Client Debt Groups (One card per debtor / client)
  const clientDebtGroups = useMemo(() => {
    const map = new Map<string, ClientDebtGroup>();

    activeDebts.forEach(d => {
      const nameKey = (d.debtorName || 'Sin Nombre').trim().toLowerCase();
      const existing = map.get(nameKey);
      const remaining = getDebtRemainingAmount(d);
      const paid = getDebtPaidAmount(d);
      const isPending = d.status === 'pendiente' && remaining > 0.001;

      // Try finding phone in debts or client directory
      let foundPhone = d.clientPhone;
      if (!foundPhone && clients.length > 0) {
        const matchedC = clients.find(c => c.name && c.name.trim().toLowerCase() === nameKey);
        if (matchedC?.phone) foundPhone = matchedC.phone;
      }

      if (!existing) {
        map.set(nameKey, {
          debtorName: d.debtorName || 'Sin Nombre',
          debts: [d],
          totalAmount: d.amount || 0,
          totalRemaining: remaining,
          totalPaid: paid,
          pendingCount: isPending ? 1 : 0,
          paidCount: isPending ? 0 : 1,
          isFullyPaid: !isPending,
          clientPhone: foundPhone,
          earliestDueDate: d.dueDate,
          currency: (d.currency === 'EUR' ? 'EUR' : 'USD')
        });
      } else {
        existing.debts.push(d);
        existing.totalAmount += d.amount || 0;
        existing.totalRemaining += remaining;
        existing.totalPaid += paid;
        if (isPending) {
          existing.pendingCount += 1;
        } else {
          existing.paidCount += 1;
        }
        existing.isFullyPaid = existing.totalRemaining <= 0.001;
        if (!existing.clientPhone && foundPhone) {
          existing.clientPhone = foundPhone;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Prioritize active debts, ordered by highest remaining debt
      if (a.isFullyPaid !== b.isFullyPaid) return a.isFullyPaid ? 1 : -1;
      return b.totalRemaining - a.totalRemaining;
    });
  }, [activeDebts, clients]);

  // Total pending remaining balance in active period
  const totalPendingInTarget = useMemo(() => {
    return activeDebts.reduce((sum, item) => {
      if (item.status === 'pagado') return sum;
      const remaining = getDebtRemainingAmount(item);
      const normalized = getRecordAmountInCurrency(
        { ...item, amount: remaining }, 
        selectedCurrency, 
        rates
      );
      return sum + normalized;
    }, 0);
  }, [activeDebts, selectedCurrency, rates]);

  // Total collected/paid abonos in active period
  const totalPaidInTarget = useMemo(() => {
    return activeDebtsBase.reduce((sum, item) => {
      const payments = item.payments || [];
      if (periodMode === 'todos') {
        const paid = getDebtPaidAmount(item);
        if (paid <= 0) return sum;
        return sum + getRecordAmountInCurrency({ ...item, amount: paid }, selectedCurrency, rates);
      }

      const periodPaid = payments
        .filter(p => isDateInSelectedPeriod(p.date))
        .reduce((pSum, p) => pSum + (p.amount || 0), 0);

      if (periodPaid <= 0) return sum;
      return sum + getRecordAmountInCurrency({ ...item, amount: periodPaid }, selectedCurrency, rates);
    }, 0);
  }, [activeDebtsBase, periodMode, selectedDate, selectedYear, selectedMonth, selectedWeek, selectedCurrency, rates]);

  const pendingMoney = useMemo(() => {
    const symbol = selectedCurrency === 'USD' ? '$' : '€';
    const activeRate = (selectedCurrency === 'USD' ? rates?.bcvUsd : rates?.bcvEur) || (selectedCurrency === 'USD' ? 832.49 : 968.07);
    const amountBs = totalPendingInTarget * activeRate;
    const secondaryAmount = selectedCurrency === 'USD' 
      ? (amountBs / (rates?.bcvEur || 968.07)) 
      : (amountBs / (rates?.bcvUsd || 832.49));
    const secondarySymbol = selectedCurrency === 'USD' ? '€' : '$';

    return {
      primary: `${symbol}${totalPendingInTarget.toFixed(2)}`,
      bolivares: `Bs. ${amountBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      secondary: `${secondarySymbol}${secondaryAmount.toFixed(2)}`
    };
  }, [totalPendingInTarget, selectedCurrency, rates]);

  const paidMoney = useMemo(() => {
    const symbol = selectedCurrency === 'USD' ? '$' : '€';
    const activeRate = (selectedCurrency === 'USD' ? rates?.bcvUsd : rates?.bcvEur) || (selectedCurrency === 'USD' ? 832.49 : 968.07);
    const amountBs = totalPaidInTarget * activeRate;

    return {
      primary: `${symbol}${totalPaidInTarget.toFixed(2)}`,
      bolivares: `Bs. ${amountBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    };
  }, [totalPaidInTarget, selectedCurrency, rates]);

  // Keep live item for single payment modal
  const liveDebtForPayment = useMemo(() => {
    if (!selectedDebtForPayment) return null;
    return debts.find(d => d.id === selectedDebtForPayment.id) || selectedDebtForPayment;
  }, [debts, selectedDebtForPayment]);

  const liveDebtForInvoice = useMemo(() => {
    if (!selectedDebtForInvoice) return null;
    return debts.find(d => d.id === selectedDebtForInvoice.id) || selectedDebtForInvoice;
  }, [debts, selectedDebtForInvoice]);

  // WhatsApp Reminder Link
  const getWhatsAppReminderUrl = (group: ClientDebtGroup) => {
    if (!group.clientPhone) return '#';
    const cleanPhone = group.clientPhone.replace(/\D/g, '');
    const formatted = formatMoney(group.totalRemaining, selectedCurrency, rates);
    const msg = `*${companyName} - Recordatorio de Cuenta*\n\nHola *${group.debtorName}*, un cordial saludo.\nTe escribimos para recordarte tu saldo pendiente consolidado de *${formatted.primaryWithCode}* (Equivalente a *${formatted.bolivares}* a tasa oficial BCV).\n\nAgradecemos tu gentil apoyo para concretar el pago cuando te sea posible. ¡Muchas gracias!`;
    return `https://wa.me/${cleanPhone.startsWith('58') ? cleanPhone : '58' + cleanPhone.replace(/^0+/, '')}?text=${encodeURIComponent(msg)}`;
  };

  // Handle open add debt for a specific client
  const handleOpenAddDebtForClient = (clientName: string, phone?: string) => {
    setAddModalPreselectedName(clientName);
    setAddModalPreselectedPhone(phone || '');
    setShowAddModal(true);
  };

  // Handle submit consolidated payment
  const handleConfirmConsolidatedPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForConsolidatedPayment) return;
    const amt = parseFloat(clientPaymentAmount);
    if (isNaN(amt) || amt <= 0) return;

    const activeRate = selectedCurrency === 'EUR' ? rates.bcvEur : rates.bcvUsd;
    const paymentPayload: Omit<DebtPayment, 'id'> = {
      date: getLocalDateString(),
      amount: amt,
      amountBs: parseFloat((amt * activeRate).toFixed(2)),
      exchangeRateUsed: activeRate,
      currency: selectedCurrency === 'EUR' ? 'EUR' : 'USD',
      paymentMethod: clientPaymentMethod,
      reference: clientPaymentRef.trim() || undefined,
      notes: `Abono de ${clientForConsolidatedPayment.debtorName}`
    };

    if (onApplyClientPayment) {
      onApplyClientPayment(clientForConsolidatedPayment.debtorName, paymentPayload, clientPaymentRegisterIncome);
    } else if (onApplyPayment) {
      // Fallback: apply to oldest pending debt
      const pending = clientForConsolidatedPayment.debts.filter(d => d.status === 'pendiente');
      if (pending.length > 0) {
        onApplyPayment(pending[0].id, paymentPayload, clientPaymentRegisterIncome);
      }
    }

    setClientForConsolidatedPayment(null);
    setClientPaymentAmount('');
    setClientPaymentRef('');
  };

  // Handle marking entire client solvent (all debts paid)
  const handleSettleAllClientDebts = (group: ClientDebtGroup) => {
    if (confirm(`¿Marcar como solventes todas las deudas de "${group.debtorName}"?`)) {
      group.debts.forEach(d => {
        if (d.status === 'pendiente') {
          onToggleDebtPaid(d.id);
        }
      });
    }
  };

  const nf = (v: number) => v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pb-32"
    >
      {/* 1. PERIOD SELECTOR BANNER */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-700">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                Periodo de Control
              </span>
              <p className="text-[10.5px] text-slate-400 font-medium">
                {periodMode === 'todos' ? 'Histórico acumulado total' : `Filtro activo: ${periodMode}`}
              </p>
            </div>
          </div>

          {/* Period selector pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-0.5">
            {(['diario', 'semanal', 'mensual', 'anual', 'todos'] as const).map((mode) => {
              const labels = {
                diario: 'Día',
                semanal: 'Semana',
                mensual: 'Mes',
                anual: 'Año',
                todos: 'Todos'
              };
              const isSelected = periodMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPeriodMode(mode)}
                  className={`px-2 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isSelected ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {labels[mode]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Month/Date selectors if periodMode !== 'todos' */}
        {periodMode === 'mensual' && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-semibold">Mes analizado:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedMonth(prev => prev === 1 ? 12 : prev - 1)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
              >
                ‹
              </button>
              <span className="font-extrabold text-slate-800">
                {MONTH_NAMES_ES[selectedMonth - 1]} {selectedYear}
              </span>
              <button
                type="button"
                onClick={() => setSelectedMonth(prev => prev === 12 ? 1 : prev + 1)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. SUBTABS: "Por cobrar" vs "Por pagar" */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60 relative">
        <button
          type="button"
          onClick={() => setDebtTypeTab('por_cobrar')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer relative z-10 ${
            debtTypeTab === 'por_cobrar' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Por cobrar ({activeDebtsBase.filter(d => d.type === 'por_cobrar').length})
          {debtTypeTab === 'por_cobrar' && (
            <motion.div
              layoutId="debtTabIndicator"
              className="absolute inset-0 bg-white rounded-xl shadow-xs -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 35 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setDebtTypeTab('por_pagar')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer relative z-10 ${
            debtTypeTab === 'por_pagar' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Por pagar ({activeDebtsBase.filter(d => d.type === 'por_pagar').length})
          {debtTypeTab === 'por_pagar' && (
            <motion.div
              layoutId="debtTabIndicator"
              className="absolute inset-0 bg-white rounded-xl shadow-xs -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 35 }}
            />
          )}
        </button>
      </div>

      {/* 3. COMPREHENSIVE SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Card A: Saldo pendiente */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {debtTypeTab === 'por_cobrar' ? 'Saldo pendiente por cobrar' : 'Saldo pendiente por pagar'}
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {periodMode}
            </span>
          </div>
          <div className={`text-2xl sm:text-3xl font-black tracking-tight font-sans ${
            debtTypeTab === 'por_cobrar' ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {pendingMoney.primary}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 font-mono flex items-center gap-2 flex-wrap">
            <span>{pendingMoney.bolivares}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400">Ref: {pendingMoney.secondary}</span>
          </div>
        </div>

        {/* Card B: Lo que se ha cobrado / abonado */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {debtTypeTab === 'por_cobrar' ? 'Lo que se ha cobrado' : 'Lo que se ha abonado'}
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-500" /> Cobrado
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight font-sans text-slate-900">
            {paidMoney.primary}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 font-mono flex items-center gap-2 flex-wrap">
            <span>{paidMoney.bolivares}</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-600 font-bold">Abonos recibidos</span>
          </div>
        </div>
      </div>

      {/* 4. VIEW STYLE SWITCHER: CONSOLIDADA POR CLIENTES VS NOTAS INDIVIDUALES */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2.5 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wide block">
              {viewStyle === 'clientes' ? 'Vista por Clientes (Consolidada)' : 'Vista de Notas Individuales'}
            </span>
            <span className="text-[10px] text-slate-400">
              {viewStyle === 'clientes' 
                ? `${clientDebtGroups.length} cuentas con suma total unificada`
                : `${activeDebts.length} notas de deuda registradas`}
            </span>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewStyle('clientes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewStyle === 'clientes' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Por Clientes</span>
          </button>
          <button
            type="button"
            onClick={() => setViewStyle('notas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewStyle === 'notas' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Notas</span>
          </button>
        </div>
      </div>

      {/* 5. LIST OF DEBTS OR CLIENTS */}
      <div className="space-y-3">
        {activeDebts.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[280px] shadow-xs"
          >
            <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
              <Receipt className="w-10 h-10 text-amber-600" strokeWidth={1.5} />
            </div>

            <h4 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight max-w-sm">
              {debtTypeTab === 'por_cobrar' 
                ? 'No tienes deudas por cobrar en este periodo.' 
                : 'No tienes deudas por pagar pendientes.'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              Registra fiados a clientes con suma consolidada, control de abonos poco a poco y comprobantes por WhatsApp.
            </p>

            <div className="flex items-center gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => {
                  setAddModalPreselectedName('');
                  setAddModalPreselectedPhone('');
                  setShowAddModal(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Registrar deuda</span>
              </button>
            </div>
          </motion.div>
        ) : viewStyle === 'clientes' ? (
          /* ============================================================ */
          /* CONSOLIDATED BY CLIENT (CARTERA CONSOLIDADA POR CLIENTE)     */
          /* ============================================================ */
          clientDebtGroups.map((group) => {
            const hasDebt = group.totalRemaining > 0.001;
            const progressPct = group.totalAmount > 0 
              ? Math.min(100, Math.round((group.totalPaid / group.totalAmount) * 100)) 
              : 0;
            const activeRate = (group.currency === 'EUR' ? rates.bcvEur : rates.bcvUsd) || 832.49;
            const bolivaresTotal = `Bs. ${nf(group.totalRemaining * activeRate)}`;
            const initials = group.debtorName.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'CL';

            return (
              <motion.div
                key={group.debtorName}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white border rounded-2xl p-4 shadow-xs transition-all space-y-3 ${
                  !hasDebt 
                    ? 'border-slate-200/60 bg-slate-50/50 opacity-75' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Client Header: Avatar, Name, Phone, and Suma Total */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 ${
                      hasDebt ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-200' : 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-200'
                    }`}>
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-extrabold text-sm text-slate-900 truncate ${!hasDebt ? 'line-through text-slate-400' : ''}`}>
                          {group.debtorName}
                        </p>
                        
                        {hasDebt ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-200">
                            {group.pendingCount} cuenta{group.pendingCount > 1 ? 's' : ''} pendiente{group.pendingCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Solvente
                          </span>
                        )}

                        {group.totalPaid > 0 && hasDebt && (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Abonado ({progressPct}%)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 font-mono flex-wrap">
                        {group.clientPhone && (
                          <span className="flex items-center gap-1 font-bold text-slate-700">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {group.clientPhone}
                          </span>
                        )}
                        <span>•</span>
                        <span className="text-slate-400">Total acumulado: ${group.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Suma Total de la Deuda */}
                  <div className="text-right shrink-0">
                    <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">
                      Suma total debida
                    </span>
                    <div className={`text-base sm:text-lg font-black font-sans ${
                      !hasDebt ? 'text-slate-400 line-through' : 'text-emerald-600'
                    }`}>
                      ${nf(group.totalRemaining)} USD
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 font-semibold">
                      {bolivaresTotal}
                    </div>
                  </div>
                </div>

                {/* Progress bar of Abonos if partially paid */}
                {group.totalPaid > 0 && hasDebt && (
                  <div className="pt-1 space-y-1">
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 font-semibold">
                      <span>Abonado: ${nf(group.totalPaid)} ({progressPct}%)</span>
                      <span className="text-rose-600 font-bold">Resta: ${nf(group.totalRemaining)}</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons Toolbar: [− Abonar] [+ Sumar Deuda] [Ver Historial] [WhatsApp] */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Botón Abonar (Resta al saldo poco a poco) */}
                    {hasDebt && (
                      <button
                        type="button"
                        onClick={() => {
                          setClientForConsolidatedPayment(group);
                          setClientPaymentAmount(group.totalRemaining.toFixed(2));
                        }}
                        className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="Restar abono a la cuenta de este cliente"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>− Abonar / Cobrar</span>
                      </button>
                    )}

                    {/* Botón Sumar Deuda (Agrega otra deuda a este cliente) */}
                    <button
                      type="button"
                      onClick={() => handleOpenAddDebtForClient(group.debtorName, group.clientPhone)}
                      className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      title="Sumar una nueva compra o fiado a este cliente"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>+ Sumar Deuda</span>
                    </button>

                    {/* Botón Ver Historial y Cuentas (Entrecorta el historial de forma limpia) */}
                    <button
                      type="button"
                      onClick={() => setClientForLedgerView(group)}
                      className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
                      title="Ver notas y cuentas de este cliente"
                    >
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      <span>Ver Cuentas ({group.debts.length})</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Botón WhatsApp Cobro */}
                    {group.clientPhone && hasDebt && (
                      <a
                        href={getWhatsAppReminderUrl(group)}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                        title="Enviar recordatorio por WhatsApp con tasa BCV"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp</span>
                      </a>
                    )}

                    {/* Marcar Solvente */}
                    {hasDebt && (
                      <button
                        type="button"
                        onClick={() => handleSettleAllClientDebts(group)}
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Marcar todas las deudas de este cliente como pagadas"
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          /* ============================================================ */
          /* INDIVIDUAL NOTES VIEW (TODAS LAS NOTAS EN DETALLE)            */
          /* ============================================================ */
          activeDebts.map((item) => {
            const isPaid = item.status === 'pagado';
            const itemCurrency = item.currency || 'USD';
            const itemSymbol = itemCurrency === 'USD' ? '$' : '€';
            const remaining = getDebtRemainingAmount(item);
            const paid = getDebtPaidAmount(item);
            const progressPct = getDebtProgressPercentage(item);
            const hasAbonos = paid > 0;
            const activeRate = item.exchangeRateUsed || (itemCurrency === 'EUR' ? rates.bcvEur : rates.bcvUsd) || 832.49;
            const bolivaresRemaining = `Bs. ${nf(remaining * activeRate)}`;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white border rounded-2xl p-4 shadow-xs transition-all space-y-3 ${
                  isPaid 
                    ? 'border-slate-200/60 opacity-70 bg-slate-50/50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => onToggleDebtPaid(item.id)}
                      className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center transition-all cursor-pointer mt-0.5 ${
                        isPaid 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                      }`}
                      title={isPaid ? 'Reabrir deuda' : 'Marcar como pagada completamente'}
                    >
                      <Check className="w-4 h-4" />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-bold text-xs sm:text-sm text-slate-900 truncate ${isPaid ? 'line-through text-slate-400' : ''}`}>
                          {item.debtorName}
                        </p>
                        <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase ${
                          itemCurrency === 'EUR' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200/60' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        }`}>
                          {itemCurrency}
                        </span>

                        {hasAbonos && !isPaid && (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200/60">
                            Abonado ({progressPct}%)
                          </span>
                        )}

                        {isPaid && (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase bg-emerald-100 text-emerald-800">
                            Solventado
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.description}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-mono flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Vence: {item.dueDate}
                        </span>
                        <span>•</span>
                        <span>Tasa: Bs. {nf(activeRate)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-sm sm:text-base font-black font-sans ${
                      isPaid ? 'text-slate-400 line-through' : 'text-emerald-600'
                    }`}>
                      {isPaid ? '$0.00' : `$${nf(remaining)}`}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 font-semibold">
                      {isPaid ? 'Bs. 0.00' : bolivaresRemaining}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {hasAbonos && !isPaid && (
                  <div className="pt-1 space-y-1">
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 font-semibold">
                      <span>Abonado: {itemSymbol}{nf(paid)} ({progressPct}%)</span>
                      <span className="text-rose-600 font-bold">Resta: {itemSymbol}{nf(remaining)}</span>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedDebtForInvoice(item)}
                      className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200/60"
                      title="Generar factura y enviar por WhatsApp"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>Factura / Cobro</span>
                    </button>

                    {!isPaid && onApplyPayment && (
                      <button
                        type="button"
                        onClick={() => setSelectedDebtForPayment(item)}
                        className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200/60"
                        title="Registrar abono"
                      >
                        <Coins className="w-3.5 h-3.5 text-emerald-600" />
                        <span>+ Abonar</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteDebt(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                    title="Eliminar deuda"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* 6. FLOATING ACTION BUTTONS */}
      <div className="fixed bottom-24 sm:bottom-8 left-0 right-0 max-w-md mx-auto px-4 z-40 pointer-events-none">
        <div className="grid grid-cols-2 gap-3 p-1.5 bg-white/80 backdrop-blur-md rounded-2xl border border-white/80 shadow-2xl shadow-slate-900/15 pointer-events-auto">
          {onOpenSale && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onOpenSale}
              className="py-3 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer border border-emerald-500/80 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>+ Nueva venta</span>
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => {
              setAddModalPreselectedName('');
              setAddModalPreselectedPhone('');
              setShowAddModal(true);
            }}
            className={`py-3 px-3.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer border border-slate-800 whitespace-nowrap ${
              !onOpenSale ? 'col-span-2' : ''
            }`}
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>+ Registrar deuda</span>
          </motion.button>
        </div>
      </div>

      {/* --- MODAL 1: REGISTRAR ABONO A CUENTA CONSOLIDADA DEL CLIENTE --- */}
      {clientForConsolidatedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black uppercase text-slate-900">
                    Abonar a la Cuenta del Cliente
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {clientForConsolidatedPayment.debtorName} • Debe total: ${clientForConsolidatedPayment.totalRemaining.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClientForConsolidatedPayment(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmConsolidatedPayment} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                  Monto a Abonar ($ USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={clientPaymentAmount}
                  onChange={e => setClientPaymentAmount(e.target.value)}
                  className="w-full p-2.5 text-base bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono font-bold outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                  Método de Pago
                </label>
                <select
                  value={clientPaymentMethod}
                  onChange={e => setClientPaymentMethod(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden"
                >
                  <option value="Efectivo USD">Efectivo USD ($)</option>
                  <option value="Pago Móvil">Pago Móvil (Bs.)</option>
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Zelle">Zelle</option>
                  <option value="Punto de Venta">Punto de Venta</option>
                  <option value="Efectivo VES">Efectivo Bolívares</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                  Número de Referencia / Comprobante (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Últimos 4 dígitos o comprobante"
                  value={clientPaymentRef}
                  onChange={e => setClientPaymentRef(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono outline-hidden"
                />
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-950 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={clientPaymentRegisterIncome}
                    onChange={e => setClientPaymentRegisterIncome(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                  />
                  <span>Ingresar este cobro a la caja / balance de hoy</span>
                </label>
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                💡 Este abono se descontará automáticamente de las deudas pendientes de <strong>{clientForConsolidatedPayment.debtorName}</strong> comenzando por la más antigua.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClientForConsolidatedPayment(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all"
                >
                  Aplicar Abono
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* --- MODAL 2: HISTORIAL Y CUENTAS DETALLADAS DEL CLIENTE ("ENTRECORTAR EL HISTORIAL") --- */}
      {clientForLedgerView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>Historial de Cuentas: {clientForLedgerView.debtorName}</span>
                </h4>
                <p className="text-[10.5px] text-slate-400">
                  Total pendiente: ${clientForLedgerView.totalRemaining.toFixed(2)} USD • {clientForLedgerView.debts.length} nota{clientForLedgerView.debts.length > 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClientForLedgerView(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {clientForLedgerView.debts.map(item => {
                const rem = getDebtRemainingAmount(item);
                const isPaid = item.status === 'pagado' || rem <= 0.001;

                return (
                  <div 
                    key={item.id} 
                    className={`p-3 rounded-xl border text-xs space-y-2 ${
                      isPaid ? 'bg-slate-50 border-slate-200/60 opacity-80' : 'bg-white border-amber-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-extrabold text-slate-900">{item.description}</p>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          Vence: {item.dueDate || 'Sin fecha'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-slate-900 font-mono block">
                          ${(item.amount || 0).toFixed(2)}
                        </span>
                        <span className={`text-[10px] font-bold ${isPaid ? 'text-emerald-600' : 'text-amber-700'}`}>
                          {isPaid ? '✓ Liquidado' : `Resta: $${rem.toFixed(2)}`}
                        </span>
                      </div>
                    </div>

                    {/* Payments */}
                    {item.payments && item.payments.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-100 space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide block">
                          Abonos registrados:
                        </span>
                        {item.payments.map(p => (
                          <div key={p.id} className="text-[10.5px] text-slate-600 flex justify-between">
                            <span>• {p.date}: {p.paymentMethod} {p.reference ? `(Ref: ${p.reference})` : ''}</span>
                            <span className="font-bold text-emerald-700">+${p.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-1 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setClientForLedgerView(null);
                          setSelectedDebtForInvoice(item);
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
                      >
                        Ver factura individual
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setClientForLedgerView(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: Registrar nueva deuda */}
      <DebtFlowModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={onAddDebt}
        rates={rates}
        initialCurrency={selectedCurrency as 'USD' | 'EUR'}
        initialType={debtTypeTab}
        currentUserEmail={userEmail}
        preselectedDebtorName={addModalPreselectedName}
        preselectedClientPhone={addModalPreselectedPhone}
        existingDebts={debts}
      />

      {/* MODAL: Registrar Abono individual */}
      {onApplyPayment && (
        <AddDebtPaymentModal
          isOpen={!!selectedDebtForPayment}
          debt={liveDebtForPayment}
          onClose={() => setSelectedDebtForPayment(null)}
          onSavePayment={onApplyPayment}
          rates={rates}
        />
      )}

      {/* MODAL: Factura y Cobro por WhatsApp / PDF */}
      <DebtInvoiceModal
        isOpen={!!selectedDebtForInvoice}
        debt={liveDebtForInvoice}
        onClose={() => setSelectedDebtForInvoice(null)}
        rates={rates}
        companyName={companyName}
        onOpenAddPayment={(debt) => {
          setSelectedDebtForInvoice(null);
          setSelectedDebtForPayment(debt);
        }}
        onUpdateDebt={onUpdateDebt}
      />
    </motion.div>
  );
}
