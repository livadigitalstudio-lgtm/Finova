import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Plus, Trash2, Search, Phone, MapPin, DollarSign, 
  Send, Check, UserPlus, CreditCard, ChevronDown, UserCheck, 
  AlertCircle, X, ArrowUpRight, ArrowDownRight, Edit2, Clock,
  Calendar, CheckCircle2, ShieldCheck, History, MessageCircle,
  ExternalLink, Sparkles, Filter, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ExchangeRates, FinancialRecord, DebtItem, DebtPayment } from '../types';
import { formatMoney, CurrencyCode } from '../utils/currency';
import { storageService } from '../services/storageService';
import { getLocalDateString } from '../utils/dateUtils';
import { getDebtRemainingAmount, getDebtPaidAmount } from '../utils/debtUtils';

export interface Client {
  id: string;
  name: string;
  phone: string;
  location: string;
  notes: string;
  balanceUsd?: number;
  createdAt?: string;
}

interface SuggestedClientsProps {
  userEmail: string;
  rates: ExchangeRates;
  selectedCurrency?: CurrencyCode;
  debts?: DebtItem[];
  onAddDebt?: (debt: Omit<DebtItem, 'id' | 'dateCreated'>) => void;
  onApplyPayment?: (debtId: string, payment: Omit<DebtPayment, 'id'>, registerAsIncome: boolean) => void;
  onApplyClientPayment?: (clientName: string, payment: Omit<DebtPayment, 'id'>, registerAsIncome: boolean) => void;
  onAddRecord?: (newRec: Omit<FinancialRecord, 'id'>) => void;
  onClose?: () => void;
}

