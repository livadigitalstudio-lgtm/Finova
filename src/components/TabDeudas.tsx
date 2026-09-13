import React, { useState, useMemo } from 'react';
import { 
  CheckCircle, PlusCircle, Trash2, Calendar, 
  User, Check, AlertCircle, Sparkles, Receipt,
  Ban, Plus, Camera, DollarSign, X, FileText,
  Share2, Coins, ArrowRight, Clock, Percent
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DebtItem, DebtPayment, ExchangeRates } from '../types';
import { formatMoney, CurrencyCode, getRecordAmountInCurrency } from '../utils/currency';
import { 
  getDebtRemainingAmount, 
  getDebtPaidAmount, 
  getDebtProgressPercentage 
} from '../utils/debtUtils';
import DebtFlowModal from './DebtFlowModal';
import AddDebtPaymentModal from './AddDebtPaymentModal';
import DebtInvoiceModal from './DebtInvoiceModal';

interface TabDeudasProps {
  debts: DebtItem[];
  onAddDebt: (debt: Omit<DebtItem, 'id' | 'dateCreated'>) => void;
  onDeleteDebt: (id: string) => void;
  onToggleDebtPaid: (id: string) => void;
  onApplyPayment?: (debtId: string, payment: Omit<DebtPayment, 'id'>, registerAsIncome: boolean) => void;
  onUpdateDebt?: (debtId: string, updates: Partial<DebtItem>) => void;
  rates: ExchangeRates;
  onOpenSale?: () => void;
  selectedCurrency?: CurrencyCode;
  userEmail?: string;
  companyName?: string;
}

