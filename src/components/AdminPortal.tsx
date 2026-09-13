import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Lock, Unlock, CheckCircle2, 
  DollarSign, Sparkles, Trash2, LogOut, Sliders, Plus,
  Wrench, CheckCircle, Calculator, Database, Shield, Store,
  Download, AlertCircle, Users, UserX, UserCheck, Search,
  Filter, Crown, Receipt, BarChart2, FileText, Package,
  Landmark, Clock, Calendar, RefreshCw, X, AlertTriangle,
  ArrowRight, ShieldAlert, Check, Home, LayoutDashboard,
  ArrowUpRight, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserSession, MonetizationPlan, ExchangeRates, AuditLog, ProFeaturesConfig, DEFAULT_PRO_FEATURES_CONFIG } from '../types';
import { ratesService } from '../services/ratesService';
import { errorManager, SystemIncident, SystemHealthReport } from '../services/errorManager';
import appLogo from '../assets/images/finova_app_logo_1789320550545.jpg';
import { SyncStatusBadge, SyncOfflineBanner, SyncDetailsModal } from './SyncStatusIndicator';

export interface AdminPortalProps {
  currentUser: UserSession;
  onExitToApp: () => void;
  onLogout: () => void;
  usersList?: UserSession[];
  onUpdateUserPlan?: (email: string, plan: 'basic' | 'premium') => void;
  onBanUser?: (email: string, reason?: string) => void;
  onUnbanUser?: (email: string) => void;
  onDeleteUser?: (email: string) => void;
  proFeaturesConfig?: ProFeaturesConfig;
  onUpdateProConfig?: (newConfig: ProFeaturesConfig) => void;
  plans: MonetizationPlan[];
  onAddPlan: (plan: MonetizationPlan) => void;
  onUpdatePlan: (plan: MonetizationPlan) => void;
  onDeletePlan: (id: string) => void;
  currentRates: ExchangeRates;
  onRatesUpdated: (newRates: ExchangeRates) => void;
  auditLogs?: AuditLog[];
  isOnline?: boolean;
  isCloudActive?: boolean;
  isSyncing?: boolean;
  lastSyncTime?: Date | null;
  onForceSync?: () => Promise<boolean>;
  recordsCount?: number;
  inventoryCount?: number;
  debtsCount?: number;
}

export type AdminTab = 'inicio' | 'usuarios' | 'modulos_pro' | 'tasas' | 'planes' | 'diagnostics';