export default function SuggestedClients({ 
  userEmail, 
  rates, 
  selectedCurrency = 'USD', 
  debts = [],
  onAddDebt,
  onApplyPayment,
  onApplyClientPayment,
  onAddRecord, 
  onClose 
}: SuggestedClientsProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'con_deuda' | 'solventes'>('todos');
  const [sortBy, setSortBy] = useState<'deuda_desc' | 'recientes' | 'alfabetico'>('deuda_desc');
  
  // Quick Add Client form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [initialDebtAmount, setInitialDebtAmount] = useState('');
  const [initialDebtConcept, setInitialDebtConcept] = useState('Fiado inicial');
  const [hasInitialDebt, setHasInitialDebt] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Client Debt Action Modals
  const [debtModalClient, setDebtModalClient] = useState<Client | null>(null);
  const [newDebtAmount, setNewDebtAmount] = useState('');
  const [newDebtConcept, setNewDebtConcept] = useState('');
  const [newDebtDueDate, setNewDebtDueDate] = useState(() => {
    return getLocalDateString(new Date(Date.now() + 7 * 86400000));
  });

  // Client Payment / Abono Modal
  const [paymentModalClient, setPaymentModalClient] = useState<Client | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo USD');
  const [paymentRef, setPaymentRef] = useState('');
  const [registerInCashflow, setRegisterInCashflow] = useState(true);

  // Client History Drawer Modal
  const [historyModalClient, setHistoryModalClient] = useState<Client | null>(null);

  // Editing Client
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Load clients list based on user storage key
  useEffect(() => {
    try {
      const storageKey = `gt_clients_${userEmail || 'guest'}`;
      const cached = storageService.getSync<Client[]>(storageKey, []);
      if (cached && Array.isArray(cached)) {
        // Clean out any simulated legacy test entries
        const clean = cached.filter(c => 
          !c.name.includes('Andrés Mendoza') && 
          !c.name.includes('Carla Benítez') && 
          !c.name.includes('David Rondón')
        );
        setClients(clean);
        storageService.set(storageKey, clean);
      } else {
        setClients([]);
      }
    } catch (e) {
      console.warn('Notice loading clients:', e);
      setClients([]);
    }
  }, [userEmail]);

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Helper to get total debt for a client name from real debts collection
  const getClientDebtInfo = (clientName: string) => {
    const clean = clientName.trim().toLowerCase();
    const matchingDebts = debts.filter(d => 
      d.type === 'por_cobrar' && 
      d.debtorName && 
      d.debtorName.trim().toLowerCase() === clean
    );

    const pendingDebts = matchingDebts.filter(d => d.status === 'pendiente');
    const totalRemaining = pendingDebts.reduce((sum, d) => sum + getDebtRemainingAmount(d), 0);
    const totalPaid = matchingDebts.reduce((sum, d) => sum + getDebtPaidAmount(d), 0);
    const totalOriginal = matchingDebts.reduce((sum, d) => sum + (d.amount || 0), 0);

    return {
      totalRemaining,
      totalPaid,
      totalOriginal,
      pendingCount: pendingDebts.length,
      totalCount: matchingDebts.length,
      debtsList: matchingDebts
    };
  };

  // Handle register new client
  const handleRegisterClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newClient: Client = {
      id: `cli-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      phone: phone.trim(),
      location: location.trim(),
      notes: notes.trim(),
      balanceUsd: 0,
      createdAt: getLocalDateString()
    };

    const updated = [newClient, ...clients];
    setClients(updated);
    storageService.set(`gt_clients_${userEmail || 'guest'}`, updated);

    // If initial debt was specified, create structured DebtItem directly
    const initAmt = parseFloat(initialDebtAmount);
    if (hasInitialDebt && !isNaN(initAmt) && initAmt > 0 && onAddDebt) {
      const activeRate = selectedCurrency === 'EUR' ? rates.bcvEur : rates.bcvUsd;
      onAddDebt({
        type: 'por_cobrar',
        debtorName: newClient.name,
        clientPhone: newClient.phone,
        amount: initAmt,
        remainingAmount: initAmt,
        paidAmount: 0,
        currency: selectedCurrency === 'EUR' ? 'EUR' : 'USD',
        amountBs: parseFloat((initAmt * activeRate).toFixed(2)),
        exchangeRateUsed: activeRate,
        dueDate: getLocalDateString(new Date(Date.now() + 7 * 86400000)),
        status: 'pendiente',
        description: initialDebtConcept.trim() || 'Fiado registrado con el cliente'
      });
      flashSuccess(`¡Cliente "${newClient.name}" registrado con deuda de $${initAmt.toFixed(2)}!`);
    } else {
      flashSuccess(`¡Cliente "${newClient.name}" registrado con éxito!`);
    }

    // Reset form
    setName('');
    setPhone('');
    setLocation('');
    setNotes('');
    setInitialDebtAmount('');
    setHasInitialDebt(false);
    setShowAddForm(false);
  };

  // Handle delete client
  const handleDeleteClient = (id: string) => {
    const target = clients.find(c => c.id === id);
    if (!target) return;
    
    if (confirm(`¿Estás seguro de que deseas eliminar al cliente "${target.name}" del directorio?`)) {
      const updated = clients.filter(c => c.id !== id);
      setClients(updated);
      storageService.set(`gt_clients_${userEmail || 'guest'}`, updated);
      flashSuccess(`Cliente "${target.name}" eliminado del directorio`);
    }
  };

  // Handle edit client details
  const handleSaveEditClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    const updated = clients.map(c => c.id === editingClient.id ? editingClient : c);
    setClients(updated);
    storageService.set(`gt_clients_${userEmail || 'guest'}`, updated);
    setEditingClient(null);
    flashSuccess('Datos del cliente actualizados');
  };

  // Handle Adding Debt to a Client
  const handleConfirmAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtModalClient) return;
    const amt = parseFloat(newDebtAmount);
    if (isNaN(amt) || amt <= 0) return;

    const activeRate = selectedCurrency === 'EUR' ? rates.bcvEur : rates.bcvUsd;
    if (onAddDebt) {
      onAddDebt({
        type: 'por_cobrar',
        debtorName: debtModalClient.name,
        clientPhone: debtModalClient.phone,
        amount: amt,
        remainingAmount: amt,
        paidAmount: 0,
        currency: selectedCurrency === 'EUR' ? 'EUR' : 'USD',
        amountBs: parseFloat((amt * activeRate).toFixed(2)),
        exchangeRateUsed: activeRate,
        dueDate: newDebtDueDate || getLocalDateString(new Date(Date.now() + 7 * 86400000)),
        status: 'pendiente',
        description: newDebtConcept.trim() || 'Fiado / Crédito concedido'
      });
      flashSuccess(`¡Deuda de $${amt.toFixed(2)} sumada a la cuenta de "${debtModalClient.name}"!`);
    }

    setDebtModalClient(null);
    setNewDebtAmount('');
    setNewDebtConcept('');
  };

  // Handle Applying Abono / Payment to a Client
  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalClient) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;

    const activeRate = selectedCurrency === 'EUR' ? rates.bcvEur : rates.bcvUsd;
    const paymentPayload: Omit<DebtPayment, 'id'> = {
      date: getLocalDateString(),
      amount: amt,
      amountBs: parseFloat((amt * activeRate).toFixed(2)),
      exchangeRateUsed: activeRate,
      currency: selectedCurrency === 'EUR' ? 'EUR' : 'USD',
      paymentMethod,
      reference: paymentRef.trim() || undefined,
      notes: `Abono de ${paymentModalClient.name}`
    };

    if (onApplyClientPayment) {
      onApplyClientPayment(paymentModalClient.name, paymentPayload, registerInCashflow);
    } else if (onApplyPayment) {
      // Fallback: apply to oldest pending debt
      const clientDebts = debts.filter(d => 
        d.type === 'por_cobrar' && 
        d.status === 'pendiente' && 
        d.debtorName?.toLowerCase().trim() === paymentModalClient.name.toLowerCase().trim()
      );
      if (clientDebts.length > 0) {
        onApplyPayment(clientDebts[0].id, paymentPayload, registerInCashflow);
      }
    }

    flashSuccess(`¡Abono de $${amt.toFixed(2)} registrado para "${paymentModalClient.name}"!`);
    setPaymentModalClient(null);
    setPaymentAmount('');
    setPaymentRef('');
  };

  // Compile reminder message for WhatsApp with official BCV rates
  const getWhatsAppReminderUrl = (client: Client, remainingAmount: number) => {
    if (!client.phone) return '#';
    const cleanPhone = client.phone.replace(/\D/g, '');
    const formatted = formatMoney(remainingAmount, selectedCurrency, rates);
    const msg = `*Finova - Recordatorio de Cuenta*\n\nHola *${client.name}*, un cordial saludo.\nTe escribimos para recordarte tu saldo pendiente de *${formatted.primaryWithCode}* (Equivalente a *${formatted.bolivares}* a tasa oficial BCV).\n\nAgradecemos tu gentil apoyo para concretar el pago cuando te sea posible. ¡Muchas gracias!`;
    return `https://wa.me/${cleanPhone.startsWith('58') ? cleanPhone : '58' + cleanPhone.replace(/^0+/, '')}?text=${encodeURIComponent(msg)}`;
  };

  // Filtered and sorted clients list
  const filteredAndSortedClients = useMemo(() => {
    const list = clients.filter(c => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || 
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.location && c.location.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q));

      if (!matchSearch) return false;

      const debtInfo = getClientDebtInfo(c.name);
      if (filterStatus === 'con_deuda') return debtInfo.totalRemaining > 0.001;
      if (filterStatus === 'solventes') return debtInfo.totalRemaining <= 0.001;
      return true;
    });

    return list.sort((a, b) => {
      const debtA = getClientDebtInfo(a.name).totalRemaining;
      const debtB = getClientDebtInfo(b.name).totalRemaining;

      if (sortBy === 'deuda_desc') return debtB - debtA;
      if (sortBy === 'recientes') return (b.createdAt || '').localeCompare(a.createdAt || '');
      return a.name.localeCompare(b.name);
    });
  }, [clients, searchTerm, filterStatus, sortBy, debts]);

  // Overall Statistics
  const totalReceivables = useMemo(() => {
    return clients.reduce((sum, c) => sum + getClientDebtInfo(c.name).totalRemaining, 0);
  }, [clients, debts]);

  const debtorsCount = useMemo(() => {
    return clients.filter(c => getClientDebtInfo(c.name).totalRemaining > 0.001).length;
  }, [clients, debts]);

  return (
    <div className="space-y-4 pb-20">
      {/* SUCCESS TOAST NOTIFICATION */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-emerald-600 text-white p-3 text-xs font-bold rounded-2xl flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-white/80 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. TOP STATS BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Clientes</span>
          <p className="text-xl font-black text-slate-900 mt-1">{clients.length}</p>
          <span className="text-[9.5px] text-slate-400">En agenda comercial</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs">
          <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">Con Saldo Deudor</span>
          <p className="text-xl font-black text-amber-600 mt-1">{debtorsCount}</p>
          <span className="text-[9.5px] text-slate-400">Tienen cuentas pendientes</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs">
          <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Clientes Solventes</span>
          <p className="text-xl font-black text-emerald-600 mt-1">{clients.length - debtorsCount}</p>
          <span className="text-[9.5px] text-slate-400">Al día sin deudas</span>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-3.5 shadow-xs">
          <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">Total por Cobrar</span>
          <p className="text-lg font-black text-amber-400 font-mono mt-0.5">
            ${totalReceivables.toFixed(2)}
          </p>
          <span className="text-[9px] text-slate-300 block truncate">
            {formatMoney(totalReceivables, selectedCurrency, rates).bolivares}
          </span>
        </div>
      </div>

      {/* 2. HEADER ACTION BAR: ULTRA EASY "NUEVO CLIENTE" TRIGGER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>Directorio de Clientes</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                {clients.length}
              </span>
            </h4>
            <p className="text-[10.5px] text-slate-400">
              Gestión rápida de contactos, cuentas unificadas y cobranzas
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-xs ${
            showAddForm 
              ? 'bg-slate-800 text-white' 
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
          id="btn-toggle-add-client"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showAddForm ? 'Cerrar' : '+ Agregar Cliente'}</span>
        </button>
      </div>

      {/* 3. FAST CLIENT REGISTRATION BOX (EASY & INTUITIVE) */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form 
              onSubmit={handleRegisterClient} 
              className="bg-white rounded-2xl border-2 border-indigo-500/20 p-4 sm:p-5 shadow-sm space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black uppercase text-indigo-700 tracking-wide flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4" />
                  <span>Nuevo Cliente (Registro Rápido)</span>
                </span>
                <span className="text-[10.5px] text-slate-400 font-medium">Completa los datos básicos</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Nombre Completo *
                  </label>
                  <input 
                    type="text" 
                    required
                    autoFocus
                    placeholder="Ej. Carlos Méndez"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Teléfono Celular / WhatsApp
                  </label>
                  <input 
                    type="tel" 
                    placeholder="Ej. 0412-1234567"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Ubicación / Zona / Local
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ej. Local 12, Mercado Central o Caracas"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Nota o Etiqueta Rápida
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ej. Cliente mayorista, paga los viernes..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium outline-hidden"
                  />
                </div>
              </div>

              {/* Optional: Add initial debt right at creation */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900">
                    <input 
                      type="checkbox"
                      checked={hasInitialDebt}
                      onChange={e => setHasInitialDebt(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>¿Este cliente ya tiene una deuda o fiado pendiente?</span>
                  </label>
                  {hasInitialDebt && (
                    <span className="text-[10px] font-black text-amber-800 bg-amber-200 px-2 py-0.5 rounded-md">
                      Se sumará a sus deudas
                    </span>
                  )}
                </div>

                {hasInitialDebt && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 animate-fade-in">
                    <div>
                      <label className="text-[9.5px] font-bold text-amber-800 uppercase block mb-1">
                        Monto de la deuda ($ USD)
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00"
                        value={initialDebtAmount}
                        onChange={e => setInitialDebtAmount(e.target.value)}
                        className="w-full p-2 text-xs bg-white border border-amber-300 rounded-xl focus:ring-1 focus:ring-amber-500 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-amber-800 uppercase block mb-1">
                        Concepto del fiado
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ej. Compra de mercancía a plazos"
                        value={initialDebtConcept}
                        onChange={e => setInitialDebtConcept(e.target.value)}
                        className="w-full p-2 text-xs bg-white border border-amber-300 rounded-xl focus:ring-1 focus:ring-amber-500 font-medium"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar Cliente</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. SEARCH & STATUS FILTERS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono, zona o notas..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 font-medium outline-hidden"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-700 outline-hidden"
          >
            <option value="deuda_desc">Mayor deuda primero</option>
            <option value="recientes">Más recientes</option>
            <option value="alfabetico">Alfabético (A - Z)</option>
          </select>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setFilterStatus('todos')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'todos' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('con_deuda')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'con_deuda' 
                ? 'bg-amber-600 text-white shadow-xs' 
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Con Deuda ({debtorsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('solventes')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'solventes' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Solventes ({clients.length - debtorsCount})
          </button>
        </div>
      </div>

      {/* 5. CLIENTS LIST (CARTERA CONSOLIDADA POR CLIENTE) */}
      <div className="space-y-3">
        {filteredAndSortedClients.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-500 flex items-center justify-center mx-auto mb-3">
              <Users className="w-8 h-8" />
            </div>
            <h5 className="text-sm font-bold text-slate-800">No se encontraron clientes</h5>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {searchTerm 
                ? 'Intenta con otro término de búsqueda o limpia el filtro.' 
                : 'Agrega tu primer cliente tocando "+ Agregar Cliente" para gestionar cuentas y cobranzas.'}
            </p>
            {!searchTerm && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Cliente Ahora</span>
              </button>
            )}
          </div>
        ) : (
          filteredAndSortedClients.map(client => {
            const debtInfo = getClientDebtInfo(client.name);
            const hasDebt = debtInfo.totalRemaining > 0.001;
            const initials = client.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'CL';

            return (
              <div 
                key={client.id}
                className={`bg-white rounded-2xl border p-4 shadow-xs transition-all space-y-3 ${
                  hasDebt 
                    ? 'border-amber-200 hover:border-amber-300' 
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Client Top Header: Avatar, Name, Phone, and Balance Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 ${
                      hasDebt 
                        ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-200' 
                        : 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-200'
                    }`}>
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="font-extrabold text-sm text-slate-900 truncate">
                          {client.name}
                        </h5>
                        {hasDebt ? (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                            Deuda: ${debtInfo.totalRemaining.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Solvente
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-1">
                        {client.phone && (
                          <span className="flex items-center gap-1 font-mono text-slate-600">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {client.phone}
                          </span>
                        )}
                        {client.location && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {client.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Header: Edit & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingClient(client)}
                      className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="Editar ficha del cliente"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClient(client.id)}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar cliente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Client Notes if any */}
                {client.notes && (
                  <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 italic">
                    💡 {client.notes}
                  </p>
                )}

                {/* Debt Financial Summary Strip */}
                {hasDebt && (
                  <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-200/60 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                        Saldo total consolidado:
                      </span>
                      <div className="text-base font-black text-amber-900 font-mono">
                        ${debtInfo.totalRemaining.toFixed(2)} USD
                        <span className="text-xs font-semibold text-amber-700 ml-1.5">
                          (Ref: {formatMoney(debtInfo.totalRemaining, selectedCurrency, rates).bolivares})
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-slate-500 block">
                        {debtInfo.pendingCount} cuenta{debtInfo.pendingCount > 1 ? 's' : ''} pendiente{debtInfo.pendingCount > 1 ? 's' : ''}
                      </span>
                      {debtInfo.totalPaid > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700">
                          Abonado: ${debtInfo.totalPaid.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Toolbar */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* 1. Sumar Deuda */}
                    <button
                      type="button"
                      onClick={() => {
                        setDebtModalClient(client);
                        setNewDebtAmount('15.00');
                        setNewDebtConcept('Nueva compra a crédito');
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                      title="Sumar una nueva deuda a este cliente"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>+ Sumar Deuda</span>
                    </button>

                    {/* 2. Abonar / Cobrar (if they owe money) */}
                    {hasDebt && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentModalClient(client);
                          setPaymentAmount(debtInfo.totalRemaining.toFixed(2));
                        }}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                        title="Restar o abonar al saldo de este cliente"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>− Abonar / Cobrar</span>
                      </button>
                    )}

                    {/* 3. Ver Historial de Cuentas */}
                    <button
                      type="button"
                      onClick={() => setHistoryModalClient(client)}
                      className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1 cursor-pointer border border-slate-200"
                      title="Ver notas de deudas y abonos de este cliente"
                    >
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      <span>Historial ({debtInfo.totalCount})</span>
                    </button>
                  </div>

                  {/* 4. WhatsApp Recordatorio Button */}
                  {client.phone && hasDebt && (
                    <a
                      href={getWhatsAppReminderUrl(client, debtInfo.totalRemaining)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 active:scale-95 transition-all shadow-2xs"
                      title="Enviar recordatorio de cobro por WhatsApp"
                    >
                      <Send className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Cobrar WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- MODAL 1: SUMAR DEUDA AL CLIENTE --- */}
      {debtModalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black uppercase text-slate-900">
                    Sumar Deuda al Cliente
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {debtModalClient.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDebtModalClient(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAddDebt} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                  Monto de la Deuda ($ USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={newDebtAmount}
                  onChange={e => setNewDebtAmount(e.target.value)}
                  className="w-full p-2.5 text-base bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono font-bold outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                  Concepto o Detalle *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Compra de 2 camisas, fiado de almuerzo..."
                  value={newDebtConcept}
                  onChange={e => setNewDebtConcept(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                  Fecha de Vencimiento / Compromiso
                </label>
                <input
                  type="date"
                  value={newDebtDueDate}
                  onChange={e => setNewDebtDueDate(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium outline-hidden"
                />
              </div>

              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 text-[11px] text-blue-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Esta deuda se sumará al saldo total de <strong>{debtModalClient.name}</strong> en su cuenta consolidada.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDebtModalClient(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all"
                >
                  Sumar Deuda
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* --- MODAL 2: REGISTRAR ABONO / COBRAR AL CLIENTE --- */}
      {paymentModalClient && (
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
                    Registrar Abono del Cliente
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {paymentModalClient.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalClient(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-3">
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
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full p-2.5 text-base bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono font-bold outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                  Método de Pago
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
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
                  placeholder="Ej. Últimos 4 dígitos o captura"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono outline-hidden"
                />
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-950 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={registerInCashflow}
                    onChange={e => setRegisterInCashflow(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                  />
                  <span>Ingresar de una vez a la caja / balance de hoy</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalClient(null)}
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

      {/* --- MODAL 3: HISTORIAL COMPACTO DE CUENTAS DEL CLIENTE --- */}
      {historyModalClient && (
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
                  <span>Historial de Cuentas: {historyModalClient.name}</span>
                </h4>
                <p className="text-[10.5px] text-slate-400">
                  Desglose ordenado de deudas y abonos recibidos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalClient(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {(() => {
                const info = getClientDebtInfo(historyModalClient.name);
                if (info.debtsList.length === 0) {
                  return (
                    <div className="text-center py-8 text-xs text-slate-400">
                      No hay notas de deuda registradas para este cliente.
                    </div>
                  );
                }

                return info.debtsList.map(item => {
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

                      {/* Payments on this specific item */}
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
                    </div>
                  );
                });
              })()}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalClient(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* --- MODAL 4: EDITAR CLIENTE --- */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-xs sm:text-sm font-black uppercase text-slate-900">
                Editar Datos del Cliente
              </h4>
              <button onClick={() => setEditingClient(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditClient} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={editingClient.name}
                  onChange={e => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Teléfono / WhatsApp</label>
                <input
                  type="tel"
                  value={editingClient.phone}
                  onChange={e => setEditingClient({ ...editingClient, phone: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Ubicación / Dirección</label>
                <input
                  type="text"
                  value={editingClient.location}
                  onChange={e => setEditingClient({ ...editingClient, location: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Notas / Preferencias</label>
                <input
                  type="text"
                  value={editingClient.notes}
                  onChange={e => setEditingClient({ ...editingClient, notes: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
