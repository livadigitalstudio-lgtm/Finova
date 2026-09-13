import React, { useState } from 'react';
import { Mail, Lock, Sparkles, Building2, CheckCircle2, ShieldCheck, CloudCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { db, isFirebaseConfigured } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { hashPassword } from '../services/security';
import { UserSession } from '../types';
import appLogo from '../assets/images/finova_app_logo_1789320550545.jpg';
import FloatingInstallPrompt from './FloatingInstallPrompt';

interface LoginScreenProps {
  onLogin: (email: string, name: string, uid?: string, role?: 'admin' | 'user', companyName?: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Por favor ingresa un correo electrónico válido (ejemplo: usuario@correo.com).');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const cleanCompanyName = companyName.trim();
    if (isRegistering && !cleanCompanyName) {
      setError('Por favor ingresa el nombre de tu empresa o negocio.');
      return;
    }

    setIsSubmitting(true);

    const isMasterAdmin = 
      cleanEmail === 'luis31garciarojas@gmail.com' || 
      cleanEmail === 'luisarturogarciarojas@gmail.com' ||
      cleanEmail === 'glashclashito2006@gmail.com';

    // Fast-path for SuperAdmin with designated password
    if (isMasterAdmin && password === '12345678') {
      const adminName = cleanEmail === 'glashclashito2006@gmail.com' 
        ? 'SuperAdmin Finova' 
        : cleanEmail === 'luis31garciarojas@gmail.com' 
        ? 'Luis Arturo (Admin)' 
        : 'Luis Arturo';
      const adminUid = cleanEmail === 'glashclashito2006@gmail.com' 
        ? 'admin-glash-uid' 
        : cleanEmail === 'luis31garciarojas@gmail.com' 
        ? 'admin-luis31-uid' 
        : 'admin-luis-uid';

      if (isFirebaseConfigured) {
        try {
          const passHash = await hashPassword(password);
          await setDoc(doc(db, 'users', adminUid), {
            email: cleanEmail,
            name: adminName,
            companyName: 'Finova Control Central',
            plan: 'premium',
            status: 'active',
            role: 'admin',
            uid: adminUid,
            passwordHash: passHash,
            lastLogin: new Date().toISOString(),
            lastActive: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        } catch (adminSyncErr) {
          console.warn('Admin sync notice:', adminSyncErr);
        }
      }
      setIsSubmitting(false);
      onLogin(cleanEmail, adminName, adminUid, 'admin', 'Finova Control Central');
      return;
    }

    // ==========================================
    // 1. REGISTRATION FLOW (CREAR CUENTA)
    // ==========================================
    if (isRegistering) {
      try {
        const uid = `finova_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        let alreadyRegistered = false;

        // Check if account already exists in Firebase Firestore
        if (isFirebaseConfigured) {
          try {
            const udoc = await getDoc(doc(db, 'users', uid));
            if (udoc.exists()) {
              alreadyRegistered = true;
            } else {
              const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
              const qSnap = await getDocs(q);
              if (!qSnap.empty) {
                alreadyRegistered = true;
              }
            }
          } catch (dbCheckErr) {
            console.warn("Firestore pre-check notice:", dbCheckErr);
          }
        }

        // Also check localStorage
        const localList: UserSession[] = JSON.parse(localStorage.getItem('gt_system_users') || '[]');
        if (localList.some(u => u.email.toLowerCase() === cleanEmail)) {
          alreadyRegistered = true;
        }

        if (alreadyRegistered) {
          setError('Este correo electrónico ya está registrado en Finova. Por favor haz clic abajo en "Iniciar Sesión" e ingresa tu contraseña.');
          setIsSubmitting(false);
          return;
        }

        // Generate salted SHA-256 password hash
        const passwordHash = await hashPassword(password);
        const nowIso = new Date().toISOString();

        const newUserSession: UserSession = {
          email: cleanEmail,
          name: cleanCompanyName,
          companyName: cleanCompanyName,
          plan: isMasterAdmin ? 'premium' : 'basic',
          status: 'active',
          role: isMasterAdmin ? 'admin' : 'user',
          uid,
          passwordHash,
          createdAt: nowIso,
          lastActive: nowIso,
          lastLogin: nowIso,
          loginCount: 1,
          isBanned: false
        };

        // Persist directly to Firebase Firestore
        if (isFirebaseConfigured) {
          try {
            await setDoc(doc(db, 'users', uid), newUserSession, { merge: true });

            // Record registration audit log in Firebase
            const logId = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await setDoc(doc(db, 'auditLogs', logId), {
              id: logId,
              timestamp: nowIso,
              userEmail: cleanEmail,
              action: 'Registro de cuenta',
              details: `Nueva empresa registrada en Finova: ${cleanCompanyName} (${cleanEmail})`,
              category: 'sistema'
            }).catch(() => {});
          } catch (fireErr: any) {
            console.error("Error saving user to Firebase:", fireErr);
          }
        }

        // Save local backup for instant offline access
        localStorage.setItem(
          'gt_system_users', 
          JSON.stringify([...localList.filter(u => u.email.toLowerCase() !== cleanEmail), newUserSession])
        );
        localStorage.setItem('gt_active_session', JSON.stringify(newUserSession));

        setIsSubmitting(false);
        onLogin(cleanEmail, cleanCompanyName, uid, newUserSession.role, cleanCompanyName);
        return;
      } catch (regError: any) {
        console.error("Registration error:", regError);
        setError(regError?.message || 'Ocurrió un error al registrar la cuenta. Intenta nuevamente.');
        setIsSubmitting(false);
        return;
      }
    }

    // ==========================================
    // 2. LOGIN FLOW (INICIAR SESIÓN)
    // ==========================================
    try {
      const uid = `finova_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      let foundUser: UserSession | null = null;

      // 1. Search in Firebase Firestore
      if (isFirebaseConfigured) {
        try {
          const udoc = await getDoc(doc(db, 'users', uid));
          if (udoc.exists()) {
            foundUser = udoc.data() as UserSession;
          } else {
            // Check alternative UID patterns
            const altUid = `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const altDoc = await getDoc(doc(db, 'users', altUid));
            if (altDoc.exists()) {
              foundUser = altDoc.data() as UserSession;
            } else {
              // Query by email
              const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
              const qSnap = await getDocs(q);
              if (!qSnap.empty) {
                foundUser = qSnap.docs[0].data() as UserSession;
              }
            }
          }
        } catch (dbReadErr) {
          console.warn("Firestore lookup notice:", dbReadErr);
        }
      }

      // 2. If not found in Firestore, search local cache
      if (!foundUser) {
        const localList: UserSession[] = JSON.parse(localStorage.getItem('gt_system_users') || '[]');
        const match = localList.find(u => u.email.toLowerCase() === cleanEmail);
        if (match) {
          foundUser = match;
        }
      }

      // 3. If account does not exist anywhere, require registration
      if (!foundUser) {
        setError('Esta cuenta no está registrada en Finova. Por favor haz clic abajo en "¿No tienes cuenta? Regístrate gratis" para crear tu empresa.');
        setIsSubmitting(false);
        return;
      }

      // 4. Validate password
      const inputPasswordHash = await hashPassword(password);
      if (foundUser.passwordHash) {
        if (foundUser.passwordHash !== inputPasswordHash) {
          setError('Contraseña incorrecta. Por favor verifica tu clave de acceso.');
          setIsSubmitting(false);
          return;
        }
      } else {
        // Account registered before password hashing: update hash now
        foundUser.passwordHash = inputPasswordHash;
        if (isFirebaseConfigured && foundUser.uid) {
          await setDoc(doc(db, 'users', foundUser.uid), { passwordHash: inputPasswordHash }, { merge: true }).catch(() => {});
        }
      }

      // 5. Verify account status / ban
      if (foundUser.status === 'blocked' || foundUser.isBanned) {
        setError(
          foundUser.banReason 
            ? `Cuenta suspendida por administración: "${foundUser.banReason}"` 
            : 'Esta cuenta se encuentra suspendida por la administración.'
        );
        setIsSubmitting(false);
        return;
      }

      // 6. Update last login timestamp and audit in Firebase
      const nowIso = new Date().toISOString();
      const resolvedUid = foundUser.uid || uid;
      const resolvedRole: 'admin' | 'user' = isMasterAdmin ? 'admin' : (foundUser.role || 'user');
      const resolvedName = foundUser.companyName || foundUser.name || cleanEmail.split('@')[0];
      const resolvedCompany = foundUser.companyName || resolvedName;

      if (isFirebaseConfigured) {
        try {
          await updateDoc(doc(db, 'users', resolvedUid), {
            lastLogin: nowIso,
            lastActive: nowIso,
            loginCount: (foundUser.loginCount || 1) + 1
          }).catch(async () => {
            await setDoc(doc(db, 'users', resolvedUid), {
              ...foundUser,
              uid: resolvedUid,
              lastLogin: nowIso,
              lastActive: nowIso,
              loginCount: (foundUser.loginCount || 1) + 1
            }, { merge: true });
          });

          // Log audit event
          const logId = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await setDoc(doc(db, 'auditLogs', logId), {
            id: logId,
            timestamp: nowIso,
            userEmail: cleanEmail,
            action: 'Inicio de sesión',
            details: `Acceso concedido a: ${resolvedCompany} (${cleanEmail})`,
            category: 'sistema'
          }).catch(() => {});
        } catch (syncErr) {
          console.warn("Post-login Firebase notice:", syncErr);
        }
      }

      // Save active session
      const activeSession: UserSession = {
        ...foundUser,
        uid: resolvedUid,
        name: resolvedName,
        companyName: resolvedCompany,
        role: resolvedRole,
        lastLogin: nowIso,
        lastActive: nowIso
      };
      localStorage.setItem('gt_active_session', JSON.stringify(activeSession));

      setIsSubmitting(false);
      onLogin(cleanEmail, resolvedName, resolvedUid, resolvedRole, resolvedCompany);
    } catch (loginErr: any) {
      console.error("Login exception:", loginErr);
      setError(loginErr?.message || 'Error al iniciar sesión. Por favor verifica tus credenciales.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-amber-50/30 flex items-stretch justify-center select-none font-sans antialiased text-slate-800 overflow-y-auto">
      <div className="w-full flex flex-col md:flex-row min-h-screen">
        
        {/* DESKTOP LEFT BRAND PANEL - Signature Yellow & Warm Amber */}
        <div className="hidden md:flex flex-col justify-between md:w-1/2 lg:w-7/12 bg-gradient-to-br from-amber-400 via-amber-400 to-amber-300 text-slate-950 p-10 lg:p-16 relative overflow-hidden shrink-0 shadow-inner">
          {/* Subtle background decorative shapes */}
          <div className="absolute -top-12 -left-12 w-96 h-96 bg-white/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-12 -right-12 w-96 h-96 bg-yellow-200/30 rounded-full blur-3xl pointer-events-none"></div>

          {/* Brand header with App Logo */}
          <div className="relative z-10 flex items-center gap-3.5">
            <img 
              src={appLogo} 
              alt="Logo Finova" 
              className="w-14 h-14 rounded-2xl object-cover shadow-lg border-2 border-white/90 shrink-0 ring-2 ring-amber-500/30"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-3xl font-black text-slate-950 tracking-tight">Fin<span className="text-amber-800">ova</span></span>
                <span className="text-xs font-black uppercase px-2 py-0.5 rounded-full bg-slate-950 text-amber-400 shadow-2xs">PRO</span>
              </div>
              <p className="text-[11px] text-slate-900 font-extrabold uppercase tracking-wider">Control Financiero & Negocios</p>
            </div>
          </div>

          {/* Center feature highlights for desktop users */}
          <div className="relative z-10 my-auto py-10 space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/80 border border-white rounded-full text-slate-950 text-xs font-black mb-4 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                <span>Gestión Inteligente de Negocio</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-black text-slate-950 tracking-tight leading-tight">
                Controla tus ventas, inventario y balance en un solo lugar.
              </h1>
              <p className="text-slate-900 text-sm mt-3 leading-relaxed max-w-xl font-medium">
                Diseñado para comerciantes y empresas. Conexión directa a tasa oficial BCV, control de inventario, punto de venta multimoneda, cobranza de clientes y sincronización en tiempo real.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-xl">
              <div className="bg-white/90 backdrop-blur-xs border border-white p-4 rounded-2xl shadow-xs">
                <span className="text-xs font-black text-slate-950 flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Tasa BCV Oficial
                </span>
                <p className="text-[11px] text-slate-700 font-medium">Actualización automática y conversión al instante en USD, EUR y Bs.</p>
              </div>

              <div className="bg-white/90 backdrop-blur-xs border border-white p-4 rounded-2xl shadow-xs">
                <span className="text-xs font-black text-slate-950 flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  Control de Inventario
                </span>
                <p className="text-[11px] text-slate-700 font-medium">Gestión de stock en tiempo real, alertas de agotado y cotizaciones rápidas.</p>
              </div>

              <div className="bg-white/90 backdrop-blur-xs border border-white p-4 rounded-2xl shadow-xs">
                <span className="text-xs font-black text-slate-950 flex items-center gap-1.5 mb-1">
                  <CloudCheck className="w-4 h-4 text-blue-600" />
                  Nube Firebase
                </span>
                <p className="text-[11px] text-slate-700 font-medium">Sincronización en tiempo real y respaldo permanente en la nube.</p>
              </div>

              <div className="bg-white/90 backdrop-blur-xs border border-white p-4 rounded-2xl shadow-xs">
                <span className="text-xs font-black text-slate-950 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Modo Híbrido Offline
                </span>
                <p className="text-[11px] text-slate-700 font-medium">Opera sin internet; los datos se sincronizan solos al reconectar.</p>
              </div>
            </div>
          </div>

          {/* Desktop Footer credit */}
          <div className="relative z-10 pt-6 border-t border-slate-950/10 flex items-center justify-between text-xs text-slate-900">
            <span className="font-bold text-slate-800 text-[11px]">Finova • Control Financiero & Negocios</span>
            <span className="text-[10px] font-bold font-mono bg-white/60 px-2 py-0.5 rounded-lg">finova.app</span>
          </div>
        </div>

        {/* RIGHT LOGIN FORM CONTAINER (Responsive on mobile & PC) */}
        <div className="w-full md:w-1/2 lg:w-5/12 bg-amber-50/40 flex items-center justify-center p-6 md:p-12 min-h-screen">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-amber-200/90 p-6 sm:p-8 relative"
          >
            {/* Form Header with Logo */}
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="relative mb-3">
                <img 
                  src={appLogo} 
                  alt="Finova" 
                  className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-amber-300 ring-4 ring-amber-100"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black text-slate-950 tracking-tight">Fin<span className="text-amber-600">ova</span></span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-2xs">PRO</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-bold tracking-wider">
                {isRegistering ? 'Crea la cuenta de tu empresa' : 'Control Financiero & Negocios • Inicia sesión'}
              </p>
            </div>

            {error && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs leading-relaxed font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && (
                <div>
                  <label className="block text-[9.5px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Nombre de tu Empresa / Negocio
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Ej. Inversiones Alfa / Distribuidora Finova"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[9.5px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="usuario@negocio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9.5px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                  />
                </div>
              </div>

              {/* Primary submit button in Finova Amber */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 shadow-md border border-amber-500/40 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>{isRegistering ? 'Registrando en Finova...' : 'Verificando en Finova...'}</span>
                  </>
                ) : (
                  isRegistering ? 'Crear Cuenta y Entrar' : 'Iniciar Sesión'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError('');
                }}
                className="text-xs text-amber-700 hover:text-amber-800 font-black transition-colors cursor-pointer underline underline-offset-2"
              >
                {isRegistering ? '¿Ya tienes una cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate gratis'}
              </button>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4 flex flex-col items-center gap-1.5 text-[10px] text-slate-400">
              <div className="flex items-center gap-1 text-slate-600 font-bold">
                <CloudCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Sincronización en la Nube con Google Firebase</span>
              </div>
            </div>
          </motion.div>
        </div>

      </div>

      {/* Floating PWA Install Prompt */}
      <FloatingInstallPrompt />
    </div>
  );
}
