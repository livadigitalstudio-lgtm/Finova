import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, DollarSign, CheckCircle2, Calendar, CreditCard, 
  FileText, ArrowRight, ShieldCheck, Sparkles, Hash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DebtItem, DebtPayment, ExchangeRates } from '../types';
import { getDebtRemainingAmount, getDebtPaidAmount } from '../utils/debtUtils';
import { getLocalDateString } from '../utils/dateUtils';

export interface AddDebtPaymentModalProps {
  isOpen: boolean;
  debt: DebtItem | null;
  onClose: () => void;
  onSavePayment: (
    debtId: string, 
    payment: Omit<DebtPayment, 'id'>, 
    registerAsIncome: boolean
  ) => void;
  rates: ExchangeRates;
}

export default function AddDebtPaymentModal({
  isOpen,
  debt,
  onClose,
  onSavePayment,
  rates
}: AddDebtPaymentModalProps) {
  if (!isOpen || !debt) return null;

  const debtCurrency = debt.currency || 'USD';
  const symbol = debtCurrency === 'USD' ? '$' : '€';
  const defaultRate = debtCurrency === 'USD' 
    ? (rates?.bcvUsd || 832.49) 
    : (rates?.bcvEur || 968.07);

  const remainingBalance = useMemo(() => getDebtRemainingAmount(debt), [debt]);
  const totalPaidSoFar = useMemo(() => getDebtPaidAmount(debt), [debt]);

  // Form State
  const [inputMode, setInputMode] = useState<'currency' | 'bs'>('currency');
  const [amountInput, setAmountInput] = useState('');
  const [amountBsInput, setAmountBsInput] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number>(debt.exchangeRateUsed || defaultRate);
  const [rateSource, setRateSource] = useState<'bcv' | 'paralelo' | 'custom'>('bcv');
  const [paymentMethod, setPaymentMethod] = useState<string>('Pago Móvil');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(getLocalDateString());
  const [registerInCashflow, setRegisterInCashflow] = useState(true);
  const [error, setError] = useState('');

  // Reset or prefill when modal opens
  useEffect(() => {
    if (isOpen && debt) {
      const initialRemaining = getDebtRemainingAmount(debt);
      setAmountInput(initialRemaining.toFixed(2));
      const r = debt.exchangeRateUsed || defaultRate;
      setExchangeRate(r);
      setAmountBsInput((initialRemaining * r).toFixed(2));
      setInputMode('currency');
      setReference('');
      setNotes('');
      setPaymentDate(getLocalDateString());
      setRegisterInCashflow(true);
      setError('');
    }
  }, [isOpen, debt, defaultRate]);

  // Handle rate source changes
  const handleRateSourceChange = (src: 'bcv' | 'paralelo' | 'custom') => {
    setRateSource(src);
    let newRate = defaultRate;
    if (src === 'bcv') {
      newRate = debtCurrency === 'USD' ? (rates?.bcvUsd || 832.49) : (rates?.bcvEur || 968.07);
    } else if (src === 'paralelo') {
      newRate = rates?.paraleloUsd || (rates?.bcvUsd ? rates.bcvUsd * 1.15 : 957.36);
    }
    setExchangeRate(newRate);
    if (amountInput) {
      const num = parseFloat(amountInput);
      if (!isNaN(num)) {
        setAmountBsInput((num * newRate).toFixed(2));
      }
    }
  };

  // Convert inputs
  const handleAmountChange = (val: string) => {
    setAmountInput(val);
    setError('');
    const num = parseFloat(val);
    if (!isNaN(num) && exchangeRate > 0) {
      setAmountBsInput((num * exchangeRate).toFixed(2));
    } else {
      setAmountBsInput('');
    }
  };

  const handleAmountBsChange = (val: string) => {
    setAmountBsInput(val);
    setError('');
    const numBs = parseFloat(val);
    if (!isNaN(numBs) && exchangeRate > 0) {
      setAmountInput((numBs / exchangeRate).toFixed(2));
    } else {
      setAmountInput('');
    }
  };

  const handleQuickPercent = (pct: number) => {
    const val = Number(((remainingBalance * pct) / 100).toFixed(2));
    setAmountInput(val.toString());
    setAmountBsInput((val * exchangeRate).toFixed(2));
    setError('');
  };

  const numericAmount = parseFloat(amountInput) || 0;
  const numericAmountBs = parseFloat(amountBsInput) || (numericAmount * exchangeRate);

  const nf = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const remainingAfterPayment = Math.max(0, Number((remainingBalance - numericAmount).toFixed(2)));
  const willBeFullyPaid = remainingAfterPayment <= 0.001;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      setError('Por favor ingresa un monto válido mayor a 0.');
      return;
    }
    if (numericAmount > remainingBalance + 0.01) {
      setError(`El monto no puede superar el saldo pendiente de ${symbol}${nf(remainingBalance)}.`);
      return;
    }

    onSavePayment(
      debt.id,
      {
        date: paymentDate || getLocalDateString(),
        amount: numericAmount,
        amountBs: Number(numericAmountBs.toFixed(2)),
        exchangeRateUsed: exchangeRate,
        currency: debtCurrency,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined
      },
      registerInCashflow
    );
    onClose();
  };

  const paymentMethods = [
    'Pago Móvil',
    'Efectivo Divisas',
    'Transferencia Bancaria',
    'Zelle',
    'Punto de Venta',
    'Efectivo Bolívares'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-lg overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
              Registrar Abono
            </span>
            <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
              Abono de {debt.debtorName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Debt Current Status Card */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Deuda Original:</span>
              <span className="font-bold text-slate-800 font-mono">
                {symbol}{nf(debt.amount)} {debtCurrency}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Total Abonado Anteriormente:</span>
              <span className="font-bold text-emerald-600 font-mono">
                +{symbol}{nf(totalPaidSoFar)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase text-slate-400 block tracking-wide">
                  Saldo Pendiente Actual
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Bs. {nf(remainingBalance * exchangeRate)}
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-black text-rose-600 font-mono">
                {symbol}{nf(remainingBalance)}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Quick Chips for Abono percentage */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Atajo:</span>
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleQuickPercent(pct)}
                  className="px-2.5 py-1 text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors"
                >
                  {pct === 100 ? `100% (Todo: ${symbol}${nf(remainingBalance)})` : `${pct}%`}
                </button>
              ))}
            </div>

            {/* Amount inputs ($ / Bs) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Monto a Abonar
                </label>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() => setInputMode('currency')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                      inputMode === 'currency' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    En {debtCurrency} ({symbol})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('bs')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                      inputMode === 'bs' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    En Bolívares (Bs.)
                  </button>
                </div>
              </div>

              {inputMode === 'currency' ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                    {symbol}
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={amountInput}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 font-mono focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                    ≈ Bs. {amountBsInput ? nf(numericAmountBs) : '0.00'}
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                    Bs.
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={amountBsInput}
                    onChange={(e) => handleAmountBsChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-12 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 font-mono focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                    ≈ {symbol}{amountInput ? nf(numericAmount) : '0.00'} {debtCurrency}
                  </div>
                </div>
              )}
            </div>

            {/* Exchange Rate Selector */}
            <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-200/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Tasa de Cambio Aplicada</span>
                <span className="font-mono font-bold text-slate-800">Bs. {nf(exchangeRate)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleRateSourceChange('bcv')}
                  className={`py-1.5 px-2 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                    rateSource === 'bcv' 
                      ? 'bg-white border-emerald-500 text-emerald-700 shadow-xs' 
                      : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  BCV Oficial
                </button>
                <button
                  type="button"
                  onClick={() => handleRateSourceChange('paralelo')}
                  className={`py-1.5 px-2 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                    rateSource === 'paralelo' 
                      ? 'bg-white border-emerald-500 text-emerald-700 shadow-xs' 
                      : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Paralelo
                </button>
                <button
                  type="button"
                  onClick={() => handleRateSourceChange('custom')}
                  className={`py-1.5 px-2 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                    rateSource === 'custom' 
                      ? 'bg-white border-emerald-500 text-emerald-700 shadow-xs' 
                      : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Personalizada
                </button>
              </div>

              {rateSource === 'custom' && (
                <div className="pt-1">
                  <input
                    type="number"
                    step="any"
                    value={exchangeRate}
                    onChange={(e) => {
                      const r = parseFloat(e.target.value) || 0;
                      setExchangeRate(r);
                      if (amountInput) {
                        setAmountBsInput((numericAmount * r).toFixed(2));
                      }
                    }}
                    placeholder="Tasa en Bs..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Método de Pago
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {paymentMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left truncate ${
                      paymentMethod === m
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference and Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  N° de Referencia / Comprobante
                </label>
                <div className="relative">
                  <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ej: 4892 o Zelle Pedro"
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-emerald-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Fecha del Abono
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-emerald-500 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Observación o Nota (Opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Pago de cuota quincenal..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-emerald-500 outline-hidden"
              />
            </div>

            {/* Cashflow integration checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 cursor-pointer">
              <input
                type="checkbox"
                checked={registerInCashflow}
                onChange={(e) => setRegisterInCashflow(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-slate-700">
                <strong className="font-bold text-emerald-900 block">
                  {debt.type === 'por_cobrar' ? 'Registrar como Ingreso en Finanzas' : 'Registrar como Egreso en Finanzas'}
                </strong>
                Suma automáticamente el abono a tu flujo de caja real y reportes financieros.
              </span>
            </label>

            {/* Remaining balance preview */}
            <div className="p-3 bg-slate-100/70 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">
                {willBeFullyPaid ? '¡La deuda quedará pagada!' : 'Saldo restante tras este abono:'}
              </span>
              <span className={`font-black font-mono ${willBeFullyPaid ? 'text-emerald-700' : 'text-slate-800'}`}>
                {willBeFullyPaid ? 'Solventado ($0.00)' : `${symbol}${nf(remainingAfterPayment)} (${debtCurrency})`}
              </span>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={numericAmount <= 0}
                className="flex-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Registrar Abono ({symbol}{nf(numericAmount)})</span>
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
