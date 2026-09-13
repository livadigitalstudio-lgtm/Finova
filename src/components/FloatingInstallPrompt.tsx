import React, { useState, useEffect } from 'react';
import { Download, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import appLogo from '../assets/images/finova_app_logo_1789320550545.jpg';

export default function FloatingInstallPrompt() {
  const { isInstalled, install } = usePWAInstall();
  const [isOpen, setIsOpen] = useState(true);
  const [justInstalled, setJustInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Check if previously marked as installed
  const alreadyHasApp = isInstalled || (typeof window !== 'undefined' && localStorage.getItem('finova_pwa_installed') === 'true');

  useEffect(() => {
    const dismissed = sessionStorage.getItem('finova_pwa_dismissed');
    if (dismissed === 'true') {
      setIsOpen(false);
    }
  }, []);

  // Si ya la tiene instalada, NO mostrar la ventana flotante
  if (alreadyHasApp && !justInstalled) {
    return null;
  }

  const handleDismiss = () => {
    setIsOpen(false);
    sessionStorage.setItem('finova_pwa_dismissed', 'true');
  };

  // Instalar de una vez directamente sin dar indicaciones largas
  const handleDirectInstall = async () => {
    setIsInstalling(true);
    try {
      const outcome = await install();
      if (outcome === 'accepted') {
        localStorage.setItem('finova_pwa_installed', 'true');
        setJustInstalled(true);
        setTimeout(() => {
          setIsOpen(false);
        }, 2000);
      }
    } catch (e) {
      console.warn('Install trigger error:', e);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <aside
      aria-label="Instalación directa de Finova"
      className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40 select-none max-w-[320px]"
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className="bg-white/95 backdrop-blur-md rounded-2xl border border-amber-300 shadow-xl shadow-slate-900/15 p-3.5 relative text-slate-800"
          >
            {/* Botón cerrar */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-3 pr-4">
              <img
                src={appLogo}
                alt="Finova"
                className="w-10 h-10 rounded-xl object-cover shadow-sm border border-amber-300 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-950 tracking-tight">
                    Finova App
                  </span>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-950">
                    Instalar
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-500 mt-0.5 leading-tight">
                  Instala la aplicación en tu dispositivo de una vez.
                </p>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2">
              {justInstalled ? (
                <div className="w-full py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>¡App instalada!</span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleDirectInstall}
                    disabled={isInstalling}
                    className="flex-1 py-2 px-3 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer border border-amber-500/40 active:scale-98"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>{isInstalling ? 'Instalando...' : 'Instalar de una vez'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="py-2 px-2.5 text-[11px] font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
