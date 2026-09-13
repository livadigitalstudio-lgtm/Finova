import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Plus, Trash2, Search, Phone, MapPin, DollarSign, 
  Send, Check, UserPlus, CreditCard, ChevronDown, UserCheck, 
  AlertCircle, X, ArrowUpRight
} from 'lucide-react';
import { ExchangeRates, FinancialRecord } from '../types';
import { formatMoney, CurrencyCode } from '../utils/currency';
import { storageService } from '../services/storageService';
import { getLocalDateString } from '../utils/dateUtils';

interface SuggestedClientsProps {
  userEmail: string;
  rates: ExchangeRates;
  selectedCurrency?: CurrencyCode;
  onClose?: () => void;
  onAddRecord?: (newRec: Omit<FinancialRecord, 'id'>) => void;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  location: string;
  notes: string;
  balanceUsd: number; // Positive means they owe money, negative means credit
}

export default function SuggestedClients({ userEmail, rates, selectedCurrency = 'USD', onClose, onAddRecord }: SuggestedClientsProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'con_deuda' | 'solventes'>('todos');
  
  // Create state
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Debt modal state (replaces prompt)
  const [debtModalClient, setDebtModalClient] = useState<Client | null>(null);
  const [debtAmountInput, setDebtAmountInput] = useState('');

  // Load clients list based on user identity
  useEffect(() => {
    try {
      const storageKey = `gt_clients_${userEmail}`;
      const cached = storageService.getSync<Client[]>(storageKey, []);
      if (cached && Array.isArray(cached)) {
        // Clean out any simulated test entries
        const clean = cached.filter(c => !c.id.startsWith('cli-') || (!c.name.includes('Andrés Mendoza') && !c.name.includes('Carla Benítez') && !c.name.includes('David Rondón')));
        setClients(clean);
        storageService.set(storageKey, clean);
      } else {
        setClients([]);
        storageService.set(storageKey, []);
      }
    } catch (e) {
      console.warn('Notice loading clients:', e);
      setClients([]);
    }
  }, [userEmail]);

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2800);
  };

  const handleRegisterClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newClient: Client = {
      id: `cli-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      location: location.trim(),
      notes: notes.trim(),
      balanceUsd: 0 // Default 0 as requested - no initial pending debt
    };

    const updated = [newClient, ...clients];
    setClients(updated);
    storageService.set(`gt_clients_${userEmail}`, updated);

    setName('');
    setPhone('');
    setLocation('');
    setNotes('');
    setIsAdding(false);
    flashSuccess(`¡Cliente "${newClient.name}" registrado correctamente!`);
  };

  const handleDeleteClient = (id: string) => {
    const target = clients.find(c => c.id === id);
    if (!target) return;
    
    if (confirm(`¿Estás seguro de que deseas eliminar al cliente "${target.name}"?`)) {
      const updated = clients.filter(c => c.id !== id);
      setClients(updated);
      storageService.set(`gt_clients_${userEmail}`, updated);
      flashSuccess('Cliente eliminado del registro');
    }
  };

  const handleUpdateBalance = (id: string, newBalance: number) => {
    const target = clients.find(c => c.id === id);
    if (!target) return;
    
    const oldBalance = target.balanceUsd;

    const updated = clients.map(c => {
      if (c.id === id) {
        return { ...c, balanceUsd: newBalance };
      }
      return c;
    });
    setClients(updated);
    storageService.set(`gt_clients_${userEmail}`, updated);
    flashSuccess('Saldo de cuenta ajustado correctamente');

    if (onAddRecord && oldBalance > 0 && newBalance === 0) {
      const currentRate = selectedCurrency === 'EUR' ? rates.bcvEur : rates.bcvUsd;
      onAddRecord({
        type: 'ingreso',
        amount: oldBalance,
        currency: selectedCurrency,
        amountBs: parseFloat((oldBalance * currentRate).toFixed(2)),
        exchangeRateUsed: currentRate,
        description: `Cobro deuda de cliente: ${target.name}`,
        category: 'Cobro a Clientes',
        date: getLocalDateString(),
        paymentMethod: selectedCurrency === 'EUR' ? 'Efectivo EUR' : 'Efectivo USD'
      });
    }
  };

  const handleSaveDebtModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtModalClient) return;
    const val = parseFloat(debtAmountInput);
    if (isNaN(val) || val < 0) return;

    handleUpdateBalance(debtModalClient.id, val);
    setDebtModalClient(null);
    setDebtAmountInput('');
  };

  // Compile reminder message for debtor template
  const getReminderMessage = (client: Client) => {
    const formatted = formatMoney(client.balanceUsd, selectedCurrency, rates);
    const text = `*Mifinanzas.com - Recordatorio de Pago*\n\nEstimado(a) *${client.name}*, esperando que se encuentre excelente.\nLe escribimos de manera cordial para recordarle su saldo pendiente de *${formatted.primaryWithCode}* (Ref: *${formatted.bolivares}* a tasa oficial BCV).\n\nAgradecemos su valioso apoyo y gentil atención para concretar la transferencia. ¡Muchas gracias!`;
    return encodeURIComponent(text);
  };

  // Filtered list
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        c.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.notes.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (filterStatus === 'con_deuda') return c.balanceUsd > 0;
      if (filterStatus === 'solventes') return c.balanceUsd <= 0;
      return true;
    });
  }, [clients, searchTerm, filterStatus]);

  // Statistics
  const totalReceivablesUsd = useMemo(() => {
    return clients.reduce((sum, c) => sum + (c.balanceUsd > 0 ? c.balanceUsd : 0), 0);
  }, [clients]);

  const debtorsCount = clients.filter(c => c.balanceUsd > 0).length;

  return (
    <div className="space-y-4 pb-20">
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. TOP SUMMARY METRICS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Clientes</span>
          <p className="text-xl font-black text-slate-900 mt-1">{clients.length}</p>
          <span className="text-[10px] text-slate-400">Registrados en base de datos</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs">
          <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">Por Cobrar a Clientes</span>
          <p className="text-xl font-black text-amber-600 font-mono mt-1">
            {formatMoney(totalReceivablesUsd, selectedCurrency, rates).primaryWithCode}
          </p>
          <span className="text-[10px] text-slate-400">Ref: {formatMoney(totalReceivablesUsd, selectedCurrency, rates).bolivares}</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs">
          <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Clientes Solventes</span>
          <p className="text-xl font-black text-emerald-600 mt-1">{clients.length - debtorsCount}</p>
          <span className="text-[10px] text-slate-400">{debtorsCount} clientes con saldo pendiente</span>
        </div>
      </div>

      {/* 2. ACTION BAR & ADD CLIENT TOGGLE */}
      <div className="flex justify-between items-center bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Directorio de Clientes</h4>
            <p className="text-[10px] text-slate-400 font-medium">Control de contactos, historial y cuentas por cobrar</p>
          </div>
        </div>
        
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-xs ${
            isAdding ? 'bg-slate-800 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
          id="btn-toggle-client-form"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>{isAdding ? 'Cerrar Formulario' : 'Nuevo Cliente'}</span>
        </button>
      </div>

      {/* 3. ADD CLIENT FORM */}
      {isAdding && (
        <form onSubmit={handleRegisterClient} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 animate-fade-in">
          <span className="text-[10.5px] font-black uppercase text-indigo-700 tracking-wide block border-b pb-1.5">
            Registrar Ficha de Cliente
          </span>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Nombre Completo *</label>
              <input 
                type="text" 
                required
                placeholder="Ej. Andrés Mendoza"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Teléfono Celular (WhatsApp)</label>
              <input 
                type="text" 
                placeholder="Ej. 0412-1112233"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Ubicación / Dirección</label>
            <input 
              type="text" 
              placeholder="Ej. Las Mercedes, Caracas"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Notas / Preferencias</label>
            <input 
              type="text" 
              placeholder="Ej. Le encantan los aromas dulces, prefiere entrega a domicilio..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer active:scale-95 transition-all"
            >
              Guardar Cliente
            </button>
          </div>
        </form>
      )}

      {/* 4. SEARCH & STATUS FILTER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar cliente por nombre, teléfono, ubicación..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8.5 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 font-medium"
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

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setFilterStatus('todos')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'todos' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('con_deuda')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'con_deuda' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Con Deuda ({debtorsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('solventes')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'solventes' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Solventes ({clients.length - debtorsCount})
          </button>
        </div>
      </div>

      {/* 5. CLIENTS LIST */}
      <div className="space-y-2.5">
        {filteredClients.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-200/80 p-4">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No se encontraron clientes</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Prueba con otro término de búsqueda o registra un nuevo cliente.</p>
          </div>
        ) : (
          filteredClients.map(client => (
            <div 
              key={client.id} 
              className={`p-3.5 bg-white border rounded-2xl transition-all shadow-xs space-y-2.5 ${
                client.balanceUsd > 0 ? 'border-amber-200/80 bg-amber-50/10' : 'border-slate-200/80'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>{client.name}</span>
                  </h5>
                  
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-slate-500 mt-1 font-medium">
                    {client.phone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {client.phone}
                      </span>
                    )}
                    {client.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {client.location}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteClient(client.id)}
                  className="p-1.5 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Eliminar Cliente"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {client.notes && (
                <p className="text-[10.5px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 italic">
                  💡 {client.notes}
                </p>
              )}

              {/* Status and Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-black block">Estatus de Cobro:</span>
                  {client.balanceUsd > 0 ? (
                    <span className="text-amber-600 font-extrabold font-mono text-xs block">
                      Deuda: {formatMoney(client.balanceUsd, selectedCurrency, rates).primaryWithCode} (Ref: {formatMoney(client.balanceUsd, selectedCurrency, rates).bolivares})
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-extrabold text-xs block flex items-center gap-1">
                      <Check className="w-3 h-3" /> Solvente
                    </span>
                  )}
                </div>

                <div className="flex gap-2 items-center">
                  {client.balanceUsd > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateBalance(client.id, 0)}
                        className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-[10px] font-black active:scale-95 transition-all cursor-pointer"
                      >
                        Marcar Solvente
                      </button>
                      
                      <a
                        href={`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${getReminderMessage(client)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black inline-flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-xs"
                      >
                        <Send className="w-3 h-3" />
                        <span>Cobrar WhatsApp</span>
                      </a>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDebtModalClient(client);
                        setDebtAmountInput('10.00');
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-xl cursor-pointer transition-colors"
                    >
                      + Registrar Deuda
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 6. MODAL TO REGISTER DEBT (replaces window.prompt) */}
      {debtModalClient && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-xs font-black uppercase text-slate-800">Registrar Saldo Deudor</h4>
              <button
                type="button"
                onClick={() => setDebtModalClient(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Ingresa el monto que debe el cliente <strong className="text-slate-800">{debtModalClient.name}</strong>:
            </p>

            <form onSubmit={handleSaveDebtModal} className="space-y-3">
              <div>
                <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                  Monto en {selectedCurrency === 'EUR' ? 'Euros (€ EUR)' : 'Dólares ($ USD)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={debtAmountInput}
                  onChange={e => setDebtAmountInput(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDebtModalClient(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md"
                >
                  Confirmar Deuda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
