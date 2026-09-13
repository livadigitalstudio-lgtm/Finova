import React, { useState } from 'react';
import { X, Lock, ShieldCheck, Users, ToggleLeft, ToggleRight, Trash2, Edit2, Plus, Sparkles, AlertTriangle, Coins, Save } from 'lucide-react';
import { UserSession, MonetizationPlan } from '../types';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  usersList: UserSession[];
  onUpdateUserPlan: (email: string, plan: 'basic' | 'premium') => void;
  onBanUser: (email: string) => void;
  onUnbanUser: (email: string) => void;
  plans: MonetizationPlan[];
  onAddPlan: (plan: MonetizationPlan) => void;
  onUpdatePlan: (plan: MonetizationPlan) => void;
  onDeletePlan: (id: string) => void;
}

export default function AdminPanelModal({
  isOpen,
  onClose,
  usersList,
  onUpdateUserPlan,
  onBanUser,
  onUnbanUser,
  plans,
  onAddPlan,
  onUpdatePlan,
  onDeletePlan,
}: AdminPanelModalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Active sub-tab inside admin: 'users' or 'plans'
  const [activeTab, setActiveTab] = useState<'users' | 'plans'>('users');

  // Plan editing states
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanName, setEditPlanName] = useState('');
  const [editPlanPrice, setEditPlanPrice] = useState<number>(0);
  const [editPlanDiscount, setEditPlanDiscount] = useState<number>(0);
  const [editPlanFreq, setEditPlanFreq] = useState('mes');

  // New plan creation states
  const [showAddPlanForm, setShowAddPlanForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState<number>(4.99);
  const [newPlanDiscount, setNewPlanDiscount] = useState<number>(10);
  const [newPlanFreq, setNewPlanFreq] = useState('mes');
  const [newPlanFeatures, setNewPlanFeatures] = useState('Característica 1, Característica 2');

  if (!isOpen) return null;

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const u = adminUsername.trim().toLowerCase();
    const p = adminPassword.trim();
    if ((u === 'luisrojas' || u === 'luis' || u === 'luisarturogarciarojas@gmail.com') && (p === '12345678' || p === 'admin')) {
      setIsAuthenticated(true);
    } else {
      setAuthError('Credenciales incorrectas. Recuerda: Usuario: Luisrojas | Clave: 12345678');
    }
  };

  const autofillCredentials = () => {
    setAdminUsername('Luisrojas');
    setAdminPassword('12345678');
    setAuthError('');
  };

  const startEditPlan = (plan: MonetizationPlan) => {
    setEditingPlanId(plan.id);
    setEditPlanName(plan.name);
    setEditPlanPrice(plan.price);
    setEditPlanDiscount(plan.discount);
    setEditPlanFreq(plan.frequency);
  };

  const saveEditedPlan = (planId: string) => {
    const existing = plans.find(p => p.id === planId);
    if (existing) {
      onUpdatePlan({
        ...existing,
        name: editPlanName,
        price: Number(editPlanPrice),
        discount: Number(editPlanDiscount),
        frequency: editPlanFreq,
      });
    }
    setEditingPlanId(null);
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName) return;

    const newPlan: MonetizationPlan = {
      id: `plan-${Date.now()}`,
      name: newPlanName,
      price: Number(newPlanPrice),
      discount: Number(newPlanDiscount),
      frequency: newPlanFreq,
      features: newPlanFeatures.split(',').map(f => f.trim()).filter(Boolean),
    };

    onAddPlan(newPlan);
    setNewPlanName('');
    setNewPlanPrice(4.99);
    setNewPlanDiscount(10);
    setNewPlanFreq('mes');
    setNewPlanFeatures('Nueva función 1, Sabor VIP 2');
    setShowAddPlanForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-blue-50">
        
        {/* Header bar of admin modal */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white">Panel Administrativo</h3>
              <p className="text-[10px] text-slate-400 font-mono">Acceso Exclusivo: Luis</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:bg-white/20 active:scale-95 transition-all"
            id="btn-close-admin"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isAuthenticated ? (
          /* AUTH LOGIN SCREEN */
          <div className="p-6 flex-grow flex flex-col justify-center">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-500 mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Ingresa tus credenciales de propietario para desbloquear las facultades de administración de planes y control de usuarios.
              </p>
            </div>

            {authError && (
              <div className="mb-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 p-2.5 rounded text-xs animate-shake">
                {authError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">USUARIO ADMINISTRADOR</label>
                <input
                  type="text"
                  required
                  placeholder=""
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">CONTRASEÑA DE SEGURIDAD</label>
                <input
                  type="password"
                  required
                  placeholder="Contraseña"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl active:scale-[0.98] transition-all cursor-pointer shadow-md"
              >
                Autenticar Propietario
              </button>

              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-center space-y-1.5">
                <p className="text-[10.5px] font-bold text-indigo-900">
                  Recordatorio de Claves de Luis:
                </p>
                <div className="text-[11px] font-mono text-slate-700 font-bold flex justify-center gap-3">
                  <span>Usuario: <strong className="text-indigo-600 font-black">Luisrojas</strong></span>
                  <span>•</span>
                  <span>Clave: <strong className="text-indigo-600 font-black">12345678</strong></span>
                </div>
                <button
                  type="button"
                  onClick={autofillCredentials}
                  className="mt-1 px-3 py-1 bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer"
                >
                  Autocompletar mis datos
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ADMIN WORKSPACE PANEL */
          <div className="flex flex-col flex-grow overflow-hidden">
            {/* Nav within Admin Panel */}
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setActiveTab('users')}
                className={`flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                  activeTab === 'users' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                Control de Usuarios
              </button>
              <button
                onClick={() => setActiveTab('plans')}
                className={`flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                  activeTab === 'plans' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Coins className="w-4 h-4" />
                Monetización y Planes
              </button>
            </div>

            <div className="p-4 flex-grow overflow-y-auto">
              {activeTab === 'users' ? (
                /* TAB 1: USER ACCOUNT MGT */
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Lista de Clientes Registrados ({usersList.length})
                    </h4>
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                      Datos Aislados
                    </span>
                  </div>

                  <div className="space-y-2">
                    {usersList.map((user) => (
                      <div 
                        key={user.email}
                        className={`p-3 rounded-2xl border transition-all ${
                          user.status === 'blocked' 
                            ? 'bg-rose-50 border-rose-100 text-rose-900' 
                            : 'bg-slate-50 border-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-xs flex items-center gap-1.5">
                              {user.name}
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                user.plan === 'premium' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {user.plan === 'premium' ? '★ Premium' : 'Básico'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{user.email}</div>
                          </div>

                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            user.status === 'blocked' ? 'bg-rose-600 text-white' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {user.status === 'blocked' ? 'VETADO' : 'Activo'}
                          </span>
                        </div>

                        {/* Actions row */}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-200/50 pt-2 text-[10px]">
                          <div className="flex items-center gap-1 text-slate-500">
                            <span>Suscripción:</span>
                            <button
                              onClick={() => onUpdateUserPlan(user.email, user.plan === 'premium' ? 'basic' : 'premium')}
                              className="text-blue-600 font-bold hover:underline underline-offset-2 flex items-center gap-1 ml-1"
                            >
                              Cambiar a {user.plan === 'premium' ? 'Plan Básico' : '★ Premium'}
                            </button>
                          </div>

                          <div>
                            {user.status === 'blocked' ? (
                              <button
                                onClick={() => onUnbanUser(user.email)}
                                className="text-emerald-600 font-bold hover:underline"
                              >
                                Quitar Veto
                              </button>
                            ) : (
                              <button
                                onClick={() => onBanUser(user.email)}
                                className="text-rose-600 font-bold hover:underline flex items-center gap-1"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Vetar / Bloquear
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* TAB 2: PRICING PLANS MGT */
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wilder">
                      Planes Activos ({plans.length})
                    </h4>
                    {!showAddPlanForm && (
                      <button
                        onClick={() => setShowAddPlanForm(true)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Añadir Plan
                      </button>
                    )}
                  </div>

                  {/* Add Plan Form Toggle */}
                  {showAddPlanForm && (
                    <form onSubmit={handleCreatePlan} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                        <span className="font-bold text-slate-700">Registrar Nuevo Plan</span>
                        <button 
                          type="button" 
                          onClick={() => setShowAddPlanForm(false)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          Cancelar
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">NOMBRE</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. Plan Ultra"
                            value={newPlanName}
                            onChange={(e) => setNewPlanName(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">PRECIO ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="9.99"
                            value={newPlanPrice}
                            onChange={(e) => setNewPlanPrice(Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-slate-700"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">DESCUENTO (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            required
                            placeholder="15"
                            value={newPlanDiscount}
                            onChange={(e) => setNewPlanDiscount(Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">FRECUENCIA</label>
                          <select
                            value={newPlanFreq}
                            onChange={(e) => setNewPlanFreq(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-slate-750 bg-white"
                          >
                            <option value="mes">Mensual</option>
                            <option value="año">Anual</option>
                            <option value="único">Pago Único</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold mb-1">CARACTERÍSTICAS (Separadas por coma)</label>
                        <textarea
                          rows={2}
                          placeholder="Ej: Impresión tickets, Estadísticas, Inventario VIP"
                          value={newPlanFeatures}
                          onChange={(e) => setNewPlanFeatures(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-slate-700 text-xs"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-xs"
                      >
                        Crear y Activar Plan
                      </button>
                    </form>
                  )}

                  {/* List of Plans with Edit Options */}
                  <div className="space-y-3">
                    {plans.map((p) => (
                      <div key={p.id} className="bg-slate-50 border border-slate-150 p-4 rounded-2xl">
                        {editingPlanId === p.id ? (
                          /* EDIT SUBFORM */
                          <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[9px] text-slate-400 font-bold mb-0.5">Nombre de Plan</label>
                                <input
                                  type="text"
                                  value={editPlanName}
                                  onChange={(e) => setEditPlanName(e.target.value)}
                                  className="w-full px-2.5 py-1 border border-slate-350 rounded bg-white text-slate-800 font-semibold"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-400 font-bold mb-0.5">Precio ($ / {editPlanFreq})</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editPlanPrice}
                                  onChange={(e) => setEditPlanPrice(Number(e.target.value))}
                                  className="w-full px-2.5 py-1 border border-slate-350 rounded bg-white text-slate-800 font-semibold"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[9px] text-slate-400 font-bold mb-0.5">Descuento (%)</label>
                                <input
                                  type="number"
                                  value={editPlanDiscount}
                                  onChange={(e) => setEditPlanDiscount(Number(e.target.value))}
                                  className="w-full px-2.5 py-1 border border-slate-350 rounded bg-white text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-400 font-bold mb-0.5">Frecuencia</label>
                                <select
                                  value={editPlanFreq}
                                  onChange={(e) => setEditPlanFreq(e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-350 rounded bg-white text-slate-800"
                                >
                                  <option value="mes">Mensual</option>
                                  <option value="año">Anual</option>
                                  <option value="único">Pago Único</option>
                                </select>
                              </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-1">
                              <button
                                onClick={() => setEditingPlanId(null)}
                                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg text-[10px]"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => saveEditedPlan(p.id)}
                                className="px-3 py-1 bg-blue-600 text-white font-medium rounded-lg text-[10px] flex items-center gap-1"
                              >
                                <Save className="w-3.5 h-3.5" />
                                Guardar
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* STANDARD DISPLAY */
                          <div>
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                                  {p.name}
                                  {p.discount > 0 && (
                                    <span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
                                      {p.discount}% Desc
                                    </span>
                                  )}
                                </h5>
                                <p className="text-slate-500 font-semibold text-xs mt-0.5">
                                  ${p.price} <span className="text-[10px] text-slate-400">/ {p.frequency}</span>
                                </p>
                              </div>

                              <div className="flex gap-1">
                                <button
                                  onClick={() => startEditPlan(p)}
                                  className="w-7 h-7 bg-slate-200 text-slate-650 hover:bg-slate-300 rounded-lg flex items-center justify-center transition-all"
                                  title="Editar Plan"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {p.id !== 'plan-basic' && p.id !== 'plan-premium' && (
                                  <button
                                    onClick={() => onDeletePlan(p.id)}
                                    className="w-7 h-7 bg-red-150 text-red-650 hover:bg-red-200 rounded-lg flex items-center justify-center transition-all"
                                    title="Eliminar Plan"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <ul className="mt-2.5 space-y-1 pl-1 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                              {p.features?.map((f, i) => (
                                <li key={i} className="flex items-center gap-1">
                                  <span className="text-blue-500">✓</span> {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
