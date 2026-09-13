import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, Calendar, X, Plus, Check, Search, AlertCircle, 
  Banknote, ArrowDownLeft, ArrowUpRight, User, Truck, Clock, 
  ChevronRight, Sparkles, PlusCircle, Phone
} from 'lucide-react';
import { DebtItem, ExchangeRates } from '../types';
import { getLocalDateString } from '../utils/dateUtils';
import { storageService } from '../services/storageService';

export interface DebtFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (debt: Omit<DebtItem, 'id' | 'dateCreated'>) => void;
  rates: ExchangeRates;
  initialCurrency?: 'USD' | 'EUR';
  initialType?: 'por_cobrar' | 'por_pagar';
  currentUserEmail?: string;
}

interface QuickContact {
  id: string;
  name: string;
  phone?: string;
}

export default function DebtFlowModal({
  isOpen,
  onClose,
  onSubmit,
  rates,
  initialCurrency = 'USD',
  initialType = 'por_cobrar',
  currentUserEmail
}: DebtFlowModalProps) {
  // 1. Debt Type (Por cobrar vs Por pagar)
  const [debtType, setDebtType] = useState<'por_cobrar' | 'por_pagar'>(initialType);

  // 2. Currency & Rate state
  const [currency, setCurrency] = useState<'USD' | 'EUR'>(initialCurrency);
  const [rateType, setRateType] = useState<'bcv' | 'paralelo' | 'custom'>('bcv');
  const [customRateInput, setCustomRateInput] = useState('');

  // 3. Form fields
  const [amountStr, setAmountStr] = useState('');
  const [personName, setPersonName] = useState('');
  const [concept, setConcept] = useState('');
  const [registrationDate, setRegistrationDate] = useState(getLocalDateString());
  const [isEditingRegDate, setIsEditingRegDate] = useState(false);
  const [dueDate, setDueDate] = useState(() => {
    return getLocalDateString(new Date(Date.now() + 7 * 24 * 3600 * 1000));
  });
  const [hasInteractedWithAmount, setHasInteractedWithAmount] = useState(false);

  // 4. Contact selectors (Clients / Suppliers)
  const [clientsList, setClientsList] = useState<QuickContact[]>([]);
  const [suppliersList, setSuppliersList] = useState<QuickContact[]>([]);
  const [isContactSheetOpen, setIsContactSheetOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [newContactInput, setNewContactInput] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientIdNumber, setClientIdNumber] = useState('');

  // Exchange rate definitions
  const officialRateUSD = rates?.bcvUsd && rates.bcvUsd > 0 ? rates.bcvUsd : 832.49;
  const officialRateEUR = rates?.bcvEur && rates.bcvEur > 0 ? rates.bcvEur : 968.07;
  const paraleloRateUSD = rates?.paraleloUsd && rates.paraleloUsd > 0 
    ? rates.paraleloUsd 
    : parseFloat((officialRateUSD * 1.15).toFixed(2));

  // Active rate calculation
  const activeRate = useMemo(() => {
    if (rateType === 'custom') {
      const parsed = parseFloat(customRateInput.replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (currency === 'EUR') {
      return officialRateEUR;
    }
    if (rateType === 'paralelo') {
      return paraleloRateUSD;
    }
    return officialRateUSD;
  }, [currency, rateType, customRateInput, officialRateEUR, officialRateUSD, paraleloRateUSD]);

  // Load clients & suppliers lists
  useEffect(() => {
    try {
      const cKey = `gt_clients_${currentUserEmail || 'guest'}`;
      const cachedClients = localStorage.getItem(cKey);
      if (cachedClients) {
        const parsed = JSON.parse(cachedClients);
        if (Array.isArray(parsed)) setClientsList(parsed);
      }

      const sKey = `gt_suppliers_${currentUserEmail || 'guest'}`;
      const cachedSuppliers = storageService.getSync<QuickContact[]>(sKey, []);
      if (Array.isArray(cachedSuppliers) && cachedSuppliers.length > 0) {
        setSuppliersList(cachedSuppliers);
      }
      storageService.get<QuickContact[]>(sKey, []).then(list => {
        if (Array.isArray(list) && list.length > 0) setSuppliersList(list);
      });
    } catch (e) {
      console.warn('Error loading contacts in DebtFlowModal', e);
    }
  }, [currentUserEmail, isOpen]);

  // Reset state upon opening
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setDebtType(initialType);
      setCurrency(initialCurrency);
      setRateType('bcv');
      setCustomRateInput('');
      setAmountStr('');
      setPersonName('');
      setConcept('');
      setRegistrationDate(getLocalDateString());
      setIsEditingRegDate(false);
      setDueDate(getLocalDateString(new Date(Date.now() + 7 * 24 * 3600 * 1000)));
      setHasInteractedWithAmount(false);
      setIsContactSheetOpen(false);
      setContactSearch('');
      setNewContactInput('');
      setClientPhone('');
      setClientIdNumber('');
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, initialCurrency, initialType]);

  // Calculations
  const numericAmount = parseFloat(amountStr.replace(',', '.')) || 0;
  const isAmountInvalid = hasInteractedWithAmount && numericAmount <= 0;
  const amountInBs = numericAmount * activeRate;
  const secondaryEquivalent = currency === 'USD' 
    ? (amountInBs / officialRateEUR) 
    : (amountInBs / officialRateUSD);

  // Quick preset days for due date
  const setDueDateInDays = (days: number) => {
    const d = new Date(Date.now() + days * 24 * 3600 * 1000);
    setDueDate(getLocalDateString(d));
  };

  // Contact quick-add
  const handleAddNewContact = () => {
    if (!newContactInput.trim()) return;
    const newName = newContactInput.trim();
    const newContact: QuickContact = {
      id: `contact-${Date.now()}`,
      name: newName
    };

    if (debtType === 'por_cobrar') {
      const updated = [newContact, ...clientsList];
      setClientsList(updated);
      try {
        localStorage.setItem(`gt_clients_${currentUserEmail || 'guest'}`, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed saving client', e);
      }
    } else {
      const updated = [newContact, ...suppliersList];
      setSuppliersList(updated);
      storageService.set(`gt_suppliers_${currentUserEmail || 'guest'}`, updated);
    }

    setPersonName(newName);
    setIsContactSheetOpen(false);
    setNewContactInput('');
  };

  // Submit Handler
  const handleSaveDebt = () => {
    setHasInteractedWithAmount(true);
    if (numericAmount <= 0) return;
    if (!personName.trim()) {
      setIsContactSheetOpen(true);
      return;
    }

    const calculatedDueDate = dueDate || getLocalDateString(new Date(Date.now() + 7 * 24 * 3600 * 1000));
    const effectiveConcept = concept.trim() || (
      debtType === 'por_cobrar'
        ? `Cuenta por cobrar a ${personName.trim()}`
        : `Cuenta por pagar a ${personName.trim()}`
    );

    onSubmit({
      type: debtType,
      debtorName: personName.trim(),
      clientPhone: clientPhone.trim() || undefined,
      clientIdNumber: clientIdNumber.trim() || undefined,
      amount: numericAmount,
      amountBs: Number(amountInBs.toFixed(2)),
      exchangeRateUsed: activeRate,
      currency: currency,
      dueDate: calculatedDueDate,
      status: 'pendiente',
      description: effectiveConcept
    });

    onClose();
  };

  if (!isOpen) return null;

  // Filter contacts for sheet
  const activeContactList = debtType === 'por_cobrar' ? clientsList : suppliersList;
  const filteredContacts = activeContactList.filter(c => 
    c.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-xs sm:items-center sm:justify-center sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-[#F8F9FA] min-h-screen sm:min-h-0 sm:max-h-[92vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* TOP AMBER HEADER */}
        <div className="bg-amber-400 px-4 py-3.5 flex items-center justify-between text-slate-950 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-amber-500/30 rounded-xl transition-colors text-slate-950 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <h2 className="text-base font-black tracking-tight text-slate-950">
              Registrar deuda
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-amber-500/30 rounded-full transition-colors text-slate-950 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. SEGMENTED SWITCH: Por cobrar vs Por pagar */}
        <div className="p-3 pb-0">
          <div className="flex bg-slate-200/80 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setDebtType('por_cobrar');
                setPersonName('');
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                debtType === 'por_cobrar'
                  ? 'bg-[#0D7A5F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Por cobrar (Cliente)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDebtType('por_pagar');
                setPersonName('');
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                debtType === 'por_pagar'
                  ? 'bg-[#7B1113] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Por pagar (Proveedor)</span>
            </button>
          </div>
        </div>

        {/* 2. INFORMATIVE NOTICE BANNER */}
        <div className="px-3 pt-2">
          <div className={`p-3 rounded-2xl flex items-start gap-2.5 text-xs border ${
            debtType === 'por_cobrar'
              ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-950'
              : 'bg-rose-50/80 border-rose-200/80 text-rose-950'
          }`}>
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
              debtType === 'por_cobrar' ? 'text-emerald-700' : 'text-rose-700'
            }`} />
            <p className="leading-snug">
              {debtType === 'por_cobrar'
                ? 'Registra fiados o cuentas por cobrar a clientes. Permite llevar el control del saldo pendiente y conversión cambiaria a Bolívares.'
                : 'Registra facturas pendientes, préstamos o pagos a proveedores con fecha límite y tasa de cambio adaptada.'}
            </p>
          </div>
        </div>

        {/* MAIN SCROLLABLE FORM CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* 3. FECHA DE REGISTRO */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>Fecha del registro</span>
              </label>
              <span className="text-[11px] font-mono font-bold text-slate-500">
                {registrationDate}
              </span>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setRegistrationDate(getLocalDateString());
                  setIsEditingRegDate(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  registrationDate === getLocalDateString() && !isEditingRegDate
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={() => {
                  const y = new Date();
                  y.setDate(y.getDate() - 1);
                  setRegistrationDate(getLocalDateString(y));
                  setIsEditingRegDate(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  registrationDate === getLocalDateString(new Date(Date.now() - 86400000)) && !isEditingRegDate
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ayer
              </button>

              <button
                type="button"
                onClick={() => setIsEditingRegDate(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isEditingRegDate
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Otra fecha
              </button>
            </div>

            {isEditingRegDate && (
              <div className="pt-2">
                <input
                  type="date"
                  value={registrationDate}
                  onChange={(e) => setRegistrationDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                />
              </div>
            )}
          </div>

          {/* 4. MONEDA Y TASA DE CAMBIO DE LA DEUDA */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Banknote className={`w-4 h-4 ${debtType === 'por_cobrar' ? 'text-emerald-600' : 'text-rose-600'}`} />
                <span>Moneda de la deuda</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <span className="text-[11px] font-bold text-slate-500">
                {currency === 'USD' ? 'Dólares ($ USD)' : 'Euros (€ EUR)'}
              </span>
            </div>

            {/* Tactile Currency Pills ($ vs €) */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setCurrency('USD');
                  if (rateType === 'custom' && !customRateInput) {
                    setRateType('bcv');
                  }
                }}
                className={`py-2 px-3 rounded-lg font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                  $
                </span>
                <span>Dólar ($ USD)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrency('EUR');
                  if (rateType === 'paralelo') {
                    setRateType('bcv');
                  }
                }}
                className={`py-2 px-3 rounded-lg font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  currency === 'EUR'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center font-black text-xs">
                  €
                </span>
                <span>Euro (€ EUR)</span>
              </button>
            </div>

            {/* Exchange Rate selection options */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">
                  Tasa de cambio acordada:
                </span>
                <span className="text-[11px] font-mono font-black text-emerald-700">
                  1 {currency === 'USD' ? '$' : '€'} = Bs. {activeRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Rate buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setRateType('bcv')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    rateType === 'bcv'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                  }`}
                >
                  Tasa BCV ({currency === 'USD' ? officialRateUSD.toFixed(2) : officialRateEUR.toFixed(2)})
                </button>

                {currency === 'USD' && (
                  <button
                    type="button"
                    onClick={() => setRateType('paralelo')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      rateType === 'paralelo'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                    }`}
                  >
                    Tasa Paralelo ({paraleloRateUSD.toFixed(2)})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setRateType('custom');
                    if (!customRateInput) {
                      setCustomRateInput(activeRate.toString());
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    rateType === 'custom'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                  }`}
                >
                  Personalizada {rateType === 'custom' && customRateInput ? `(${customRateInput})` : ''}
                </button>
              </div>

              {/* Custom rate input field */}
              {rateType === 'custom' && (
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Bs. por cada {currency === 'USD' ? '$' : '€'}:</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej. 650.00"
                    value={customRateInput}
                    onChange={(e) => setCustomRateInput(e.target.value)}
                    className="w-32 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 5. VALOR / MONTO DE LA DEUDA */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Monto pendiente ({currency === 'USD' ? '$ USD' : '€ EUR'}) <span className="text-rose-500 font-bold">*</span>
              </label>
              {isAmountInvalid && (
                <span className="text-xs font-semibold text-rose-600 animate-fadeIn">
                  El monto debe ser mayor a 0
                </span>
              )}
            </div>

            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                {currency === 'USD' ? '$' : '€'}
              </div>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amountStr}
                onFocus={() => setHasInteractedWithAmount(true)}
                onChange={(e) => {
                  setHasInteractedWithAmount(true);
                  setAmountStr(e.target.value);
                }}
                className="w-full pl-8 pr-4 py-2.5 text-xl font-bold text-slate-900 bg-slate-50/70 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl outline-hidden transition-all"
              />
            </div>

            {/* Valor total sub-bar */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
              <span className="font-bold text-slate-700">Monto total</span>
              <div className="text-right">
                <span className={`text-base font-black ${debtType === 'por_cobrar' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {currency === 'USD' ? '$' : '€'}{numericAmount > 0 ? numericAmount.toFixed(2) : '0.00'}
                </span>
                {numericAmount > 0 && (
                  <div className="space-y-0.5">
                    <span className="block text-[10.5px] font-bold text-slate-700 font-mono">
                      ≈ Bs. {amountInBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="block text-[9.5px] text-slate-400 font-mono">
                      ≈ {currency === 'USD' ? '€' : '$'}{secondaryEquivalent.toFixed(2)} {currency === 'USD' ? 'EUR' : 'USD'} (Ref)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 6. CLIENTE / PROVEEDOR (PERSONA O ENTIDAD) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                {debtType === 'por_cobrar' ? (
                  <User className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Truck className="w-4 h-4 text-rose-600" />
                )}
                <span>
                  {debtType === 'por_cobrar' ? 'Cliente (Deudor)' : 'Proveedor (Acreedor)'}
                </span>
                <span className="text-rose-500 font-bold">*</span>
              </label>

              <button
                type="button"
                onClick={() => setIsContactSheetOpen(true)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1"
              >
                <span>Ver lista</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder={debtType === 'por_cobrar' ? 'Ej. Carlos Mendoza' : 'Ej. Distribuidora Polar C.A.'}
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 rounded-xl text-xs font-bold text-slate-900 outline-hidden"
              />
            </div>

            {/* Optional client phone for WhatsApp invoices */}
            {debtType === 'por_cobrar' && (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <input
                  type="tel"
                  placeholder="Teléfono / WhatsApp (Ej: 0414-1234567) - Opcional"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 rounded-xl text-xs font-mono font-medium text-slate-800 outline-hidden"
                />
              </div>
            )}

            {/* Quick chips of recent contacts */}
            {activeContactList.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                <span className="text-[10px] text-slate-400 font-semibold shrink-0">Recientes:</span>
                {activeContactList.slice(0, 4).map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setPersonName(c.name);
                      if (c.phone) setClientPhone(c.phone);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-semibold shrink-0 transition-colors cursor-pointer ${
                      personName === c.name
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 7. FECHA LÍMITE / VENCIMIENTO */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Fecha límite de pago (Vencimiento)</span>
              </label>
              <span className="text-[11px] font-mono font-bold text-slate-500">
                {dueDate}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setDueDateInDays(7)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                +7 días
              </button>
              <button
                type="button"
                onClick={() => setDueDateInDays(15)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                +15 días
              </button>
              <button
                type="button"
                onClick={() => setDueDateInDays(30)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                +30 días
              </button>
            </div>

            <div className="pt-1">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
              />
            </div>
          </div>

          {/* 8. CONCEPTO / DETALLE */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2 shadow-2xs">
            <label className="text-xs font-bold text-slate-800 block">
              Concepto / Detalle de la deuda
            </label>
            <input
              type="text"
              placeholder="Ej. Saldo factura #104 / Entrega de mercancía / Préstamo"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-medium text-slate-800 outline-hidden"
            />
          </div>

        </div>

        {/* BOTTOM FIXED CTA BAR */}
        <div className="p-4 bg-white border-t border-slate-200/80 shrink-0 shadow-lg space-y-2">
          <button
            type="button"
            onClick={handleSaveDebt}
            disabled={numericAmount <= 0 || !personName.trim()}
            className={`w-full py-3.5 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
              numericAmount <= 0 || !personName.trim()
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : debtType === 'por_cobrar'
                  ? 'bg-[#0D7A5F] hover:bg-[#0b654e] active:scale-[0.99]'
                  : 'bg-[#7B1113] hover:bg-[#660e10] active:scale-[0.99]'
            }`}
          >
            <span>
              {debtType === 'por_cobrar' ? 'Guardar cuenta por cobrar' : 'Guardar cuenta por pagar'}
            </span>
            {numericAmount > 0 && (
              <span className="font-mono font-bold opacity-90">
                ({currency === 'USD' ? '$' : '€'}{numericAmount.toFixed(2)})
              </span>
            )}
          </button>
        </div>

        {/* CONTACT SELECTION MODAL SHEET */}
        {isContactSheetOpen && (
          <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-2xs animate-fadeIn">
            <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slideUp">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    debtType === 'por_cobrar' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {debtType === 'por_cobrar' ? <User className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {debtType === 'por_cobrar' ? 'Seleccionar Cliente' : 'Seleccionar Proveedor'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {activeContactList.length} guardados
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsContactSheetOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Add Bar */}
              <div className="py-3 border-b border-slate-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`Agregar nuevo ${debtType === 'por_cobrar' ? 'cliente' : 'proveedor'}...`}
                    value={newContactInput}
                    onChange={(e) => setNewContactInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewContact();
                      }
                    }}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewContact}
                    disabled={!newContactInput.trim()}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold shrink-0 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="py-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar contacto..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-hidden"
                  />
                </div>
              </div>

              {/* Contact list */}
              <div className="flex-1 overflow-y-auto space-y-1 py-1">
                {filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No se encontraron contactos. Escribe arriba para crearlo.
                  </div>
                ) : (
                  filteredContacts.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setPersonName(c.name);
                        setIsContactSheetOpen(false);
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-slate-100 flex items-center justify-between text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-slate-800">{c.name}</span>
                      </div>
                      {personName === c.name && (
                        <Check className="w-4 h-4 text-emerald-600" />
                      )}
                    </button>
                  ))
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