export default function TabDeudas({
  debts,
  onAddDebt,
  onDeleteDebt,
  onToggleDebtPaid,
  onApplyPayment,
  onUpdateDebt,
  rates,
  onOpenSale,
  selectedCurrency = 'USD',
  userEmail,
  companyName = 'Finova Comercio'
}: TabDeudasProps) {
  const [debtTypeTab, setDebtTypeTab] = useState<'por_cobrar' | 'por_pagar'>('por_cobrar');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<DebtItem | null>(null);
  const [selectedDebtForInvoice, setSelectedDebtForInvoice] = useState<DebtItem | null>(null);

  // Filter debts matching active sub tab
  const activeDebts = useMemo(() => {
    return debts.filter(d => d.type === debtTypeTab);
  }, [debts, debtTypeTab]);
  
  // Total pending remaining balance normalized to selected currency
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

  // Total collected/paid abonos in active tab
  const totalPaidInTarget = useMemo(() => {
    return activeDebts.reduce((sum, item) => {
      const paid = getDebtPaidAmount(item);
      if (paid <= 0) return sum;
      const normalized = getRecordAmountInCurrency(
        { ...item, amount: paid }, 
        selectedCurrency, 
        rates
      );
      return sum + normalized;
    }, 0);
  }, [activeDebts, selectedCurrency, rates]);

  const pendingMoney = useMemo(() => {
    const symbol = selectedCurrency === 'USD' ? '$' : '€';
    const activeRate = (selectedCurrency === 'USD' ? rates?.bcvUsd : rates?.bcvEur) || (selectedCurrency === 'USD' ? 832.49 : 968.07);
    const amountInBs = totalPendingInTarget * activeRate;
    const otherRate = (selectedCurrency === 'USD' ? rates?.bcvEur : rates?.bcvUsd) || (selectedCurrency === 'USD' ? 968.07 : 832.49);
    const secondaryVal = otherRate > 0 ? (amountInBs / otherRate) : 0;
    const otherSymbol = selectedCurrency === 'USD' ? '€' : '$';

    const nf = (v: number) => v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return {
      primary: `${symbol}${nf(totalPendingInTarget)}`,
      bolivares: `Bs. ${nf(amountInBs)}`,
      secondary: `${otherSymbol}${nf(secondaryVal)} ${selectedCurrency === 'USD' ? 'EUR' : 'USD'}`
    };
  }, [totalPendingInTarget, selectedCurrency, rates]);

  // Keep modal debt in sync if debts list changes
  const liveDebtForInvoice = useMemo(() => {
    if (!selectedDebtForInvoice) return null;
    return debts.find(d => d.id === selectedDebtForInvoice.id) || selectedDebtForInvoice;
  }, [debts, selectedDebtForInvoice]);

  const liveDebtForPayment = useMemo(() => {
    if (!selectedDebtForPayment) return null;
    return debts.find(d => d.id === selectedDebtForPayment.id) || selectedDebtForPayment;
  }, [debts, selectedDebtForPayment]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 max-w-5xl mx-auto pb-36 sm:pb-28"
    >
      {/* 1. DEBT SUBTABS: "Por cobrar" | "Por pagar" */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60 relative">
        <button
          type="button"
          onClick={() => setDebtTypeTab('por_cobrar')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer relative z-10 ${
            debtTypeTab === 'por_cobrar' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Por cobrar ({debts.filter(d => d.type === 'por_cobrar').length})
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
          Por pagar ({debts.filter(d => d.type === 'por_pagar').length})
          {debtTypeTab === 'por_pagar' && (
            <motion.div
              layoutId="debtTabIndicator"
              className="absolute inset-0 bg-white rounded-xl shadow-xs -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 35 }}
            />
          )}
        </button>
      </div>

      {/* 2. SUMMARY CARD: "Total por cobrar / por pagar" */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {debtTypeTab === 'por_cobrar' ? 'Saldo pendiente por cobrar' : 'Saldo pendiente por pagar'}
            </span>
            <div className={`text-3xl sm:text-4xl font-black tracking-tight font-sans mt-0.5 ${
              debtTypeTab === 'por_cobrar' ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {pendingMoney.primary}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{pendingMoney.bolivares}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-400">Ref: {pendingMoney.secondary}</span>
            </div>
          </div>

          {totalPaidInTarget > 0 && (
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {debtTypeTab === 'por_cobrar' ? 'Total Cobrado' : 'Total Abonado'}
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100 inline-block mt-1">
                {selectedCurrency === 'USD' ? '$' : '€'}
                {totalPaidInTarget.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. LIST OF DEBTS OR EMPTY STATE */}
      <div className="space-y-3">
        {activeDebts.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[300px] shadow-xs"
          >
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4 relative shadow-xs">
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 shadow-xs">
                <Ban className="w-3.5 h-3.5" />
              </div>
              <Receipt className="w-12 h-12 sm:w-14 sm:h-14 text-amber-600" strokeWidth={1.5} />
            </div>

            <h4 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight max-w-sm">
              {debtTypeTab === 'por_cobrar' 
                ? 'No tienes deudas por cobrar. Créalas en "Nueva venta" o "Registrar deuda".'
                : 'No tienes deudas por pagar pendientes.'}
            </h4>
            <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
              Registra pagos a plazos (abonos), envía facturas y comprobantes a clientes por WhatsApp con cálculo en divisas y tasa BCV oficial.
            </p>

            <div className="flex items-center gap-2.5 mt-5">
              {onOpenSale && debtTypeTab === 'por_cobrar' && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={onOpenSale}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Nueva venta</span>
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Registrar deuda</span>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          activeDebts.map((item) => {
            const isPaid = item.status === 'pagado';
            const itemCurrency = item.currency || 'USD';
            const itemSymbol = itemCurrency === 'USD' ? '$' : '€';
            const remaining = getDebtRemainingAmount(item);
            const paid = getDebtPaidAmount(item);
            const progressPct = getDebtProgressPercentage(item);
            const hasAbonos = paid > 0;

            const convertedRemaining = getRecordAmountInCurrency(
              { ...item, amount: remaining }, 
              selectedCurrency, 
              rates
            );
            const displaySymbol = selectedCurrency === 'USD' ? '$' : '€';
            const nf = (v: number) => v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
                {/* Top Row: Debtor Name, Currency, Status, and Amount */}
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

                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.description}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-mono flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Vence: {item.dueDate}
                        </span>
                        <span>•</span>
                        <span>Tasa: Bs. {nf(activeRate)}</span>
                        {item.clientPhone && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-600 font-bold">WhatsApp guardado</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amount Column */}
                  <div className="text-right shrink-0">
                    <div className={`text-sm sm:text-base font-black font-sans ${
                      isPaid 
                        ? 'text-slate-400 line-through' 
                        : debtTypeTab === 'por_cobrar' 
                        ? 'text-emerald-600' 
                        : 'text-rose-600'
                    }`}>
                      {isPaid ? `${displaySymbol}0.00` : `${displaySymbol}${nf(convertedRemaining)}`}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 font-semibold">
                      {isPaid ? 'Bs. 0.00' : bolivaresRemaining}
                    </div>
                    {hasAbonos && (
                      <div className="text-[9.5px] font-mono text-slate-400">
                        Deuda inicial: {itemSymbol}{nf(item.amount)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar of Abonos if partially paid */}
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

                {/* Action Buttons Row: [Abonar] [Mandar Factura] [Eliminar] */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Botón Factura / Enviar a Cliente */}
                    <button
                      type="button"
                      onClick={() => setSelectedDebtForInvoice(item)}
                      className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200/60"
                      title="Generar factura y enviar por WhatsApp"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>Factura / Cobro</span>
                    </button>

                    {/* Botón Abonar */}
                    {!isPaid && onApplyPayment && (
                      <button
                        type="button"
                        onClick={() => setSelectedDebtForPayment(item)}
                        className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200/60"
                        title="Registrar abono de cliente"
                      >
                        <Coins className="w-3.5 h-3.5 text-emerald-600" />
                        <span>+ Abonar</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDeleteDebt(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                      title="Eliminar deuda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* 4. FLOATING ACTION BUTTONS */}
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
            onClick={() => setShowAddModal(true)}
            className={`py-3 px-3.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer border border-slate-800 whitespace-nowrap ${
              !onOpenSale ? 'col-span-2' : ''
            }`}
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>+ Registrar deuda</span>
          </motion.button>
        </div>
      </div>

      {/* MODAL: Registrar nueva deuda */}
      <DebtFlowModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={onAddDebt}
        rates={rates}
        initialCurrency={selectedCurrency as 'USD' | 'EUR'}
        initialType={debtTypeTab}
        currentUserEmail={userEmail}
      />

      {/* MODAL: Registrar Abono */}
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
