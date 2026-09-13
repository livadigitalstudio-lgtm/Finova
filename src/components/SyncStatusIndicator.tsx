import React, { useState } from 'react';
import { 
  Cloud, CloudOff, CloudCheck, RefreshCw, Wifi, WifiOff, 
  CheckCircle2, AlertTriangle, ShieldCheck, Database, HardDrive,
  X, ExternalLink, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface SyncStatusBadgeProps {
  isOnline: boolean;
  isCloudActive: boolean;
  isSyncing?: boolean;
  lastSyncTime?: Date | null;
  onClick?: () => void;
  variant?: 'desktop' | 'mobile' | 'compact';
  className?: string;
  theme?: 'light' | 'amber';
}

export function formatSyncTime(date: Date | null | undefined): string {
  if (!date) return 'Sin sincronizar aún';
  try {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return 'Reciente';
  }
}

export function formatRelativeSync(date: Date | null | undefined): string {
  if (!date) return 'Pendiente';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 15) return 'Hace un instante';
  if (diffSec < 60) return `Hace ${diffSec} seg`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  return formatSyncTime(date);
}

/**
 * SyncStatusBadge - Primary visual pill / badge for headers
 */
export function SyncStatusBadge({
  isOnline,
  isCloudActive,
  isSyncing = false,
  lastSyncTime,
  onClick,
  variant = 'desktop',
  className = '',
  theme = 'light'
}: SyncStatusBadgeProps) {
  // 1. Syncing state
  if (isSyncing) {
    if (variant === 'mobile') {
      return (
        <button
          type="button"
          onClick={onClick}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-[10.5px] font-black cursor-pointer transition-all ${
            theme === 'amber'
              ? 'bg-slate-950/15 text-slate-950 border border-slate-950/25'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          } ${className}`}
          title="Sincronizando cambios con la nube..."
        >
          <RefreshCw className="w-3 h-3 text-blue-600 animate-spin shrink-0" />
          <span className="truncate">Sincronizando...</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition-all shadow-xs cursor-pointer ${className}`}
        title="Sincronizando datos con la nube..."
      >
        <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
        <span className="font-black">Sincronizando nube</span>
      </button>
    );
  }

  // 2. Offline state (No internet)
  if (!isOnline) {
    if (variant === 'mobile') {
      return (
        <button
          type="button"
          onClick={onClick}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-[10.5px] font-black cursor-pointer transition-all shadow-xs bg-rose-600 text-white border border-rose-700 active:scale-95 animate-pulse ${className}`}
          title="Sin conexión a internet. Los registros se sincronizarán al reconectar."
        >
          <CloudOff className="w-3.5 h-3.5 text-white shrink-0" />
          <span className="truncate">Sin conexión</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold transition-all shadow-xs cursor-pointer group ${className}`}
        title="Sin conexión a internet. Los registros se sincronizarán automáticamente al reconectar."
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
        </span>
        <CloudOff className="w-3.5 h-3.5 text-rose-600 shrink-0 group-hover:scale-110 transition-transform" />
        <span className="font-black text-rose-900">Sin conexión</span>
      </button>
    );
  }

  // 3. Online & Cloud Active (Optimal state: Cloud backed in real-time)
  if (isCloudActive) {
    if (variant === 'mobile') {
      return (
        <button
          type="button"
          onClick={onClick}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-[10.5px] font-black cursor-pointer transition-all ${
            theme === 'amber'
              ? 'bg-slate-950/15 hover:bg-slate-950/20 text-slate-950 border border-slate-950/25 active:scale-95'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-xs'
          } ${className}`}
          title={`En línea • Sistema conectado (${formatRelativeSync(lastSyncTime)})`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse shrink-0"></span>
          <CloudCheck className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
          <span className="truncate">En línea</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/90 text-emerald-900 border border-emerald-200 text-xs font-bold transition-all shadow-xs cursor-pointer group ${className}`}
        title={`Sistema sincronizado en tiempo real. Última actualización: ${formatRelativeSync(lastSyncTime)}.`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
        </span>
        <CloudCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0 group-hover:scale-110 transition-transform" />
        <span className="font-black text-emerald-950">Sistema En Línea</span>
      </button>
    );
  }

  // 4. Online with Internal Auto-Sync Engine
  if (variant === 'mobile') {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all shadow-xs cursor-pointer ${className}`}
      title="Sistema en línea. Sincronización automática activa."
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
      <span className="font-bold">Sistema En Línea</span>
    </button>
  );
}

/**
 * SyncOfflineBanner - Displays immediate alert when disconnected or reconnected
 */
export interface SyncOfflineBannerProps {
  isOnline: boolean;
  reconnectedNotice: boolean;
  onOpenDetails: () => void;
  onDismissReconnected?: () => void;
}

export function SyncOfflineBanner({
  isOnline,
  reconnectedNotice,
  onOpenDetails,
  onDismissReconnected
}: SyncOfflineBannerProps) {
  if (reconnectedNotice) {
    return (
      <div className="shrink-0 bg-emerald-600 text-white px-4 py-2 shadow-xs flex items-center justify-between text-xs font-bold animate-fadeIn z-30">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-100 shrink-0" />
          <span className="truncate">
            ¡Conexión a internet restablecida! Tus datos están sincronizados en tiempo real con la nube.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button
            type="button"
            onClick={onOpenDetails}
            className="underline font-black text-xs hover:text-emerald-100 cursor-pointer"
          >
            Ver estado
          </button>
          {onDismissReconnected && (
            <button
              type="button"
              onClick={onDismissReconnected}
              className="p-1 text-white/80 hover:text-white rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="shrink-0 bg-rose-600 text-white px-4 py-2 shadow-xs flex items-center justify-between text-xs font-bold animate-fadeIn z-30">
        <div className="flex items-center gap-2 min-w-0">
          <CloudOff className="w-4 h-4 text-rose-200 shrink-0 animate-pulse" />
          <span className="truncate">
            Modo sin conexión activo: Tus operaciones se guardan de forma segura en este dispositivo y se subirán a la nube al reconectarte.
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenDetails}
          className="underline font-black text-xs hover:text-rose-100 shrink-0 ml-3 cursor-pointer"
        >
          Detalles de respaldo
        </button>
      </div>
    );
  }

  return null;
}

/**
 * SyncDetailsModal - Explains sync architecture, shows data counts, and lets user verify sync
 */
export interface SyncDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  isCloudActive: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  onForceSync: () => Promise<boolean>;
  userEmail?: string;
  itemCounts?: {
    records: number;
    inventory: number;
    debts: number;
  };
}

export function SyncDetailsModal({
  isOpen,
  onClose,
  isOnline,
  isCloudActive,
  isSyncing,
  lastSyncTime,
  onForceSync,
  userEmail = 'Usuario',
  itemCounts = { records: 0, inventory: 0, debts: 0 }
}: SyncDetailsModalProps) {
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  if (!isOpen) return null;

  const handleTestSync = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await onForceSync();
      if (ok) {
        setTestResult('¡Sincronización confirmada! Los datos están 100% al día con la nube.');
      } else {
        setTestResult('Se verificó el estado de la conexión local.');
      }
    } catch {
      setTestResult('No fue posible conectar con el servidor en este momento.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                Estado de Sincronización y Respaldo
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Monitoreo de seguridad y persistencia en la nube
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Status Hero Card */}
          {isOnline && isCloudActive ? (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <CloudCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-emerald-950">
                      Tus datos están respaldados en la nube
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-200 text-emerald-900">
                      En Línea
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed font-medium">
                    Cada venta, gasto, producto de inventario y cuenta por cobrar se sincroniza en tiempo real con los servidores seguros de Google Firebase.
                  </p>
                </div>
              </div>
            </div>
          ) : !isOnline ? (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <CloudOff className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-rose-950">
                      Modo Sin Conexión (Offline)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-200 text-rose-900">
                      Sin Internet
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 mt-0.5 leading-relaxed font-medium">
                    No tienes conexión en este momento. Puedes seguir utilizando la aplicación normalmente: todas tus transacciones se guardan en la memoria de tu dispositivo y se respaldarán automáticamente en la nube al recuperar la red.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-blue-950">
                    Sincronización Automática Activa
                  </h4>
                  <p className="text-xs text-blue-800 mt-0.5 leading-relaxed font-medium">
                    El sistema protege tus datos automáticamente. Si estás sin conexión, puedes seguir registrando ventas y compras con total normalidad; la app los sincronizará al volver a conectarte.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Counts of backed-up items */}
          <div>
            <h5 className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400 mb-2">
              Datos Respaldados en este Dispositivo y Nube
            </h5>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Transacciones</span>
                <span className="text-lg font-black text-slate-900 font-mono">{itemCounts.records}</span>
                <span className="text-[9px] text-slate-500 font-medium block">Ventas y Gastos</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Inventario</span>
                <span className="text-lg font-black text-slate-900 font-mono">{itemCounts.inventory}</span>
                <span className="text-[9px] text-slate-500 font-medium block">Artículos Activos</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Deudas</span>
                <span className="text-lg font-black text-slate-900 font-mono">{itemCounts.debts}</span>
                <span className="text-[9px] text-slate-500 font-medium block">Cuentas por Cobrar</span>
              </div>
            </div>
          </div>

          {/* Detailed Connection Specifications */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-slate-400" />
                <span>Conexión de red:</span>
              </span>
              <span className={`font-black flex items-center gap-1.5 ${isOnline ? 'text-emerald-700' : 'text-rose-600'}`}>
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                {isOnline ? 'En línea (Internet activo)' : 'Sin internet (Modo fuera de línea)'}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span>Base de datos en la nube:</span>
              </span>
              <span className="font-bold text-slate-800">
                Google Cloud Firebase Firestore
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Cuenta vinculada:</span>
              </span>
              <span className="font-bold font-mono text-slate-800 truncate max-w-[200px]">
                {userEmail}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <CloudCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Último respaldo verificado:</span>
              </span>
              <span className="font-bold text-slate-900 font-mono">
                {formatSyncTime(lastSyncTime)} ({formatRelativeSync(lastSyncTime)})
              </span>
            </div>
          </div>

          {/* Test Notice Result */}
          {testResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{testResult}</span>
            </div>
          )}

          {/* Safety Guarantees Notice */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs text-slate-700 space-y-1">
            <div className="flex items-center gap-1.5 font-black text-amber-900">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Garantía de Persistencia Dual</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Finova utiliza un sistema de almacenamiento híbrido. Aunque se corte la energía o no haya cobertura celular, todos los datos se conservan íntegros en tu dispositivo y se sincronizan con la nube de Firebase al reconectarse.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestSync}
            disabled={testing || isSyncing}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing || isSyncing ? 'animate-spin' : ''}`} />
            <span>{testing || isSyncing ? 'Comprobando...' : 'Comprobar Sincronización'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </motion.div>
    </div>
  );
}
