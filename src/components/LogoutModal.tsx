import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, WifiOff, AlertTriangle, ShieldCheck, X, LogOut } from 'lucide-react';

export type LogoutStep = 'syncing' | 'offline_warning' | 'error';

export interface LogoutModalProps {
  isOpen: boolean;
  step: LogoutStep;
  onRetry: () => void;
  onForceLogout: () => void;
  onCancel: () => void;
  errorMessage?: string;
}

export default function LogoutModal({
  isOpen,
  step,
  onRetry,
  onForceLogout,
  onCancel,
  errorMessage
}: LogoutModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-70 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        >
          {/* STEP 1: SYNCING IN PROGRESS */}
          {step === 'syncing' && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-inner">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-600" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Sincronizando y cerrando sesión...
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium max-w-xs mx-auto">
                  Respaldando tus datos y asegurando tus registros contables en la nube de forma segura antes de salir.
                </p>
              </div>

              <div className="pt-2">
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-full w-2/3 rounded-full animate-pulse"></div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 mt-2 block uppercase tracking-wider">
                  Por favor no cierres la ventana
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: OFFLINE WARNING */}
          {step === 'offline_warning' && (
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <WifiOff className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-950">
                    No hay conexión a internet
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Atención: Advertencia de respaldo antes de salir
                  </p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-slate-700 leading-relaxed font-medium">
                No hay conexión a internet. Si cierras sesión ahora, los últimos cambios locales no se guardarán en la nube. ¿Deseas reintentar o forzar el cierre?
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full py-3 bg-slate-950 hover:bg-slate-900 active:scale-98 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  <span>Reintentar conexión y sincronizar</span>
                </button>

                <button
                  type="button"
                  onClick={onForceLogout}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Forzar cierre de sesión</span>
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancelar y permanecer en la aplicación
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: GENERAL ERROR */}
          {step === 'error' && (
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Aviso durante la sincronización
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {errorMessage || 'Ocurrió una eventualidad al contactar el servidor.'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                No pudimos confirmar la subida de los registros pendientes a la nube. Puedes reintentar o forzar la salida.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full py-3 bg-slate-950 hover:bg-slate-900 active:scale-98 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  <span>Reintentar</span>
                </button>

                <button
                  type="button"
                  onClick={onForceLogout}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Forzar cierre de sesión
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Volver a la aplicación
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