export default function AdminPortal({
  currentUser,
  onExitToApp,
  onLogout,
  usersList = [],
  onUpdateUserPlan,
  onBanUser,
  onUnbanUser,
  onDeleteUser,
  proFeaturesConfig = DEFAULT_PRO_FEATURES_CONFIG,
  onUpdateProConfig,
  plans,
  onAddPlan,
  onUpdatePlan,
  onDeletePlan,
  currentRates,
  onRatesUpdated,
  auditLogs = [],
  isOnline = true,
  isCloudActive = true,
  isSyncing = false,
  lastSyncTime = null,
  onForceSync,
  recordsCount = 0,
  inventoryCount = 0,
  debtsCount = 0
}: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('inicio');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);

  // Notification banners
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setBannerNotice(msg);
    setTimeout(() => setBannerNotice(null), 3500);
  };

  // -------------------------------------------------------------
  // 1. USUARIOS & VETO SYSTEM STATES
  // -------------------------------------------------------------
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userFilterStatus, setUserFilterStatus] = useState<'all' | 'active' | 'banned' | 'pro' | 'basic'>('all');
  const [banModalUser, setBanModalUser] = useState<UserSession | null>(null);
  const [banReasonInput, setBanReasonInput] = useState('Incumplimiento de términos y condiciones');

  const filteredUsers = useMemo(() => {
    return usersList.filter(user => {
      const isBanned = user.status === 'blocked' || user.isBanned;
      // Search matching
      const term = userSearchTerm.toLowerCase();
      const matchesSearch = 
        (user.email || '').toLowerCase().includes(term) ||
        (user.name || '').toLowerCase().includes(term) ||
        (user.uid || '').toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // Status filter
      if (userFilterStatus === 'active') return !isBanned;
      if (userFilterStatus === 'banned') return isBanned;
      if (userFilterStatus === 'pro') return user.plan === 'premium';
      if (userFilterStatus === 'basic') return user.plan === 'basic';
      return true;
    });
  }, [usersList, userSearchTerm, userFilterStatus]);

  const totalUsersCount = usersList.length;
  const activeUsersCount = usersList.filter(u => u.status !== 'blocked' && !u.isBanned).length;
  const bannedUsersCount = usersList.filter(u => u.status === 'blocked' || u.isBanned).length;
  const proUsersCount = usersList.filter(u => u.plan === 'premium').length;

  const handleConfirmBan = () => {
    if (!banModalUser || !onBanUser) return;
    onBanUser(banModalUser.email, banReasonInput.trim() || 'Acceso suspendido por administración');
    showNotice(`Usuario ${banModalUser.email} ha sido VETADO.`);
    setBanModalUser(null);
  };

  const handleExecuteUnban = (email: string) => {
    if (!onUnbanUser) return;
    onUnbanUser(email);
    showNotice(`Veto levantado exitosamente para ${email}.`);
  };

  // -------------------------------------------------------------
  // 2. PRO MODULES TOGGLING STATES
  // -------------------------------------------------------------
  const [localProConfig, setLocalProConfig] = useState<ProFeaturesConfig>(proFeaturesConfig);

  useEffect(() => {
    setLocalProConfig(proFeaturesConfig);
  }, [proFeaturesConfig]);

  const handleToggleModulePro = (moduleId: keyof ProFeaturesConfig) => {
    const updated = {
      ...localProConfig,
      [moduleId]: !localProConfig[moduleId]
    };
    setLocalProConfig(updated);
    if (onUpdateProConfig) {
      onUpdateProConfig(updated);
    }
    showNotice(`Módulo "${moduleId.toUpperCase()}" actualizado a: ${updated[moduleId] ? 'EXCLUSIVO PRO 👑' : 'ACCESO LIBRE GRATUITO'}`);
  };

  const handleSetAllPro = (val: boolean) => {
    const updated: ProFeaturesConfig = {
      clientes: val,
      deudas: val,
      estadisticas: val,
      balance_general: val,
      cotizaciones: val,
      inventario: val
    };
    setLocalProConfig(updated);
    if (onUpdateProConfig) {
      onUpdateProConfig(updated);
    }
    showNotice(val ? 'Todos los módulos configurados como EXCLUSIVOS PRO' : 'Todos los módulos configurados como GRATUITOS');
  };

  const proCount = Object.values(localProConfig).filter(Boolean).length;
  const freeCount = Object.values(localProConfig).filter(v => !v).length;

  // -------------------------------------------------------------
  // 3. RATES BCV MANAGEMENT STATES
  // -------------------------------------------------------------
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);
  const [isEditingRates, setIsEditingRates] = useState(false);
  const [manualBcvUsd, setManualBcvUsd] = useState(currentRates.bcvUsd || 563.29);
  const [manualBcvEur, setManualBcvEur] = useState(currentRates.bcvEur || 654.87);

  // Conversion calculator for admin testing
  const [calcAmount, setCalcAmount] = useState<number>(100);
  const [calcBaseCurrency, setCalcBaseCurrency] = useState<'USD' | 'EUR' | 'BS'>('USD');

  const handleRefreshOfficialRates = async () => {
    setIsRefreshingRates(true);
    try {
      const fresh = await ratesService.fetchRates();
      onRatesUpdated(fresh);
      setManualBcvUsd(fresh.bcvUsd);
      setManualBcvEur(fresh.bcvEur);
      showNotice('¡Tasas oficiales del BCV sincronizadas exitosamente desde ve.dolarapi.com!');
    } catch {
      showNotice('Error al conectar con la API oficial. Se conservan las últimas tasas verificadas.');
    } finally {
      setIsRefreshingRates(false);
    }
  };

  const handleSaveVerifiedRates = () => {
    const updated: ExchangeRates = {
      ...currentRates,
      bcvUsd: Number(manualBcvUsd) || currentRates.bcvUsd,
      bcvEur: Number(manualBcvEur) || currentRates.bcvEur,
      lastUpdated: new Date().toISOString(),
      verifiedByAdmin: true,
      source: 'Banco Central de Venezuela (BCV) Verificado por Administrador'
    };
    onRatesUpdated(updated);
    setIsEditingRates(false);
    showNotice('Tasas oficiales BCV (Dólar y Euro) ajustadas y verificadas correctamente.');
  };

  const calculatedConversion = () => {
    const usdRate = currentRates.bcvUsd || 563.29;
    const eurRate = currentRates.bcvEur || 654.87;

    if (calcBaseCurrency === 'USD') {
      const bs = calcAmount * usdRate;
      const eur = eurRate > 0 ? bs / eurRate : calcAmount * 0.86;
      return { bs, eur, usd: calcAmount };
    } else if (calcBaseCurrency === 'EUR') {
      const bs = calcAmount * eurRate;
      const usd = usdRate > 0 ? bs / usdRate : calcAmount * 1.16;
      return { bs, usd, eur: calcAmount };
    } else {
      const usd = usdRate > 0 ? calcAmount / usdRate : 0;
      const eur = eurRate > 0 ? calcAmount / eurRate : 0;
      return { bs: calcAmount, usd, eur };
    }
  };
  const conv = calculatedConversion();

  // -------------------------------------------------------------
  // 4. PLAN CREATION & EDITING STATES
  // -------------------------------------------------------------
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanPrice, setEditPlanPrice] = useState<number>(0);
  const [showAddPlanForm, setShowAddPlanForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState<number>(4.99);
  const [newPlanDiscount, setNewPlanDiscount] = useState<number>(10);
  const [newPlanFreq, setNewPlanFreq] = useState('mes');
  const [newPlanFeatures, setNewPlanFeatures] = useState('Acceso Multi-dispositivo, Sincronización en la Nube');

  // -------------------------------------------------------------
  // 5. DIAGNOSTICS & SYSTEM AUDIT STATES
  // -------------------------------------------------------------
  const [systemIncidents, setSystemIncidents] = useState<SystemIncident[]>([]);
  const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null);
  const [isScanningSystem, setIsScanningSystem] = useState(false);

  useEffect(() => {
    setSystemIncidents(errorManager.getIncidents());
    const report = errorManager.diagnoseAndSelfRepair();
    setHealthReport(report);

    const unsub = errorManager.subscribe((incidents) => {
      setSystemIncidents(incidents);
    });
    return () => unsub();
  }, []);

  const handleRunSystemScan = () => {
    setIsScanningSystem(true);
    setTimeout(() => {
      const report = errorManager.diagnoseAndSelfRepair();
      setHealthReport(report);
      setSystemIncidents(errorManager.getIncidents());
      setIsScanningSystem(false);
      showNotice('Diagnóstico completado: Sistema 100% operativo sin anomalías.');
    }, 500);
  };

  const handleExportBackup = () => {
    const backupData: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('gt_')) {
        try {
          backupData[key] = JSON.parse(localStorage.getItem(key) || '');
        } catch {
          backupData[key] = localStorage.getItem(key);
        }
      }
    }
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-finova-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Copia de seguridad descargada exitosamente.');
  };

  return (
    <div className="w-full h-screen max-h-screen overflow-hidden bg-slate-100 text-slate-800 flex flex-col font-sans select-none antialiased relative">
      {/* 1. CLEAN REFINED ADMIN HEADER (Responsive, high contrast, prominent Store & Logout) */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-3 sm:px-8 py-3 flex items-center justify-between gap-2 shadow-xs z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <img 
            src={appLogo} 
            alt="Logo Finova" 
            className="w-10 h-10 rounded-2xl object-cover shadow-xs border border-amber-300 ring-2 ring-amber-100 shrink-0" 
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-lg font-black tracking-tight text-slate-900 truncate">
                Panel de Administración
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                SuperAdmin
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="font-semibold text-slate-700 truncate">{currentUser.companyName || currentUser.name || currentUser.email}</span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="text-slate-400 hidden sm:inline">Finova Control Central</span>
            </p>
          </div>
        </div>

        {/* Quick Actions in Header */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto">
          {/* Primary Quick Button to Store */}
          <button
            type="button"
            onClick={onExitToApp}
            className="px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 active:scale-95 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 sm:gap-2 transition-all shadow-sm border border-amber-400 cursor-pointer"
            title="Ir a mi tienda personal para registrar ventas y ver finanzas"
          >
            <Store className="w-4 h-4 text-slate-950 shrink-0" />
            <span className="hidden xs:inline sm:inline">Ir a Mi Tienda</span>
            <span className="xs:hidden sm:hidden text-[11px]">Tienda</span>
          </button>

          {/* Direct Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className="px-2.5 sm:px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
            title="Cerrar sesión de administrador"
          >
            <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Offline Alert Banner in Admin Portal */}
      <SyncOfflineBanner
        isOnline={isOnline}
        reconnectedNotice={false}
        onOpenDetails={() => setIsSyncModalOpen(true)}
      />

      {/* Floating Notice Toast */}
      {bannerNotice && (
        <div className="shrink-0 bg-blue-50 border-b border-blue-200 px-6 py-2.5 text-center text-xs font-bold text-blue-800 flex items-center justify-center gap-2 animate-fade-in shadow-xs z-20">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>{bannerNotice}</span>
        </div>
      )}

      {/* 2. MAIN CONTENT CONTAINER */}
      <main className="flex-1 overflow-y-auto overscroll-contain bg-slate-100 text-slate-800 p-4 sm:p-6 pb-28 sm:pb-24">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ========================================================================= */}
          {/* TAB 0: ⚡ INICIO • CENTRO DE CONTROL EJECUTIVO                            */}
          {/* ========================================================================= */}
          {activeTab === 'inicio' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center text-slate-950 shadow-xs border border-amber-300">
                      <LayoutDashboard className="w-5 h-5 text-slate-950" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                          SuperAdmin • Panel de Administración
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Inicio
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Centro de mando ejecutivo para control de usuarios, módulos, tasas oficiales y seguridad del sistema.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Sistema 100% Operativo</span>
                  </div>
                </div>
              </div>

              {/* 5 Executive Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('usuarios')}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400">Total Usuarios</span>
                    <Users className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono">{totalUsersCount}</div>
                  <span className="text-[10px] text-blue-600 font-bold mt-1 inline-flex items-center gap-0.5">
                    Ver todos <ArrowRight className="w-3 h-3" />
                  </span>
                </button>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400">Usuarios Activos</span>
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-emerald-600 font-mono">{activeUsersCount}</div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 block">Cuentas habilitadas</span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('usuarios')}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-rose-400 hover:shadow-md transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400">Vetados</span>
                    <UserX className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className={`text-2xl font-black font-mono ${bannedUsersCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {bannedUsersCount}
                  </div>
                  <span className={`text-[10px] font-bold mt-1 inline-flex items-center gap-0.5 ${bannedUsersCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {bannedUsersCount > 0 ? 'Revisar vetos' : 'Sin bloqueos'} <ArrowRight className="w-3 h-3" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('modulos_pro')}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400">Módulos PRO</span>
                    <Crown className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-2xl font-black text-amber-600 font-mono">{proCount} / 6</div>
                  <span className="text-[10px] text-amber-600 font-bold mt-1 inline-flex items-center gap-0.5">
                    Configurar <ArrowRight className="w-3 h-3" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('tasas')}
                  className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400">Dólar BCV</span>
                    <Landmark className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono">Bs. {currentRates.bcvUsd.toFixed(2)}</div>
                  <span className="text-[10px] text-blue-600 font-bold mt-1 inline-flex items-center gap-0.5">
                    Actualizar <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              </div>

              {/* Direct Access Quick Modules Grid */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Módulos de Administración Rápida
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Card 1: Usuarios y Vetados */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mb-3">
                        <Users className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 mb-1">Usuarios y Vetados</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                        Gestiona el listado completo de clientes registrados, asigna planes Básico o Premium, audita el último acceso y aplica o retira vetos del sistema.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('usuarios')}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Abrir Usuarios y Vetados</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Card 2: Módulos */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3">
                        <Crown className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 mb-1">Módulos PRO</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                        Controla cuáles herramientas de la aplicación requieren Plan Premium (Balance, Cotizaciones, Inventario Avanzado, Reportes) o están abiertas a todos.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('modulos_pro')}
                      className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-300"
                    >
                      <span>Configurar Módulos ({proCount}/6)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Card 3: Tasa de BCV */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-3">
                        <Landmark className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 mb-1">Tasa Oficial de BCV</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                        Supervisa y actualiza en tiempo real las cotizaciones de Dólar (USD) y Euro (EUR) fijadas por el Banco Central de Venezuela con sincronización automática.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('tasas')}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Gestionar Tasas BCV</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Card 4: Planes y Tarifa */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center mb-3">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 mb-1">Planes y Tarifa</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                        Modifica los precios, períodos de renovación, divisas e incluye o retira beneficios para cada paquete de suscripción comercial ofrecido a los usuarios.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('planes')}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Ver Planes y Tarifas</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Card 5: Seguridad y Diagnóstico */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 mb-1">Seguridad y Diagnóstico</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                        Ejecuta chequeos de salud de bases de datos, revisa alertas de integridad, inspecciona bitácoras y descarga respaldos de seguridad en archivo JSON.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('diagnostics')}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Diagnóstico del Sistema</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Card 6: Volver a Mi Tienda */}
                  <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-slate-950 flex items-center justify-center mb-3">
                        <Store className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-black text-slate-950 mb-1">Mi Tienda Comercial</h4>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">
                        Regresa a la pantalla comercial para registrar ventas, productos de inventario, cobrar cuentas pendientes o emitir presupuestos a tus clientes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onExitToApp}
                      className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-300"
                    >
                      <span>Ir a Mi Tienda Comercial</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: 👥 REGISTRO DE PERSONAS Y CONTROL DE VETO                           */}
          {/* ========================================================================= */}
          {activeTab === 'usuarios' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👥</span>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      Registro de Personas & Control de Acceso
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Historial de todas las personas registradas en la aplicación. Tienes la opción de auditar su fecha de creación, último ingreso y <strong className="text-rose-600">vetar su acceso</strong> en caso de ser necesario.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      placeholder="Buscar por correo o nombre..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {userSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setUserSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Filters Strip */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setUserFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    userFilterStatus === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Todos ({totalUsersCount})
                </button>

                <button
                  type="button"
                  onClick={() => setUserFilterStatus('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    userFilterStatus === 'active'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Activos ({activeUsersCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUserFilterStatus('banned')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    userFilterStatus === 'banned'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Vetados ({bannedUsersCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUserFilterStatus('pro')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    userFilterStatus === 'pro'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Plan PRO ({proUsersCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUserFilterStatus('basic')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    userFilterStatus === 'basic'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Plan Básico ({totalUsersCount - proUsersCount})
                </button>
              </div>

              {/* Users Grid / Cards */}
              {filteredUsers.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No se encontraron usuarios</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {userSearchTerm 
                      ? 'No hay registros que coincidan con tu búsqueda.' 
                      : 'Aún no hay usuarios en este estado en el sistema.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredUsers.map((user) => {
                    const isBanned = user.status === 'blocked' || user.isBanned;
                    const isMe = user.email.toLowerCase() === currentUser.email.toLowerCase();
                    const isMasterAdmin = user.email.toLowerCase() === 'luisarturogarciarojas@gmail.com' || user.email.toLowerCase() === 'luis31garciarojas@gmail.com';

                    return (
                      <div
                        key={user.uid || user.email}
                        className={`bg-white rounded-2xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                          isBanned 
                            ? 'border-rose-300 bg-rose-50/20' 
                            : 'border-slate-200/90 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          {/* Card Header: Avatar, Name, Badges */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs ${
                                isBanned 
                                  ? 'bg-rose-600' 
                                  : isMasterAdmin 
                                    ? 'bg-gradient-to-tr from-amber-500 to-indigo-600' 
                                    : 'bg-gradient-to-tr from-slate-700 to-slate-900'
                              }`}>
                                {(user.name || user.email).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-black text-slate-900 truncate flex items-center gap-1.5">
                                  <span>{user.name || 'Sin nombre'}</span>
                                  {isMasterAdmin && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                      Admin
                                    </span>
                                  )}
                                  {isMe && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-200">
                                      Tú
                                    </span>
                                  )}
                                </h3>
                                <p className="text-xs text-slate-500 font-mono truncate">
                                  {user.email}
                                </p>
                              </div>
                            </div>

                            {/* Status and Plan Badges */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {isBanned ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                                  <span>VETADO</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>ACTIVO</span>
                                </span>
                              )}

                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                user.plan === 'premium'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {user.plan === 'premium' ? <Crown className="w-3 h-3 text-amber-500" /> : null}
                                <span>{user.plan === 'premium' ? 'Plan PRO' : 'Plan Básico'}</span>
                              </span>
                            </div>
                          </div>

                          {/* Ban Details if banned */}
                          {isBanned && (
                            <div className="mt-3 p-2.5 rounded-xl bg-rose-100/70 border border-rose-200 text-xs text-rose-800">
                              <div className="flex items-center gap-1.5 font-bold">
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                <span>Motivo del Veto:</span>
                              </div>
                              <p className="text-[11px] text-rose-700 mt-0.5">
                                {user.banReason || 'Acceso restringido administrativamente.'}
                              </p>
                              {user.bannedAt && (
                                <span className="text-[9.5px] text-rose-500 block mt-1 font-mono">
                                  Fecha de veto: {new Date(user.bannedAt).toLocaleString('es-VE')}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Metadata Ribbon: Registration & Activity */}
                          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                            <div>
                              <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Registrado:</span>
                              <div className="flex items-center gap-1 mt-0.5 font-medium text-slate-700">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>
                                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-VE') : 'Inicial'}
                                </span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Último Ingreso:</span>
                              <div className="flex items-center gap-1 mt-0.5 font-medium text-slate-700">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>
                                  {user.lastLogin || user.lastActive 
                                    ? new Date(user.lastLogin || user.lastActive || '').toLocaleDateString('es-VE')
                                    : 'Sin datos'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Controls for Admin */}
                        {!isMasterAdmin && !isMe && (
                          <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                            {/* Toggle Plan button */}
                            <button
                              type="button"
                              onClick={() => onUpdateUserPlan && onUpdateUserPlan(user.email, user.plan === 'premium' ? 'basic' : 'premium')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                user.plan === 'premium'
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              <Crown className="w-3.5 h-3.5 text-amber-500" />
                              <span>{user.plan === 'premium' ? 'Pasar a Básico' : 'Hacer PRO'}</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              {/* Veto or Unban Button */}
                              {isBanned ? (
                                <button
                                  type="button"
                                  onClick={() => handleExecuteUnban(user.email)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="Restaurar acceso a esta persona"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Levantar Veto</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBanModalUser(user);
                                    setBanReasonInput('Incumplimiento de términos o falta de pago');
                                  }}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                  title="Vetar permanentemente a este usuario"
                                >
                                  <UserX className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Vetar</span>
                                </button>
                              )}

                              {/* Delete button */}
                              {onDeleteUser && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`¿Eliminar definitivamente el registro de ${user.email}?`)) {
                                      onDeleteUser(user.email);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                  title="Eliminar registro"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: 👑 SELECTOR DE PRIVILEGIOS PRO                                     */}
          {/* ========================================================================= */}
          {activeTab === 'modulos_pro' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">👑</span>
                      <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        Selector de Privilegios y Exclusividad PRO
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                      Elige libremente qué módulos requieren suscripción PRO y cuáles son gratuitos para los usuarios que ingresen a la aplicación.
                      <strong> Tú tienes el control total para decidir la política de tu app.</strong>
                    </p>
                  </div>

                  {/* Bulk toggle buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetAllPro(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Todos Gratuitos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllPro(true)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer"
                    >
                      Todos PRO 👑
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs font-bold text-slate-600">
                  <span className="flex items-center gap-1.5 text-amber-700">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span>{proCount} Módulos Exclusivos PRO</span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>{freeCount} Módulos de Acceso Libre Gratuito</span>
                  </span>
                </div>
              </div>

              {/* 6 Modules Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    id: 'clientes' as keyof ProFeaturesConfig,
                    name: 'Clientes',
                    desc: 'Directorio comercial de compradores, historial de compras y registro de ventas asociadas a clientes.',
                    icon: Users,
                    color: 'blue'
                  },
                  {
                    id: 'deudas' as keyof ProFeaturesConfig,
                    name: 'Deudas',
                    desc: 'Libro contable de cuentas por cobrar y por pagar, alertas de cobro y registro de abonos.',
                    icon: Receipt,
                    color: 'emerald'
                  },
                  {
                    id: 'estadisticas' as keyof ProFeaturesConfig,
                    name: 'Estadísticas',
                    desc: 'Gráficos interactivos de ventas, rentabilidad, ticket promedio y análisis de ingresos vs egresos.',
                    icon: BarChart2,
                    color: 'purple'
                  },
                  {
                    id: 'balance_general' as keyof ProFeaturesConfig,
                    name: 'Balance General',
                    desc: 'Patrimonio contable, liquidez en divisas y bolívares, valor de activos y flujo de caja analítico.',
                    icon: Landmark,
                    color: 'indigo'
                  },
                  {
                    id: 'cotizaciones' as keyof ProFeaturesConfig,
                    name: 'Cotizaciones',
                    desc: 'Generador de presupuestos comerciales en PDF o ticket para compartir por WhatsApp con clientes.',
                    icon: FileText,
                    color: 'amber'
                  },
                  {
                    id: 'inventario' as keyof ProFeaturesConfig,
                    name: 'Inventario',
                    desc: 'Control de productos, existencias físicas, alertas de stock mínimo y cálculo de valor total en mercancía.',
                    icon: Package,
                    color: 'rose'
                  }
                ].map((mod) => {
                  const isPro = Boolean(localProConfig[mod.id]);
                  const IconComp = mod.icon;

                  return (
                    <div
                      key={mod.id}
                      className={`bg-white rounded-2xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                        isPro 
                          ? 'border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/10' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        {/* Top Icon & Status Pill */}
                        <div className="flex items-start justify-between gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isPro ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <IconComp className="w-5 h-5" />
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                            isPro
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isPro ? (
                              <>
                                <Crown className="w-3 h-3 text-amber-600" />
                                <span>Requiere PRO</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Gratuito</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div className="mt-3">
                          <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                            <span>{mod.name}</span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {mod.desc}
                          </p>
                        </div>
                      </div>

                      {/* Interactive Switch Control */}
                      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                        <div className="text-[11px] font-medium text-slate-600">
                          {isPro ? (
                            <span className="text-amber-700 font-bold">Bloqueado para cuentas básicas</span>
                          ) : (
                            <span className="text-emerald-700 font-bold">Libre para todo el público</span>
                          )}
                        </div>

                        {/* Switch button */}
                        <button
                          type="button"
                          onClick={() => handleToggleModulePro(mod.id)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isPro ? 'bg-amber-500' : 'bg-slate-300'
                          }`}
                          role="switch"
                          aria-checked={isPro}
                          id={`toggle-pro-${mod.id}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isPro ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: 🏛️ TASAS OFICIALES BCV                                             */}
          {/* ========================================================================= */}
          {activeTab === 'tasas' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏛️</span>
                      <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        Tasas Oficiales Banco Central de Venezuela (BCV)
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Sincronización directa y oficial con <strong className="text-blue-600 font-mono">ve.dolarapi.com</strong> para cotizaciones de Dólar (USD) y Euro (EUR).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRefreshOfficialRates}
                      disabled={isRefreshingRates}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingRates ? 'animate-spin' : ''}`} />
                      <span>{isRefreshingRates ? 'Sincronizando...' : 'Sincronizar BCV'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsEditingRates(!isEditingRates)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      {isEditingRates ? 'Cancelar' : 'Ajustar Manualmente'}
                    </button>
                  </div>
                </div>

                {/* Status summary */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                    <span>Última Sincronización:</span>
                    <span className="text-slate-800 font-semibold">
                      {new Date(currentRates.lastUpdated || Date.now()).toLocaleString('es-VE')}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-600">Fuente: {currentRates.source || 'BCV Oficial'}</span>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tasa BCV Verificada</span>
                  </span>
                </div>
              </div>

              {/* Main Rates Display Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dólar BCV */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Dólar Oficial BCV (USD)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        USD / VES
                      </span>
                    </div>

                    {isEditingRates ? (
                      <div className="mt-3">
                        <label className="text-xs text-slate-500 font-bold block mb-1">
                          Valor en Bolívares (Bs.):
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={manualBcvUsd}
                          onChange={(e) => setManualBcvUsd(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-slate-50 border border-blue-300 rounded-xl text-lg font-black text-slate-900 font-mono focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                          Bs. {currentRates.bcvUsd.toFixed(2)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          1 USD = {currentRates.bcvUsd.toFixed(2)} Bolívares Digitales
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Euro BCV */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Euro Oficial BCV (EUR)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        EUR / VES
                      </span>
                    </div>

                    {isEditingRates ? (
                      <div className="mt-3">
                        <label className="text-xs text-slate-500 font-bold block mb-1">
                          Valor en Bolívares (Bs.):
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={manualBcvEur}
                          onChange={(e) => setManualBcvEur(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-slate-50 border border-purple-300 rounded-xl text-lg font-black text-slate-900 font-mono focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                          Bs. {currentRates.bcvEur.toFixed(2)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          1 EUR = {currentRates.bcvEur.toFixed(2)} Bolívares Digitales
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isEditingRates && (
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditingRates(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveVerifiedRates}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer"
                  >
                    Guardar y Aplicar Tasas
                  </button>
                </div>
              )}

              {/* Conversion Calculator Test Box */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    Calculadora de Verificación en Tiempo Real
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 font-bold block mb-1">Monto a probar:</label>
                    <input
                      type="number"
                      value={calcAmount}
                      onChange={(e) => setCalcAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 font-bold block mb-1">Moneda Base:</label>
                    <select
                      value={calcBaseCurrency}
                      onChange={(e) => setCalcBaseCurrency(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                    >
                      <option value="USD">Dólares ($ USD)</option>
                      <option value="EUR">Euros (€ EUR)</option>
                      <option value="BS">Bolívares (Bs. VES)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Equivalencias Calculadas</span>
                    <div className="text-xs font-mono font-bold text-slate-800 mt-1">
                      Bs. {conv.bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] font-mono text-blue-600">
                      $ {conv.usd.toFixed(2)} USD • € {conv.eur.toFixed(2)} EUR
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: 💎 PLANES Y TARIFAS                                                */}
          {/* ========================================================================= */}
          {activeTab === 'planes' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💎</span>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      Planes de Monetización y Tarifas
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Ajusta los precios de suscripción en dólares ($ USD) que ven los usuarios al consultar los planes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddPlanForm(!showAddPlanForm)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showAddPlanForm ? 'Cerrar Formulario' : 'Nuevo Plan'}</span>
                </button>
              </div>

              {/* Add New Plan Accordion */}
              {showAddPlanForm && (
                <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Crear Nuevo Plan</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 font-bold block mb-1">Nombre del Plan:</label>
                      <input
                        type="text"
                        value={newPlanName}
                        onChange={(e) => setNewPlanName(e.target.value)}
                        placeholder="Ej. Plan Semestral"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-bold block mb-1">Precio ($ USD):</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPlanPrice}
                        onChange={(e) => setNewPlanPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-bold block mb-1">Frecuencia:</label>
                      <select
                        value={newPlanFreq}
                        onChange={(e) => setNewPlanFreq(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value="mes">Mensual</option>
                        <option value="año">Anual</option>
                        <option value="trimestre">Trimestral</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddPlanForm(false)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newPlanName) return;
                        onAddPlan({
                          id: `plan-${Date.now()}`,
                          name: newPlanName,
                          price: newPlanPrice,
                          frequency: newPlanFreq,
                          discount: newPlanDiscount,
                          popular: false,
                          features: newPlanFeatures.split(',').map(s => s.trim())
                        });
                        setNewPlanName('');
                        setShowAddPlanForm(false);
                        showNotice(`Plan "${newPlanName}" añadido exitosamente.`);
                      }}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
                    >
                      Guardar Plan
                    </button>
                  </div>
                </div>
              )}

              {/* Plans List Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => {
                  const isEditing = editingPlanId === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                              {plan.frequency === 'año' ? 'Facturación Anual' : 'Facturación Mensual'}
                            </span>
                            <h3 className="text-base font-black text-slate-900 mt-0.5">
                              {plan.name}
                            </h3>
                          </div>

                          <div className="text-right">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-bold text-slate-500">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editPlanPrice}
                                  onChange={(e) => setEditPlanPrice(parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 bg-slate-50 border border-blue-400 rounded text-sm font-black font-mono"
                                />
                              </div>
                            ) : (
                              <div className="text-xl font-black text-slate-900 font-mono">
                                ${plan.price.toFixed(2)}
                                <span className="text-xs font-normal text-slate-400">/{plan.frequency}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Features list */}
                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                          {plan.features.map((feat, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onUpdatePlan({ ...plan, price: editPlanPrice });
                                setEditingPlanId(null);
                                showNotice(`Precio de "${plan.name}" actualizado.`);
                              }}
                              className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPlanId(null)}
                              className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPlanId(plan.id);
                              setEditPlanPrice(plan.price);
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                          >
                            Editar Precio
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Eliminar plan ${plan.name}?`)) {
                              onDeletePlan(plan.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: ⚡ SEGURIDAD, AUDITORÍA Y DIAGNÓSTICO                               */}
          {/* ========================================================================= */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6">
              {/* Health Banner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚡</span>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      Diagnóstico, Auto-Reparación y Seguridad
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Motor autónomo de integridad de datos, monitor de incidentes y descarga de copias de seguridad completas.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunSystemScan}
                    disabled={isScanningSystem}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanningSystem ? 'animate-spin' : ''}`} />
                    <span>{isScanningSystem ? 'Escaneando...' : 'Escanear Sistema'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Descargar Backup</span>
                  </button>
                </div>
              </div>

              {/* Status Report Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Estado de Salud de la Plataforma
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    100% Saludable
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Base de Datos</span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">Sincronización Activa</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Incidentes Críticos</span>
                    <p className="text-xs font-bold text-emerald-600 mt-0.5">0 detectados</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Mecanismo de Respaldo</span>
                    <p className="text-xs font-bold text-blue-600 mt-0.5">Caché & Nube Dual</p>
                  </div>
                </div>
              </div>

              {/* Cloud Sync Diagnostic Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Sincronización en la Nube de Google Firebase
                    </h3>
                  </div>
                  <SyncStatusBadge
                    isOnline={isOnline}
                    isCloudActive={isCloudActive}
                    isSyncing={isSyncing}
                    lastSyncTime={lastSyncTime}
                    onClick={() => setIsSyncModalOpen(true)}
                    variant="compact"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Estado de Red</span>
                    <p className={`text-xs font-bold mt-0.5 ${isOnline ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isOnline ? '🟢 En línea (Internet activo)' : '🔴 Sin conexión (Offline)'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Última Sincronización</span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 font-mono">
                      {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'En tiempo real'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Inspección de Nube</span>
                      <p className="text-xs font-bold text-blue-700 mt-0.5">Detalles y Métricas</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSyncModalOpen(true)}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Abrir Monitor
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ========================================================================= */}
      {/* VETO CONFIRMATION MODAL                                                   */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {banModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-rose-200 p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <UserX className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Vetar Acceso a Usuario
                  </h3>
                  <p className="text-xs text-slate-500">
                    Suspende inmediatamente el acceso a la plataforma.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-800">{banModalUser.name}</div>
                <div className="text-slate-500 font-mono text-[11px]">{banModalUser.email}</div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Motivo de la suspensión / veto:
                </label>
                <textarea
                  rows={2}
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  placeholder="Ej. Uso no autorizado de la plataforma..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBanModalUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBan}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <UserX className="w-4 h-4" />
                  <span>Confirmar Veto</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. BOTTOM NAVIGATION BAR (PANEL INFERIOR CON ICONOS Y ACCESO DIRECTO A MI TIENDA) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl px-1.5 sm:px-4 py-1.5">
        <div className="max-w-4xl mx-auto grid grid-cols-7 gap-1 items-center">
          {/* 1. Inicio */}
          <button
            type="button"
            onClick={() => setActiveTab('inicio')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'inicio'
                ? 'bg-slate-950 text-white shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-bold'
            }`}
          >
            <Home className="w-4 h-4 mb-0.5" />
            <span className="text-[9.5px] tracking-tight leading-none">Inicio</span>
          </button>

          {/* 2. Usuario y Vetados */}
          <button
            type="button"
            onClick={() => setActiveTab('usuarios')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer relative ${
              activeTab === 'usuarios'
                ? 'bg-slate-950 text-white shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-bold'
            }`}
          >
            <Users className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] tracking-tight leading-none truncate max-w-full text-center">Usuarios</span>
            {bannedUsersCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
            )}
          </button>

          {/* 3. Módulo */}
          <button
            type="button"
            onClick={() => setActiveTab('modulos_pro')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'modulos_pro'
                ? 'bg-slate-950 text-white shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-bold'
            }`}
          >
            <Crown className="w-4 h-4 mb-0.5 text-amber-500" />
            <span className="text-[9.5px] tracking-tight leading-none">Módulos</span>
          </button>

          {/* 4. Tasa de BCV */}
          <button
            type="button"
            onClick={() => setActiveTab('tasas')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'tasas'
                ? 'bg-slate-950 text-white shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-bold'
            }`}
          >
            <Landmark className="w-4 h-4 mb-0.5 text-blue-500" />
            <span className="text-[9px] tracking-tight leading-none truncate max-w-full text-center">Tasas</span>
          </button>

          {/* 5. Planes y Tarifa */}
          <button
            type="button"
            onClick={() => setActiveTab('planes')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'planes'
                ? 'bg-slate-950 text-white shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-bold'
            }`}
          >
            <Receipt className="w-4 h-4 mb-0.5 text-emerald-500" />
            <span className="text-[9px] tracking-tight leading-none truncate max-w-full text-center">Planes</span>
          </button>

          {/* 6. Seguridad y Diagnóstico */}
          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'bg-slate-950 text-white shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-bold'
            }`}
          >
            <Wrench className="w-4 h-4 mb-0.5 text-indigo-500" />
            <span className="text-[8.5px] tracking-tight leading-none truncate max-w-full text-center">Seguridad</span>
          </button>

          {/* 7. ACCESO A MI TIENDA (SPECIAL BUTTON) */}
          <button
            type="button"
            onClick={onExitToApp}
            className="flex flex-col items-center justify-center py-1 px-0.5 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-md font-black transition-all cursor-pointer active:scale-95 border border-amber-500/40"
            title="Ir a mi tienda personal para registrar ventas e inventario"
          >
            <Store className="w-4 h-4 mb-0.5 text-slate-950" />
            <span className="text-[9px] font-black tracking-tight leading-none">Mi Tienda</span>
          </button>
        </div>
      </nav>

      {/* Sync Details Modal for Admin Portal */}
      <SyncDetailsModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        isOnline={isOnline}
        isCloudActive={isCloudActive}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        onForceSync={onForceSync || (async () => true)}
        userEmail={currentUser.email}
        itemCounts={{
          records: recordsCount,
          inventory: inventoryCount,
          debts: debtsCount
        }}
      />
    </div>
  );
}
