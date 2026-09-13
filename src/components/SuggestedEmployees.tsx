import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Plus, Trash2, Check, UserCheck, DollarSign, 
  TrendingUp, Calculator, FileSpreadsheet, Percent, Coins 
} from 'lucide-react';
import { FinancialRecord } from '../types';
import { storageService } from '../services/storageService';
import { getLocalDateString } from '../utils/dateUtils';

interface SuggestedEmployeesProps {
  userEmail: string;
  onAddRecord: (newRec: Omit<FinancialRecord, 'id'>) => void;
  onClose?: () => void;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  baseSalary: number; // in USD
  commissionRate: number; // percentage (e.g. 5 means 5%)
}

export default function SuggestedEmployees({ userEmail, onAddRecord, onClose }: SuggestedEmployeesProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [commissionRate, setCommissionRate] = useState('');

  // Payout calculation states
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [salesVolume, setSalesVolume] = useState('');
  const [calculatedPayout, setCalculatedPayout] = useState<{ base: number; commission: number; total: number } | null>(null);

  // Load employee list based on active user (with IndexedDB fallback)
  useEffect(() => {
    const cached = storageService.getSync<Employee[]>(`gt_employees_${userEmail}`, []);
    const clean = cached.filter(e => !e.id.startsWith('emp-') || (!e.name.includes('Luis Rosales') && !e.name.includes('Carla Gómez')));
    setEmployees(clean);
    storageService.get<Employee[]>(`gt_employees_${userEmail}`, clean).then((asyncList) => {
      const cleanAsync = asyncList.filter(e => !e.id.startsWith('emp-') || (!e.name.includes('Luis Rosales') && !e.name.includes('Carla Gómez')));
      if (cleanAsync.length > 0) setEmployees(cleanAsync);
    });
  }, [userEmail]);

  // Handle first load of calculator dropdown
  useEffect(() => {
    if (employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleRegisterEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: name.trim(),
      role: role.trim() || 'Colaborador',
      baseSalary: parseFloat(baseSalary) || 0,
      commissionRate: parseFloat(commissionRate) || 0
    };

    const updated = [...employees, newEmp];
    setEmployees(updated);
    storageService.set(`gt_employees_${userEmail}`, updated);

    // Reset states
    setName('');
    setRole('');
    setBaseSalary('');
    setCommissionRate('');
    setIsAdding(false);
    flashSuccess(`¡Empleado "${newEmp.name}" integrado con éxito!`);
  };

  const handleDeleteEmployee = (id: string) => {
    const target = employees.find(e => e.id === id);
    if (!target) return;

    if (confirm(`¿Proceder a retirar a "${target.name}" de la nómina activa?`)) {
      const updated = employees.filter(e => e.id !== id);
      setEmployees(updated);
      storageService.set(`gt_employees_${userEmail}`, updated);
      if (selectedEmployeeId === id) setSelectedEmployeeId('');
      setCalculatedPayout(null);
      flashSuccess('Empleado removido de la nómina');
    }
  };

  // Run payout calculator
  const handleCalculate = () => {
    if (!selectedEmployeeId) return;
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    const salesVal = parseFloat(salesVolume) || 0;
    const commAmt = (salesVal * emp.commissionRate) / 100;
    const total = emp.baseSalary + commAmt;

    setCalculatedPayout({
      base: emp.baseSalary,
      commission: commAmt,
      total: total
    });
  };

  // Register payout in real financial cashflow list!
  const handleRegisterPayoutInCashflow = () => {
    if (!selectedEmployeeId || !calculatedPayout) return;
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    // Call state callback upwards
    onAddRecord({
      type: 'egreso',
      amount: calculatedPayout.total,
      amountBs: 0, // App will auto-compute Bs equivalent!
      exchangeRateUsed: 1, // Will be computed with standard active rate
      description: `Nómina/Comisión de ${emp.name} (${emp.role}) - Ventas calculadas: $${salesVolume || 0}`,
      category: 'Nómina',
      date: getLocalDateString(),
      paymentMethod: 'efectivo_usd'
    });

    setSalesVolume('');
    setCalculatedPayout(null);
    flashSuccess(`¡Salario y comisión de ${emp.name} cargado correctamente como Gasto!`);
  };

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 p-2 text-xs font-bold rounded-xl flex items-center gap-1.5 animate-bounce-subtle">
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Buttons bar */}
      <div className="flex justify-between items-center bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-black uppercase text-indigo-600 tracking-wider">
          <Briefcase className="w-4.5 h-4.5 animate-pulse-subtle" />
          <span>Nómina y Comisiones de Equipo</span>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
            isAdding ? 'bg-slate-800 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          {isAdding ? 'Cerrar Ficha' : 'Nuevo Colaborador'}
        </button>
      </div>

      {/* Registration Form Card */}
      {isAdding && (
        <form onSubmit={handleRegisterEmployee} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wide block border-b pb-1">Definir Nuevo Colaborador</span>
          
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Nombre y Apellido *</label>
              <input 
                type="text" 
                required
                placeholder="Ej. Luis Rosales"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Cargo / Rol</label>
              <input 
                type="text" 
                placeholder="Ej. Despachador"
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Sueldo Base ($ USD)</label>
              <input 
                type="number" 
                step="0.01"
                placeholder="Ej. 100"
                value={baseSalary}
                onChange={e => setBaseSalary(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide font-sans">Comisión por Ventas (%)</label>
              <input 
                type="number" 
                step="0.1"
                placeholder="Ej. 5"
                value={commissionRate}
                onChange={e => setCommissionRate(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
          >
            Añadir Miembro
          </button>
        </form>
      )}

      {/* Directory and Payroll list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Active staff */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3.5">
          <span className="text-[10.5px] font-black uppercase text-slate-700 tracking-wider block">Directorio de Colaboradores ({employees.length})</span>
          
          {employees.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-xs">No hay colaboradores inscritos.</p>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
              {employees.map(emp => (
                <div key={emp.id} className="p-3 bg-slate-55 bg-slate-50 border rounded-xl flex justify-between items-center">
                  <div>
                    <h5 className="font-extrabold text-slate-800 text-xs flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                      {emp.name}
                    </h5>
                    <p className="text-[10px] text-slate-405 text-indigo-600 font-bold">{emp.role}</p>
                    
                    <div className="flex gap-3 text-[10px] text-slate-400 font-mono mt-1">
                      <span>Sueldo: ${emp.baseSalary.toFixed(2)}</span>
                      <span>Comisión: {emp.commissionRate}%</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteEmployee(emp.id)}
                    className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all cursor-pointer bg-white border border-slate-200"
                    title="Retirar Empleado"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Payroll Payout Calculator integrated to flow */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3.5">
          <span className="text-[10.5px] font-black uppercase text-slate-700 tracking-wider block flex items-center gap-1">
            <Calculator className="w-4 h-4 text-emerald-600" />
            <span>Liquidación Rápida de Comisiones</span>
          </span>

          {employees.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-[10px] font-sans">
              Requiere registrar al menos un empleado para simular liquidaciones.
            </p>
          ) : (
            <div className="space-y-3 text-xs">
              
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Seleccionar Colaborador</label>
                <select
                  value={selectedEmployeeId}
                  onChange={e => {
                    setSelectedEmployeeId(e.target.value);
                    setCalculatedPayout(null);
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-sans"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Ventas Totales del Periodo ($ USD)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Ej. 1250.00"
                    value={salesVolume}
                    onChange={e => {
                      setSalesVolume(e.target.value);
                      setCalculatedPayout(null);
                    }}
                    className="flex-grow p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCalculate}
                    className="px-3 bg-indigo-600 hover:bg-indigo-700 hover:shadow-sm text-white font-extrabold rounded-xl transition-all cursor-pointer active:scale-95"
                  >
                    Calcular
                  </button>
                </div>
              </div>

              {/* Calculator Output */}
              {calculatedPayout && (
                <div className="p-3 bg-slate-900 text-white rounded-2xl border border-slate-950 font-mono text-[11px] space-y-1.5 animate-fade-in">
                  <span className="text-[9px] uppercase font-black text-indigo-300 block mb-1">Detalle del Liquidación</span>
                  <div className="flex justify-between">
                    <span>Sueldo Base Operaciones:</span>
                    <span>${calculatedPayout.base.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-805 border-slate-800 pb-1.5">
                    <span>Comisión Calculada:</span>
                    <span className="text-emerald-400">+${calculatedPayout.commission.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between font-black text-xs pt-1">
                    <span>Monto Total a Pagar:</span>
                    <span className="text-emerald-400 text-xs">${calculatedPayout.total.toFixed(2)} USD</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleRegisterPayoutInCashflow}
                    className="w-full mt-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-900/10 active:scale-95 transition-all text-center cursor-pointer"
                  >
                    Registrar en Gasto Neto Cashflow (-)
                  </button>
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
