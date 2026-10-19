import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings, HelpCircle, Search, Info, LogOut, RefreshCw, 
  Trash2, Sliders, ChevronRight, Crown, Sparkles, ShieldAlert,
  Calendar, CreditCard, BookOpen, TrendingUp, DollarSign, X, PieChart, Users, Home, BarChart2,
  FileText, Truck, Briefcase, Receipt, Grid, ChevronUp, Layers, Plus, Minus, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Imports types & default data
import { 
  UserSession, FinancialRecord, InventoryItem, DebtItem, DebtPayment,
  ExchangeRates, MonetizationPlan, AuditLog, SoldItemDetail, PurchasedItemDetail,
  ProFeaturesConfig, DEFAULT_PRO_FEATURES_CONFIG
} from './types';
import { 
  INITIAL_RATES, INITIAL_PLANS 
} from './data/defaultData';
import { CurrencyCode } from './utils/currency';
import { getDebtRemainingAmount, getDebtPaidAmount } from './utils/debtUtils';

// Imports modular components
import LoginScreen from './components/LoginScreen';
import AdminPortal from './components/AdminPortal';
import TabInicio from './components/TabInicio';
import TabBalance from './components/TabBalance';
import TabDeudas from './components/TabDeudas';
import TabInventario from './components/TabInventario';
import TabBalanceGeneral from './components/TabBalanceGeneral';
import SuggestedClients from './components/SuggestedClients';
import SuggestedQuotes from './components/SuggestedQuotes';
import SuggestedStats from './components/SuggestedStats';
import SuggestedSuppliers from './components/SuggestedSuppliers';
import SuggestedEmployees from './components/SuggestedEmployees';
import { 
  AddRecordModal, AddInventoryModal, AddDebtModal 
} from './components/FinancialForms';
import { SaleFlowModal } from './components/SaleFlowModal';
import { ExpenseFlowModal } from './components/ExpenseFlowModal';
import { purgeLegacyPerfumeData } from './utils/categoryUtils';
import { ratesService, useExchangeRates } from './services/ratesService';
import { storageService } from './services/storageService';
import { localDb } from './db/localDb';
import { localMigrationService } from './services/localMigrationService';
import { backgroundSyncEngine } from './services/backgroundSyncEngine';
import LogoutModal, { LogoutStep } from './components/LogoutModal';
import AppLogo from './components/AppLogo';
import FloatingInstallPrompt from './components/FloatingInstallPrompt';
import { getLocalDateString } from './utils/dateUtils';

// Firebase imports
import { auth, db, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebase';
import { 
  onAuthStateChanged, 
  signInAnonymously,
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where
} from 'firebase/firestore';

export type TabType = 
  | 'inicio' 
  | 'balance' 
  | 'cotizaciones' 
  | 'inventario' 
  | 'deudas' 
  | 'clientes' 
  | 'estadisticas' 
  | 'proveedores' 
  | 'empleados' 
  | 'balance_general';

export const isUserMasterAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return (
    clean === 'luisarturogarciarojas@gmail.com' || 
    clean === 'luis31garciarojas@gmail.com' ||
    clean === 'glashclashito2006@gmail.com'
  );
};

export default function App() {
  // --- 1. USER SESSIONS & PERMISSIONS SYSTEM ---
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const cached = localStorage.getItem('gt_active_session');
    return cached ? JSON.parse(cached) : null;
  });

  const [systemUsers, setSystemUsers] = useState<UserSession[]>(() => {
    const cached = localStorage.getItem('gt_system_users');
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as UserSession[];
        // Filter out any legacy simulated test entries
        const clean = parsed.filter(u => 
          !u.email.includes('maria_perez') && 
          !u.email.includes('alejandro') && 
          !u.name.includes('María Pérez') && 
          !u.name.includes('Alejandro')
        );
        return clean;
      } catch (e) {
        console.warn('System users parse notice:', e);
      }
    }
    
    // Default authorized master admin accounts
    const realAccounts: UserSession[] = [
      { email: 'luisarturogarciarojas@gmail.com', name: 'Luis Arturo', companyName: 'Inversiones Arturo', plan: 'premium', status: 'active', role: 'admin', uid: 'luis-admin-default' },
      { email: 'luis31garciarojas@gmail.com', name: 'Luis Arturo (Admin)', companyName: 'Arturo Comercial', plan: 'premium', status: 'active', role: 'admin', uid: 'luis-master-admin' },
      { email: 'glashclashito2006@gmail.com', name: 'SuperAdmin Finova', companyName: 'Finova Central', plan: 'premium', status: 'active', role: 'admin', uid: 'glashclash-admin' }
    ];
    localStorage.setItem('gt_system_users', JSON.stringify(realAccounts));
    return realAccounts;
  });

  // State to track if user is authenticated with Firebase Auth
  const [firebaseAuthUser, setFirebaseAuthUser] = useState<any>(() => auth.currentUser);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribeAuth = onAuthStateChanged(auth, (usr) => {
      setFirebaseAuthUser(usr);
    });

    if (!auth.currentUser) {
      signInAnonymously(auth).catch((authErr) => {
        // Safe fallback: project rules permit operations regardless of anonymous provider setting
        console.info('Firebase auth session note:', authErr?.message || authErr);
      });
    }

    return () => unsubscribeAuth();
  }, []);

  // Cloud sync is active when Firebase is configured and a user session is present
  const isCloudSyncActive = Boolean(isFirebaseConfigured && (currentUser || firebaseAuthUser));

  // Network connectivity state (completely automatic and silent)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Graceful Sign-Out Routine states
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [logoutStep, setLogoutStep] = useState<LogoutStep>('syncing');
  const [logoutErrorMsg, setLogoutErrorMsg] = useState('');

  // --- Real-time Firebase Synchronization & Active User Profile Monitor ---
  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser?.uid) return;

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsub = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const liveData = docSnap.data() as UserSession;
        setCurrentUser(prev => {
          if (!prev) return liveData;
          if (
            prev.plan !== liveData.plan ||
            prev.status !== liveData.status ||
            prev.isBanned !== liveData.isBanned ||
            prev.banReason !== liveData.banReason ||
            prev.role !== liveData.role ||
            prev.companyName !== liveData.companyName
          ) {
            const merged = { ...prev, ...liveData };
            localStorage.setItem('gt_active_session', JSON.stringify(merged));
            return merged;
          }
          return prev;
        });
      }
    }, (error) => {
      console.warn("Notice syncing active user document:", error);
    });

    return () => unsub();
  }, [currentUser?.uid, isCloudSyncActive]);

  // B. Admin listener for all registered users on Firestore database
  useEffect(() => {
    if (!isCloudSyncActive || !currentUser) return;
    const isMasterAdmin = isUserMasterAdmin(currentUser.email);
    if (!isMasterAdmin) return;

    const q = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      const list: UserSession[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as UserSession);
      });
      setSystemUsers(list);
      localStorage.setItem('gt_system_users', JSON.stringify(list));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribeUsers();
  }, [currentUser?.email, isCloudSyncActive]);

  // Handle local simulation-only syncs (fallback when Firebase is not active)
  useEffect(() => {
    if (isCloudSyncActive) return;
    localStorage.setItem('gt_system_users', JSON.stringify(systemUsers));
  }, [systemUsers, isCloudSyncActive]);

  useEffect(() => {
    if (isCloudSyncActive) return;
    if (currentUser) {
      const liveUser = systemUsers.find(u => u.email === currentUser.email);
      if (liveUser) {
        if (liveUser.plan !== currentUser.plan || liveUser.status !== currentUser.status) {
          setCurrentUser(liveUser);
          localStorage.setItem('gt_active_session', JSON.stringify(liveUser));
        }
      }
    }
  }, [systemUsers, currentUser?.email, currentUser?.plan, currentUser?.status, isCloudSyncActive]);

  // --- 2. MONETIZATION AND PLANS SETTINGS ---
  const [systemPlans, setSystemPlans] = useState<MonetizationPlan[]>(() => {
    const cached = localStorage.getItem('gt_system_plans');
    if (cached) {
      const parsed = JSON.parse(cached) as MonetizationPlan[];
      // Sync or upgrade features dynamically with INITIAL_PLANS features
      return parsed.map(plan => {
        const initial = INITIAL_PLANS.find(p => p.id === plan.id);
        if (initial) {
          return { ...plan, features: initial.features };
        }
        return plan;
      });
    }
    return INITIAL_PLANS;
  });

  useEffect(() => {
    localStorage.setItem('gt_system_plans', JSON.stringify(systemPlans));
  }, [systemPlans]);

  // --- 2.1 PRO MODULES CONFIGURATION (Customizable only by Admin) ---
  const [proFeaturesConfig, setProFeaturesConfig] = useState<ProFeaturesConfig>(() => {
    const cached = localStorage.getItem('gt_pro_features_config');
    if (cached) {
      try {
        return JSON.parse(cached) as ProFeaturesConfig;
      } catch (e) {
        console.warn('Error reading cached pro config', e);
      }
    }
    return DEFAULT_PRO_FEATURES_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('gt_pro_features_config', JSON.stringify(proFeaturesConfig));
  }, [proFeaturesConfig]);

  // Sync pro configuration from Cloud if available
  useEffect(() => {
    if (!isCloudSyncActive) return;
    const unsub = onSnapshot(doc(db, 'system', 'pro_features_config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as ProFeaturesConfig;
        setProFeaturesConfig(data);
        localStorage.setItem('gt_pro_features_config', JSON.stringify(data));
      }
    }, (err) => {
      console.warn("Could not sync cloud pro config:", err);
    });
    return () => unsub();
  }, [isCloudSyncActive]);

  const handleUpdateProConfig = async (newConfig: ProFeaturesConfig) => {
    setProFeaturesConfig(newConfig);
    localStorage.setItem('gt_pro_features_config', JSON.stringify(newConfig));
    if (isCloudSyncActive) {
      try {
        await setDoc(doc(db, 'system', 'pro_features_config'), newConfig, { merge: true });
      } catch (e) {
        console.warn("Error saving cloud pro config:", e);
      }
    }
    handleAddAuditLog(
      'Configuración Módulos PRO',
      `Administrador actualizó privilegios de módulos PRO. Módulos activos: ${Object.entries(newConfig).filter(([_, v]) => v).map(([k]) => k).join(', ') || 'Ninguno (Todos libres)'}`,
      'sistema'
    );
  };

  // Sanitizer to eliminate any demo/sample items and legacy perfume/fragrance products
  const sanitizeInventory = (items: InventoryItem[]): InventoryItem[] => {
    if (!Array.isArray(items)) return [];
    const demoSampleIds = new Set([
      'perfume-1', 'perfume-2', 'perfume-3', 
      'sample-1', 'sample-2', 'sample-3', 
      'p-1', 'p-2', 'p-3', 
      'item-1', 'item-2', 'item-3',
      'prod-1', 'prod-2', 'prod-3'
    ]);
    return items.filter(item => {
      if (!item) return false;
      if (demoSampleIds.has(item.id)) return false;
      const lowerName = (item.name || '').toLowerCase().trim();
      const lowerCat = (item.category || '').toLowerCase().trim();
      if (
        lowerName.startsWith('[demo]') ||
        lowerName.startsWith('[ejemplo]') ||
        lowerName === 'producto de prueba' ||
        lowerName === 'muestra de prueba' ||
        lowerName.includes('perfume') ||
        lowerName.includes('fragancia') ||
        lowerName.includes('fragrance') ||
        lowerName.includes('club de nuit') ||
        lowerName.includes('yara') ||
        lowerName.includes('lattafa') ||
        lowerName.includes('sauvage') ||
        lowerName.includes('asad') ||
        lowerName.includes('baccarat') ||
        lowerName.includes('9pm') ||
        lowerCat.includes('perfume') ||
        lowerCat.includes('fragancia') ||
        lowerCat.includes('fragrance')
      ) {
        return false;
      }
      return true;
    });
  };

  // --- 3. FOREIGN EXCHANGE RATES indicator via Hourly Cached Service Hook ---
  const { rates: exchangeRates, setRates: setExchangeRates, refreshRates } = useExchangeRates();

  const handleUpdateRates = (newRates: ExchangeRates) => {
    setExchangeRates(newRates);
    storageService.set('gt_rates_system', newRates);
  };

  // User preferred viewing currency ($ USD or € EUR)
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => {
    const saved = storageService.getSync<string>('gt_selected_currency', 'USD');
    return (saved === 'EUR' || saved === 'USD') ? (saved as CurrencyCode) : 'USD';
  });

  const handleCurrencyChange = (curr: CurrencyCode) => {
    setSelectedCurrency(curr);
    storageService.set('gt_selected_currency', curr);
  };

  // --- 4. ISOLATED TRANSACTION RECORDS & STATE PER EMAIL/UID ---
  const [records, setRecords] = useState<FinancialRecord[]>(() => {
    if (!currentUser?.email) return [];
    return storageService.getSync<FinancialRecord[]>(`gt_records_${currentUser.email}`, []);
  });
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    if (!currentUser?.email) return [];
    return sanitizeInventory(storageService.getSync<InventoryItem[]>(`gt_inventory_${currentUser.email}`, []));
  });
  const [debts, setDebts] = useState<DebtItem[]>(() => {
    if (!currentUser?.email) return [];
    return storageService.getSync<DebtItem[]>(`gt_debts_${currentUser.email}`, []);
  });

  // Strict User Data Isolation: Reset & rehydrate whenever current user changes
  useEffect(() => {
    if (!currentUser?.email || !currentUser?.uid) {
      setRecords([]);
      setInventory([]);
      setDebts([]);
      return;
    }
    const emailKey = currentUser.email;
    const userId = currentUser.uid;
    purgeLegacyPerfumeData(emailKey);

    // Register active user in background sync engine
    backgroundSyncEngine.setActiveUser(userId);

    // 1. FAST LOCAL-FIRST HYDRATION (IndexedDB Dexie as Primary Source of Truth)
    localDb.getUserRecords(userId).then((localRecs) => {
      if (localRecs && localRecs.length > 0) {
        setRecords(localRecs);
      } else {
        const cached = storageService.getSync<FinancialRecord[]>(`gt_records_${emailKey}`, []);
        setRecords(cached);
      }
    });

    localDb.getUserInventory(userId).then((localInv) => {
      const cleaned = sanitizeInventory(localInv || []);
      if (cleaned.length > 0) {
        setInventory(cleaned);
      } else {
        const rawCachedInv = storageService.getSync<InventoryItem[]>(`gt_inventory_${emailKey}`, []);
        setInventory(sanitizeInventory(rawCachedInv));
      }
    });

    localDb.getUserDebts(userId).then((localDebts) => {
      if (localDebts && localDebts.length > 0) {
        setDebts(localDebts);
      } else {
        const cached = storageService.getSync<DebtItem[]>(`gt_debts_${emailKey}`, []);
        setDebts(cached);
      }
    });

    // 2. AUTOMATIC TRANSPARENT MIGRATION & DISASTER RECOVERY (Specifications 3 & 4)
    // If user is not yet migrated to local, or local DB is empty (new phone/device),
    // silently fetch from Firestore cloud backup, populate IndexedDB, and set flag.
    localMigrationService.ensureUserDataReady(userId, emailKey).then((result) => {
      if (result.migratedFromCloud) {
        if (result.records.length > 0) setRecords(result.records);
        if (result.inventory.length > 0) setInventory(sanitizeInventory(result.inventory));
        if (result.debts.length > 0) setDebts(result.debts);
      }
    }).catch((err) => {
      console.warn("Silent migration notice:", err);
    });
  }, [currentUser?.email, currentUser?.uid]);

  // Persists data immediately into local IndexedDB and memory cache (Local-First source of truth)
  const saveRecords = async (newRecs: FinancialRecord[]) => {
    setRecords(newRecs);
    if (currentUser?.email) {
      storageService.set(`gt_records_${currentUser.email}`, newRecs);
    }
    if (currentUser?.uid) {
      localDb.putUserRecords(currentUser.uid, newRecs).catch(() => {});
    }
  };

  const saveInventory = async (newInv: InventoryItem[]) => {
    setInventory(newInv);
    if (currentUser?.email) {
      storageService.set(`gt_inventory_${currentUser.email}`, newInv);
    }
    if (currentUser?.uid) {
      localDb.putUserInventory(currentUser.uid, newInv).catch(() => {});
    }
  };

  const saveDebts = async (newDebts: DebtItem[]) => {
    setDebts(newDebts);
    if (currentUser?.email) {
      storageService.set(`gt_debts_${currentUser.email}`, newDebts);
    }
    if (currentUser?.uid) {
      localDb.putUserDebts(currentUser.uid, newDebts).catch(() => {});
    }
  };

  // --- 5. UI CONTROLS & MAIN TAB SELECTION ---
  const [activeTab, setActiveTab] = useState<TabType>('inicio');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- Audit Trail State ---
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const cached = localStorage.getItem('gt_audit_trail_logs');
    if (cached) return JSON.parse(cached);
    
    // Seed clean initial log items
    const initialLogs: AuditLog[] = [
      {
        id: 'log-seed-1',
        timestamp: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
        userEmail: 'luisarturogarciarojas@gmail.com',
        action: 'Inicio sesión',
        details: 'Sesión iniciada correctamente en Mifinanzas.com',
        category: 'sistema'
      },
      {
        id: 'log-seed-2',
        timestamp: new Date(Date.now() - 3600 * 1000 * 1.5).toISOString(),
        userEmail: 'luisarturogarciarojas@gmail.com',
        action: 'Sincronizar tasas',
        details: 'Tasa BCV unificada ajustada a: Bs 41.50 (Spread Paralelo: 15.2%)',
        category: 'tasas'
      },
      {
        id: 'log-seed-3',
        timestamp: new Date(Date.now() - 3600 * 1000 * 0.8).toISOString(),
        userEmail: 'luisarturogarciarojas@gmail.com',
        action: 'Verificación sistema',
        details: 'Módulo de inventario y punto de venta listo desde cero',
        category: 'sistema'
      }
    ];
    localStorage.setItem('gt_audit_trail_logs', JSON.stringify(initialLogs));
    return initialLogs;
  });

  // Load audit trail in real-time from Cloud Firestore if enabled
  useEffect(() => {
    if (!isCloudSyncActive || !currentUser) return;

    const isAdminUser = currentUser.email.toLowerCase() === 'luisarturogarciarojas@gmail.com';
    const auditQuery = isAdminUser 
      ? collection(db, 'auditLogs')
      : query(collection(db, 'auditLogs'), where('userEmail', '==', currentUser.email.toLowerCase()));

    const unsubLog = onSnapshot(auditQuery, (snapshot) => {
      const list: AuditLog[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as AuditLog;
        list.push(item);
      });
      list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setAuditLogs(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'auditLogs');
    });

    return () => unsubLog();
  }, [currentUser]);

  const handleAddAuditLog = async (action: string, details: string, category: 'finanzas' | 'inventario' | 'deudas' | 'sistema' | 'tasas') => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      userEmail: currentUser?.email || 'sistema@galaxy.com',
      action,
      details,
      category
    };

    setAuditLogs(prev => {
      const updated = [newLog, ...prev];
      localStorage.setItem('gt_audit_trail_logs', JSON.stringify(updated));
      return updated;
    });

    if (currentUser?.uid) {
      localDb.auditLogs.put({ ...newLog, userId: currentUser.uid }).catch(() => {});
      backgroundSyncEngine.scheduleSync(currentUser.uid, {
        collection: 'auditLogs',
        action: 'upsert',
        docId: newLog.id,
        payload: newLog
      });
    }
  };

  const handleClearAuditLogs = () => {
    if (isCloudSyncActive) {
      showToast("La limpieza de logs en producción está reservada por seguridad.");
    } else {
      setAuditLogs([]);
      localStorage.setItem('gt_audit_trail_logs', JSON.stringify([]));
    }
  };

  const [viewMode, setViewMode] = useState<'app' | 'admin'>('app');
  const [isPlansOpen, setIsPlansOpen] = useState(false);

  // Forms modals parameters triggers
  const [isSaleOpen, setIsSaleOpen] = useState(false);
  const [salePreselectedProductId, setSalePreselectedProductId] = useState<string | null>(null);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [isCreateDebtOpen, setIsCreateDebtOpen] = useState(false);

  // Active notifications or alert systems
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Login transaction management
  const handleLogin = async (email: string, name: string, uid?: string, role?: 'admin' | 'user', companyName?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const isMasterAdmin = isUserMasterAdmin(cleanEmail);
    const effectiveRole: 'admin' | 'user' = isMasterAdmin ? 'admin' : 'user';
    const nowIso = new Date().toISOString();
    const resolvedCompany = companyName || name || 'Mi Empresa';

    if (isCloudSyncActive && uid) {
      let uData: UserSession | null = null;
      try {
        const udoc = await getDoc(doc(db, 'users', uid));
        if (udoc.exists()) {
          uData = udoc.data() as UserSession;
          uData.role = effectiveRole;
          uData.companyName = companyName || uData.companyName || resolvedCompany;
          uData.lastLogin = nowIso;
          uData.lastActive = nowIso;
          uData.loginCount = (uData.loginCount || 1) + 1;
          await setDoc(doc(db, 'users', uid), { 
            companyName: uData.companyName,
            lastLogin: nowIso, 
            lastActive: nowIso,
            loginCount: uData.loginCount 
          }, { merge: true });
        } else {
          uData = {
            email: cleanEmail,
            name: name || cleanEmail.split('@')[0],
            companyName: resolvedCompany,
            plan: isMasterAdmin ? 'premium' : 'basic',
            status: 'active',
            role: effectiveRole,
            uid: uid,
            createdAt: nowIso,
            lastLogin: nowIso,
            lastActive: nowIso,
            isBanned: false,
            loginCount: 1
          };
          await setDoc(doc(db, 'users', uid), uData, { merge: true });
          handleAddAuditLog(
            'Nuevo Usuario Registrado',
            `Se ha registrado una nueva empresa en la nube: ${uData.companyName} (${cleanEmail})`,
            'sistema'
          );
        }
      } catch (err) {
        console.warn("Firestore user sync notice:", err);
      }

      const activeSession: UserSession = uData || {
        email: cleanEmail,
        name: name,
        companyName: resolvedCompany,
        plan: isMasterAdmin ? 'premium' : 'basic',
        status: 'active',
        role: effectiveRole,
        uid: uid,
        createdAt: nowIso,
        lastLogin: nowIso,
        lastActive: nowIso,
        isBanned: false
      };

      setCurrentUser(activeSession);
      localStorage.setItem('gt_active_session', JSON.stringify(activeSession));

      if (activeSession.status === 'blocked' || activeSession.isBanned) {
        showToast('Esta cuenta se encuentra vetada por la administración.');
        return;
      }

      if (isMasterAdmin) {
        setViewMode('admin');
      } else {
        setViewMode('app');
        setActiveTab('inicio');
      }
      showToast(`¡Bienvenido, ${activeSession.companyName || activeSession.name}!`);
      handleAddAuditLog('Inicio de Sesión', `La empresa ${activeSession.companyName || activeSession.name} (${cleanEmail}) ingresó a la aplicación`, 'sistema');
      return;
    }

    let matched = systemUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (!matched) {
      // New user registration
      matched = { 
        email: cleanEmail, 
        name: name || cleanEmail.split('@')[0], 
        companyName: resolvedCompany,
        plan: isMasterAdmin ? 'premium' : 'basic', 
        status: 'active', 
        role: effectiveRole, 
        uid: uid || `user-${Date.now()}`,
        createdAt: nowIso,
        lastLogin: nowIso,
        lastActive: nowIso,
        isBanned: false,
        loginCount: 1
      };
      setSystemUsers(prev => {
        const next = [...prev.filter(u => u.email.toLowerCase() !== cleanEmail), matched!];
        localStorage.setItem('gt_system_users', JSON.stringify(next));
        return next;
      });
      handleAddAuditLog(
        'Nuevo Usuario Registrado',
        `Se ha registrado una nueva empresa en el sistema: ${matched.companyName || matched.name} (${cleanEmail})`,
        'sistema'
      );
    } else {
      matched.role = effectiveRole;
      if (companyName) {
        matched.companyName = companyName;
      }
      matched.lastLogin = nowIso;
      matched.lastActive = nowIso;
      matched.loginCount = (matched.loginCount || 1) + 1;
      if (name && (!matched.name || matched.name === cleanEmail)) {
        matched.name = name;
      }
      setSystemUsers(prev => {
        const next = prev.map(u => u.email.toLowerCase() === cleanEmail ? { ...u, ...matched } : u);
        localStorage.setItem('gt_system_users', JSON.stringify(next));
        return next;
      });
      handleAddAuditLog(
        'Inicio de Sesión',
        `La empresa ${matched.companyName || matched.name} (${cleanEmail}) ingresó a la aplicación`,
        'sistema'
      );
    }

    setCurrentUser(matched);
    localStorage.setItem('gt_active_session', JSON.stringify(matched));

    if (matched.status === 'blocked' || matched.isBanned) {
      showToast('Esta cuenta se encuentra vetada por la administración.');
      return;
    }

    if (isMasterAdmin) {
      setViewMode('admin');
    } else {
      setViewMode('app');
      setActiveTab('inicio');
    }
    showToast(`¡Bienvenido de vuelta, ${matched.name}!`);
  };

  // Enforce role isolation: Non-admins cannot stay in admin viewMode
  useEffect(() => {
    if (viewMode === 'admin' && currentUser && !isUserMasterAdmin(currentUser.email)) {
      setViewMode('app');
    }
  }, [viewMode, currentUser?.email]);

  // --- 5.1 GRACEFUL SIGN-OUT ROUTINE (Specification 6) ---
  const handleLogout = async () => {
    if (!currentUser?.uid) {
      await finishLogoutAndPurge();
      return;
    }

    setIsLogoutModalOpen(true);
    setLogoutStep('syncing');
    setLogoutErrorMsg('');

    // Paso B: Manejo Offline
    if (!navigator.onLine) {
      setLogoutStep('offline_warning');
      return;
    }

    // Paso A: Sincronización final forzada ("flush")
    try {
      await backgroundSyncEngine.flush(currentUser.uid);
      // Paso C: Limpieza y Salida tras confirmar sincronización
      await finishLogoutAndPurge();
    } catch (err: any) {
      console.warn("Logout sync notice:", err);
      setLogoutStep('offline_warning');
    }
  };

  const handleRetryLogoutSync = async () => {
    if (!currentUser?.uid) return;
    setLogoutStep('syncing');
    setLogoutErrorMsg('');

    if (!navigator.onLine) {
      setTimeout(() => setLogoutStep('offline_warning'), 600);
      return;
    }

    try {
      await backgroundSyncEngine.flush(currentUser.uid);
      await finishLogoutAndPurge();
    } catch (err) {
      console.warn("Retry logout sync error:", err);
      setLogoutStep('offline_warning');
    }
  };

  const handleForceLogoutWithoutSync = async () => {
    await finishLogoutAndPurge();
  };

  const finishLogoutAndPurge = async () => {
    try {
      if (currentUser?.uid) {
        // Destroy / clean local IndexedDB of this user to protect financial data privacy
        await localDb.purgeUserData(currentUser.uid);
        localStorage.removeItem(`is_migrated_to_local_${currentUser.uid}`);
      }
      if (currentUser?.email) {
        storageService.remove(`gt_records_${currentUser.email}`);
        storageService.remove(`gt_inventory_${currentUser.email}`);
        storageService.remove(`gt_debts_${currentUser.email}`);
      }
      if (isCloudSyncActive) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn("Logout cleanup note:", e);
    } finally {
      setIsLogoutModalOpen(false);
      setCurrentUser(null);
      setRecords([]);
      setInventory([]);
      setDebts([]);
      localStorage.removeItem('gt_active_session');
      setViewMode('app');
      setIsPlansOpen(false);
    }
  };

  // --- 6. DATABASE ATOMICS (ADD / REMOVE / TOGGLES) WITH OFFLINE AUTO-SYNC ---

  // Sales and expenses additions
  const handleAddNewRecord = async (
    newRec: Omit<FinancialRecord, 'id'>, 
    soldItems?: SoldItemDetail[],
    purchasedItems?: PurchasedItemDetail[]
  ) => {
    const recordId = `rec-${Date.now()}`;
    const recordCurrency = newRec.currency || 'USD';
    const currencySym = recordCurrency === 'EUR' ? '€' : '$';

    const fullRec: FinancialRecord = {
      ...newRec,
      id: recordId,
      currency: recordCurrency,
      soldItems: soldItems && soldItems.length > 0 ? soldItems : newRec.soldItems,
      purchasedItems: purchasedItems && purchasedItems.length > 0 ? purchasedItems : newRec.purchasedItems
    };

    // 1. Instant optimistic state update & persistent local storage for financial records
    const updated = [fullRec, ...records];
    saveRecords(updated);

    // 2a. Automatic stock deduction if products from inventory were sold
    if (soldItems && soldItems.length > 0) {
      let updatedInventory = [...inventory];
      const deductedSummary: string[] = [];

      for (const item of soldItems) {
        updatedInventory = updatedInventory.map(prod => {
          if (prod.id === item.productId) {
            const newStock = Math.max(0, (prod.stock || 0) - item.quantity);
            deductedSummary.push(`${item.quantity}x "${prod.name}" (quedan ${newStock})`);
            return {
              ...prod,
              stock: newStock,
              status: (newStock > 0 ? 'disponible' : 'no_disponible') as 'disponible' | 'no_disponible'
            };
          }
          return prod;
        });
      }

      // Save updated inventory state and local cache
      saveInventory(updatedInventory);

      // Silent background cloud backup for affected stock items
      if (currentUser?.uid) {
        for (const item of soldItems) {
          const prod = updatedInventory.find(p => p.id === item.productId);
          if (prod) {
            backgroundSyncEngine.scheduleSync(currentUser.uid, {
              collection: 'inventory',
              action: 'upsert',
              docId: prod.id,
              payload: prod
            });
          }
        }
      }

      showToast(`¡Venta registrada! Se descontó del inventario: ${deductedSummary.join(', ')}`);

      handleAddAuditLog(
        'Venta con descuento de inventario',
        `Venta de ${currencySym}${newRec.amount} ${recordCurrency}. Descontados: ${deductedSummary.join(', ')}`,
        'inventario'
      );
    } else if (newRec.type === 'egreso' && purchasedItems && purchasedItems.length > 0) {
      // 2b. Automatic stock increment / restocking if products were purchased in this expense
      let updatedInventory = [...inventory];
      const restockedSummary: string[] = [];

      for (const item of purchasedItems) {
        updatedInventory = updatedInventory.map(prod => {
          if (prod.id === item.productId) {
            const newStock = (prod.stock || 0) + item.quantity;
            const newCost = item.unitCost > 0 ? item.unitCost : prod.cost;
            const newCostCurrency = item.currency || (newRec.currency === 'EUR' ? 'EUR' : (newRec.currency === 'USD' ? 'USD' : (prod.costCurrency || 'USD')));
            restockedSummary.push(`${item.quantity}x "${prod.name}" (nuevo stock: ${newStock})`);
            return {
              ...prod,
              stock: newStock,
              cost: newCost,
              costCurrency: newCostCurrency,
              status: 'disponible' as const
            };
          }
          return prod;
        });
      }

      saveInventory(updatedInventory);

      // Silent background cloud backup for restocked items
      if (currentUser?.uid) {
        for (const item of purchasedItems) {
          const prod = updatedInventory.find(p => p.id === item.productId);
          if (prod) {
            backgroundSyncEngine.scheduleSync(currentUser.uid, {
              collection: 'inventory',
              action: 'upsert',
              docId: prod.id,
              payload: prod
            });
          }
        }
      }

      showToast(`¡Gasto registrado! Se sumó al inventario: ${restockedSummary.join(', ')}`);

      handleAddAuditLog(
        'Gasto con ingreso a inventario',
        `Gasto de ${currencySym}${newRec.amount} ${recordCurrency}. Ingresados al inventario: ${restockedSummary.join(', ')}`,
        'inventario'
      );
    } else {
      showToast(`Transacción registrada: ${newRec.type === 'ingreso' ? '＋ Venta' : '－ Gasto'}`);

      handleAddAuditLog(
        newRec.type === 'ingreso' ? 'Registro Ingreso' : 'Registro Gasto',
        `Registrado: ${newRec.type === 'ingreso' ? 'Ingreso/Venta' : 'Gasto'} de ${currencySym}${newRec.amount} ${recordCurrency} | Bs ${newRec.amountBs} (${newRec.description})`,
        'finanzas'
      );
    }

    // 3. Silent background cloud backup of financial record
    if (currentUser?.uid) {
      backgroundSyncEngine.scheduleSync(currentUser.uid, {
        collection: 'records',
        action: 'upsert',
        docId: recordId,
        payload: fullRec
      });
    }
  };

  // Deletion of transactions with automatic inventory reversal
  const handleDeleteRecord = async (id: string, options?: { revertInventory?: boolean }) => {
    const target = records.find(r => r.id === id);
    if (!target) return;

    const shouldRevert = options?.revertInventory !== false;
    let updatedInventory = [...inventory];
    const inventoryAdjustmentsSummary: string[] = [];
    const touchedProducts: InventoryItem[] = [];

    if (shouldRevert) {
      // 1. If it was an EGRESO (merchandise purchase) with purchasedItems, subtract the restocked quantity
      if (target.type === 'egreso' && target.purchasedItems && target.purchasedItems.length > 0) {
        for (const item of target.purchasedItems) {
          updatedInventory = updatedInventory.map(prod => {
            if (prod.id === item.productId) {
              const currentStock = prod.stock || 0;
              const newStock = Math.max(0, currentStock - item.quantity);
              inventoryAdjustmentsSummary.push(
                `"${prod.name}": ${currentStock} ➔ ${newStock} (-${item.quantity} un.)`
              );
              const updatedProd: InventoryItem = {
                ...prod,
                stock: newStock,
                status: newStock === 0 ? ('no_disponible' as const) : ('disponible' as const)
              };
              touchedProducts.push(updatedProd);
              return updatedProd;
            }
            return prod;
          });
        }
      } 
      // 2. If it was an INGRESO (sale) with soldItems, restore the sold quantity
      else if (target.type === 'ingreso' && target.soldItems && target.soldItems.length > 0) {
        for (const item of target.soldItems) {
          updatedInventory = updatedInventory.map(prod => {
            if (prod.id === item.productId) {
              const currentStock = prod.stock || 0;
              const newStock = currentStock + item.quantity;
              inventoryAdjustmentsSummary.push(
                `"${prod.name}": ${currentStock} ➔ ${newStock} (+${item.quantity} un.)`
              );
              const updatedProd: InventoryItem = {
                ...prod,
                stock: newStock,
                status: 'disponible' as const
              };
              touchedProducts.push(updatedProd);
              return updatedProd;
            }
            return prod;
          });
        }
      }
    }

    // If inventory items were modified, save and synchronize
    if (touchedProducts.length > 0) {
      saveInventory(updatedInventory);

      if (currentUser?.uid) {
        for (const prod of touchedProducts) {
          backgroundSyncEngine.scheduleSync(currentUser.uid, {
            collection: 'inventory',
            action: 'upsert',
            docId: prod.id,
            payload: prod
          });
        }
      }
    }

    // Remove from records state and local storage
    const updatedRecords = records.filter(r => r.id !== id);
    saveRecords(updatedRecords);

    // Dynamic Toast
    if (inventoryAdjustmentsSummary.length > 0) {
      showToast(
        `Registro eliminado. Stock revertido: ${inventoryAdjustmentsSummary.join(', ')}`
      );
    } else {
      showToast(`${target.type === 'ingreso' ? 'Ingreso/Venta' : 'Egreso/Compra'} eliminado.`);
    }

    // Audit Log
    const recordLabel = target.type === 'ingreso' ? 'Venta/Ingreso' : 'Compra/Egreso';
    const curSym = target.currency === 'EUR' ? '€' : '$';
    handleAddAuditLog(
      `Eliminar ${recordLabel}`,
      `Eliminado: ${recordLabel} de ${curSym}${target.amount} ${target.currency || 'USD'} (${target.description}).${
        inventoryAdjustmentsSummary.length > 0
          ? ` Inventario restaurado: ${inventoryAdjustmentsSummary.join(' | ')}`
          : ''
      }`,
      touchedProducts.length > 0 ? 'inventario' : 'finanzas'
    );

    // Silent background cloud sync for records deletion
    if (currentUser?.uid) {
      backgroundSyncEngine.scheduleSync(currentUser.uid, {
        collection: 'records',
        action: 'delete',
        docId: id
      });
    }
  };

  // Restock inventory directly from purchase/debt flow
  const handleRestockInventory = async (purchasedItems: PurchasedItemDetail[]) => {
    if (!purchasedItems || purchasedItems.length === 0) return;
    let updatedInventory = [...inventory];
    const restockedSummary: string[] = [];

    for (const item of purchasedItems) {
      updatedInventory = updatedInventory.map(prod => {
        if (prod.id === item.productId) {
          const newStock = (prod.stock || 0) + item.quantity;
          const newCost = item.unitCost > 0 ? item.unitCost : prod.cost;
          const newCostCurrency = item.currency || prod.costCurrency || 'USD';
          restockedSummary.push(`${item.quantity}x "${prod.name}" (nuevo stock: ${newStock})`);
          return {
            ...prod,
            stock: newStock,
            cost: newCost,
            costCurrency: newCostCurrency,
            status: 'disponible' as const
          };
        }
        return prod;
      });
    }

    saveInventory(updatedInventory);

    if (currentUser?.uid) {
      for (const item of purchasedItems) {
        const prod = updatedInventory.find(p => p.id === item.productId);
        if (prod) {
          backgroundSyncEngine.scheduleSync(currentUser.uid, {
            collection: 'inventory',
            action: 'upsert',
            docId: prod.id,
            payload: prod
          });
        }
      }
    }

    showToast(`¡Mercancía a crédito ingresada al inventario! (+${restockedSummary.join(', ')})`);

    handleAddAuditLog(
      'Ingreso mercancía a crédito',
      `Ingresados al inventario: ${restockedSummary.join(', ')}`,
      'inventario'
    );
  };

  // Catalogue product registration
  const handleAddProduct = async (newItem: Omit<InventoryItem, 'id'>): Promise<InventoryItem> => {
    const prodId = `prod-${Date.now()}`;
    const costCur = newItem.costCurrency || newItem.currency || 'USD';
    const priceCur = newItem.priceCurrency || newItem.currency || 'USD';
    const fullItem: InventoryItem = {
      ...newItem,
      costCurrency: costCur,
      priceCurrency: priceCur,
      currency: priceCur === 'EUR' ? 'EUR' : 'USD',
      id: prodId
    };

    const updated = [...inventory, fullItem];
    saveInventory(updated);
    showToast(`Producto "${newItem.name}" añadido al catálogo.`);

    const costCode = costCur === 'VES' ? 'Bs.' : (costCur === 'EUR' ? '€' : '$');
    const priceCode = priceCur === 'VES' ? 'Bs.' : (priceCur === 'EUR' ? '€' : '$');
    handleAddAuditLog(
      'Nuevo producto',
      `Creado producto "${newItem.name}" | Categoría: ${newItem.category || 'General'} | Costo: ${costCode}${newItem.cost} | Venta: ${priceCode}${newItem.price} | Stock: ${newItem.stock}`,
      'inventario'
    );

    if (currentUser?.uid) {
      backgroundSyncEngine.scheduleSync(currentUser.uid, {
        collection: 'inventory',
        action: 'upsert',
        docId: prodId,
        payload: fullItem
      });
    }

    return fullItem;
  };

  // Deletion of catalogue product
  const handleDeleteProduct = async (id: string) => {
    const target = inventory.find(item => item.id === id);
    const updated = inventory.filter(item => item.id !== id);
    saveInventory(updated);
    showToast('Producto eliminado del inventario.');

    if (target) {
      handleAddAuditLog(
        'Eliminar producto',
        `Removido del inventario el producto: "${target.name}" (${target.category || 'General'})`,
        'inventario'
      );
    }

    if (currentUser?.uid) {
      backgroundSyncEngine.scheduleSync(currentUser.uid, {
        collection: 'inventory',
        action: 'delete',
        docId: id
      });
    }
  };

  // Fast stock updates
  const handleUpdateProductStock = async (id: string, newStock: number) => {
    const target = inventory.find(item => item.id === id);
    const updated = inventory.map(item => {
      if (item.id === id) {
        return { 
          ...item, 
          stock: newStock,
          status: (newStock > 0 ? 'disponible' : 'no_disponible') as 'disponible' | 'no_disponible'
        };
      }
      return item;
    });
    saveInventory(updated);

    if (target) {
      handleAddAuditLog(
        'Ajuste stock rápido',
        `Ajustado stock manual para "${target.name}": ${target.stock} ➔ ${newStock} unidades`,
        'inventario'
      );
    }

    if (currentUser?.uid) {
      const prod = updated.find(item => item.id === id);
      if (prod) {
        backgroundSyncEngine.scheduleSync(currentUser.uid, {
          collection: 'inventory',
          action: 'upsert',
          docId: id,
          payload: prod
        });
      }
    }
  };

  // Generic product edits
  const handleUpdateProductDetails = async (id: string, fields: Partial<InventoryItem>) => {
    const target = inventory.find(item => item.id === id);
    const updated = inventory.map(item => {
      if (item.id === id) {
        return { ...item, ...fields };
      }
      return item;
    });
    saveInventory(updated);

    if (target) {
      const parts = [];
      if (fields.name !== undefined) parts.push(`Nombre ➔ "${fields.name}"`);
      if (fields.stock !== undefined) parts.push(`Stock ➔ ${fields.stock}`);
      if (fields.price !== undefined) parts.push(`Precio ➔ $${fields.price}`);
      if (fields.cost !== undefined) parts.push(`Costo ➔ $${fields.cost}`);
      handleAddAuditLog(
        'Editar producto',
        `Modificado "${target.name}": ${parts.join(', ') || 'sin cambios significativos'}`,
        'inventario'
      );
    }

    const updatedItem = updated.find(i => i.id === id);
    if (currentUser?.uid && updatedItem) {
      backgroundSyncEngine.scheduleSync(currentUser.uid, {
        collection: 'inventory',
        action: 'upsert',
        docId: id,
        payload: updatedItem
      });
    }
  };

  // Debt entry creation
  const handleAddDebt = async (newDebt: Omit<DebtItem, 'id' | 'dateCreated'>) => {
    const debtId = `debt-${Date.now()}`;
    const fullDebt: DebtItem = {
      ...newDebt,
      id: debtId,
      dateCreated: getLocalDateString()
    };

    const updated = [fullDebt, ...debts];
    saveDebts(updated);
    showToast(`Deuda de "${newDebt.debtorName}" registrada.`);

    handleAddAuditLog(
      'Crear deuda',
      `Deuda registrada para "${newDebt.debtorName}" por $${newDebt.amount} USD en estatus ${newDebt.type === 'por_cobrar' ? 'Cobrar' : 'Pagar'}`,
      'deudas'
    );

    if (currentUser?.uid) {
      backgroundSyncEngine.scheduleSync(currentUser.uid, {
        collection: 'debts',
        action: 'upsert',
        docId: debtId,
        payload: fullDebt
      });
    }
  };

  // Delete debt entry
  const handleDeleteDebt = async (id: string) => {
    const target = debts.find(d => d.id === id);
    const updated = debts.filter(d => d.id !== id);
    saveDebts(updated);
    showToast('Registro de deuda eliminado.');

    if (target) {
      handleAddAuditLog(
        'Eliminar deudor',
        `Deuda removida para "${target.debtorName}" de valor $${target.amount} USD`,
        'deudas'
      );
    }

    if (currentUser?.uid) {
      backgroundSyncEngine.scheduleSync(currentUser.uid, {
        collection: 'debts',
        action: 'delete',
        docId: id
      });
    }
  };

  // Mark debt as paid / toggle status
  const handleToggleDebtCheck = async (id: string) => {
    const target = debts.find(d => d.id === id);
    if (!target) return;

    const wasPaid = target.status === 'pagado';
    const nextStatus = wasPaid ? 'pendiente' : 'pagado';
    const remainingToCollect = getDebtRemainingAmount(target);

    const updated = debts.map(d => {
      if (d.id === id) {
        if (!wasPaid) {
          return { 
            ...d, 
            status: 'pagado' as const,
            paidAmount: d.amount,
            remainingAmount: 0,
            paidAt: getLocalDateString()
          };
        } else {
          const paymentsPaid = d.payments && d.payments.length > 0 
            ? d.payments.reduce((s, p) => s + (p.amount || 0), 0) 
            : 0;
          return {
            ...d,
            status: 'pendiente' as const,
            paidAmount: paymentsPaid,
            remainingAmount: Math.max(0, Number((d.amount - paymentsPaid).toFixed(2))),
            paidAt: undefined
          };
        }
      }
      return d;
    });
    saveDebts(updated);

    handleAddAuditLog(
      'Cambiar estatus deuda',
      `Deuda de "${target.debtorName}" de $${target.amount} cambiada a ${nextStatus}`,
      'deudas'
    );

    if (!wasPaid) {
      if (remainingToCollect > 0) {
        const calculatedType = target.type === 'por_cobrar' ? 'ingreso' : 'egreso';
        const recordRate = target.exchangeRateUsed || exchangeRates.bcvUsd;
        await handleAddNewRecord({
          type: calculatedType,
          amount: remainingToCollect,
          amountBs: parseFloat((remainingToCollect * recordRate).toFixed(2)),
          exchangeRateUsed: recordRate,
          description: `Liquidación deuda: ${target.debtorName}`,
          category: calculatedType === 'ingreso' ? 'Cobro de Deuda' : 'Pago de Deuda',
          date: getLocalDateString(),
          paymentMethod: 'Efectivo USD'
        });
        showToast('Deuda marcada como pagada. ¡Saldo liquidado en el balance!');
      } else {
        showToast('Deuda marcada como pagada.');
      }
    } else {
      showToast('Estatus de la deuda revertido a pendiente.');
    }

    if (currentUser?.uid) {
      const updatedItem = updated.find(d => d.id === id);
      if (updatedItem) {
        backgroundSyncEngine.scheduleSync(currentUser.uid, {
          collection: 'debts',
          action: 'upsert',
          docId: id,
          payload: updatedItem
        });
      }
    }
  };

  // Apply installment (Abono) to a debt
  const handleApplyDebtPayment = async (
    debtId: string, 
    payment: Omit<DebtPayment, 'id'>, 
    registerAsIncome: boolean
  ) => {
    const target = debts.find(d => d.id === debtId);
    if (!target) return;

    const newPayment: DebtPayment = {
      ...payment,
      id: `pay-${Date.now()}`
    };

    const prevPaid = getDebtPaidAmount(target);
    const newPaid = Number((prevPaid + payment.amount).toFixed(2));
    const newRemaining = Math.max(0, Number((target.amount - newPaid).toFixed(2)));
    const isNowFullyPaid = newRemaining <= 0.001;
    const nextStatus = isNowFullyPaid ? 'pagado' : 'pendiente';

    let linkedRecordId: string | undefined = undefined;

    if (registerAsIncome && payment.amount > 0) {
      const calculatedType = target.type === 'por_cobrar' ? 'ingreso' : 'egreso';
      const recordRate = payment.exchangeRateUsed || exchangeRates.bcvUsd;
      const recordBs = payment.amountBs || parseFloat((payment.amount * recordRate).toFixed(2));
      
      const recordDesc = `Abono de ${target.debtorName}: ${payment.paymentMethod}${payment.reference ? ` (Ref: ${payment.reference})` : ''}`;
      
      linkedRecordId = `rec-${Date.now()}`;
      await handleAddNewRecord({
        type: calculatedType,
        amount: payment.amount,
        amountBs: recordBs,
        exchangeRateUsed: recordRate,
        description: recordDesc,
        category: calculatedType === 'ingreso' ? 'Cobro de Deuda' : 'Pago de Deuda',
        date: payment.date || getLocalDateString(),
        paymentMethod: payment.paymentMethod,
        currency: payment.currency || target.currency || 'USD'
      });
    }

    if (linkedRecordId) {
      newPayment.createdRecordId = linkedRecordId;
    }

    const updatedDebt: DebtItem = {
      ...target,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      status: nextStatus as 'pendiente' | 'pagado',
      paidAt: isNowFullyPaid ? getLocalDateString() : target.paidAt,
      payments: [newPayment, ...(target.payments || [])]
    };

    const updated = debts.map(d => d.id === debtId ? updatedDebt : d);
    saveDebts(updated);

    showToast(`¡Abono de $${payment.amount} registrado para "${target.debtorName}"!`);

    handleAddAuditLog(
      'Registrar abono',
      `Abono de $${payment.amount} a deuda de "${target.debtorName}". Saldo restante: $${newRemaining}`,
      'deudas'
    );

    if (currentUser?.uid) {
      backgroundSyncEngine.scheduleSync(currentUser.uid, {
        collection: 'debts',
        action: 'upsert',
        docId: debtId,
        payload: updatedDebt
      });
    }
  };

  // Update debt fields (e.g. client phone, client ID, notes)
  const handleUpdateDebt = async (debtId: string, updates: Partial<DebtItem>) => {
    const target = debts.find(d => d.id === debtId);
    if (!target) return;

    const updatedDebt: DebtItem = { ...target, ...updates };
    const updated = debts.map(d => d.id === debtId ? updatedDebt : d);
    saveDebts(updated);

    if (currentUser?.uid) {
      backgroundSyncEngine.scheduleSync(currentUser.uid, {
        collection: 'debts',
        action: 'upsert',
        docId: debtId,
        payload: updatedDebt
      });
    }
  };

  // --- 7. ADMIN FUNCTIONS EXECUTED BY LUIS ---

  const handleUpdateSystemUserPlan = async (email: string, plan: 'basic' | 'premium') => {
    if (isCloudSyncActive) {
      const matchUser = systemUsers.find(u => u.email === email);
      if (matchUser?.uid) {
        try {
          await updateDoc(doc(db, 'users', matchUser.uid), { plan });
          showToast(`Suscripción de ${email} cambiada a ${plan.toUpperCase()} en la nube.`);
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      setSystemUsers(prev => prev.map(u => {
        if (u.email === email) {
          return { ...u, plan };
        }
        return u;
      }));
      showToast(`Suscripción de ${email} cambiada a ${plan.toUpperCase()}`);
    }
  };

  const handleBanSystemUser = async (email: string, reason?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const banReason = reason || 'Acceso restringido por la administración';
    const bannedAt = new Date().toISOString();

    if (isCloudSyncActive) {
      const matchUser = systemUsers.find(u => u.email.toLowerCase() === cleanEmail);
      if (matchUser?.uid) {
        try {
          await updateDoc(doc(db, 'users', matchUser.uid), { 
            status: 'blocked',
            isBanned: true,
            banReason,
            bannedAt
          });
          showToast(`Usuario ${cleanEmail} ha sido VETADO en la nube.`);
        } catch (e) {
          console.error(e);
        }
      }
    }

    setSystemUsers(prev => {
      const next = prev.map(u => {
        if (u.email.toLowerCase() === cleanEmail) {
          return { ...u, status: 'blocked' as const, isBanned: true, banReason, bannedAt };
        }
        return u;
      });
      localStorage.setItem('gt_system_users', JSON.stringify(next));
      return next;
    });

    if (currentUser && currentUser.email.toLowerCase() === cleanEmail) {
      const updatedCurrent: UserSession = { 
        ...currentUser, 
        status: 'blocked' as const, 
        isBanned: true, 
        banReason, 
        bannedAt 
      };
      setCurrentUser(updatedCurrent);
      localStorage.setItem('gt_active_session', JSON.stringify(updatedCurrent));
    }

    handleAddAuditLog(
      'Veto de Usuario',
      `Administrador vetó a ${cleanEmail}. Razón: ${banReason}`,
      'sistema'
    );
    showToast(`Usuario ${cleanEmail} ha sido VETADO.`);
  };

  const handleUnbanSystemUser = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (isCloudSyncActive) {
      const matchUser = systemUsers.find(u => u.email.toLowerCase() === cleanEmail);
      if (matchUser?.uid) {
        try {
          await updateDoc(doc(db, 'users', matchUser.uid), { 
            status: 'active',
            isBanned: false,
            banReason: null,
            bannedAt: null
          });
          showToast(`Se ha removido el veto para ${cleanEmail} en la nube.`);
        } catch (e) {
          console.error(e);
        }
      }
    }

    setSystemUsers(prev => {
      const next = prev.map(u => {
        if (u.email.toLowerCase() === cleanEmail) {
          return { ...u, status: 'active' as const, isBanned: false, banReason: undefined, bannedAt: undefined };
        }
        return u;
      });
      localStorage.setItem('gt_system_users', JSON.stringify(next));
      return next;
    });

    if (currentUser && currentUser.email.toLowerCase() === cleanEmail) {
      const updatedCurrent: UserSession = { 
        ...currentUser, 
        status: 'active' as const, 
        isBanned: false, 
        banReason: undefined, 
        bannedAt: undefined 
      };
      setCurrentUser(updatedCurrent);
      localStorage.setItem('gt_active_session', JSON.stringify(updatedCurrent));
    }

    handleAddAuditLog(
      'Veto Levantado',
      `Administrador levantó el veto para ${cleanEmail}`,
      'sistema'
    );
    showToast(`Se ha removido el veto para ${cleanEmail}`);
  };

  const handleDeleteSystemUser = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (isCloudSyncActive) {
      const matchUser = systemUsers.find(u => u.email.toLowerCase() === cleanEmail);
      if (matchUser?.uid) {
        try {
          await deleteDoc(doc(db, 'users', matchUser.uid));
        } catch (e) {
          console.error(e);
        }
      }
    }
    setSystemUsers(prev => {
      const next = prev.filter(u => u.email.toLowerCase() !== cleanEmail);
      localStorage.setItem('gt_system_users', JSON.stringify(next));
      return next;
    });
    handleAddAuditLog(
      'Usuario Eliminado',
      `Administrador eliminó el registro de ${cleanEmail}`,
      'sistema'
    );
    showToast(`Usuario ${cleanEmail} eliminado.`);
  };

  // Monetization rates
  const handleAddMonetizationPlan = (newPlan: MonetizationPlan) => {
    setSystemPlans(prev => [...prev, newPlan]);
    showToast(`Plan "${newPlan.name}" creado con éxito.`);
  };

  const handleUpdateMonetizationPlan = (updatedPlan: MonetizationPlan) => {
    setSystemPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    showToast(`Plan "${updatedPlan.name}" actualizado.`);
  };

  const handleDeleteMonetizationPlan = (id: string) => {
    setSystemPlans(prev => prev.filter(p => p.id !== id));
    showToast('Plan de monetización retirado.');
  };

  // Base subscribe plan
  const handleSelectedSubscribeSimulated = async (plan: MonetizationPlan) => {
    if (currentUser) {
      if (isCloudSyncActive && currentUser.uid) {
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), { plan: 'premium' });
          showToast(`¡Felicidades! Te has suscrito al "${plan.name}" con éxito.`);
          setIsPlansOpen(false);
        } catch (e) {
          console.error(e);
        }
      } else {
        setSystemUsers(prev => prev.map(u => {
          if (u.email === currentUser.email) {
            return { ...u, plan: 'premium' };
          }
          return u;
        }));
        setIsPlansOpen(false);
        showToast(`¡Felicidades! Te has suscrito al "${plan.name}" con éxito.`);
      }
    }
  };


  // --- 8. SECURITY EXPULSION LOCK AND RENDER ROUTING ---

  // Checked on every render: User vetoed or blocked
  if (currentUser && (currentUser.status === 'blocked' || currentUser.isBanned)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-rose-50 px-6 py-12 text-center select-none animate-fade-in">
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-rose-200">
          <ShieldAlert className="w-10 h-10 animate-bounce text-rose-600" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-black uppercase tracking-wider mb-2 border border-rose-200">
          Cuenta Vetada
        </div>
        <h1 className="text-2xl font-black text-rose-900 tracking-tight">Acceso Restringido</h1>
        <p className="text-sm text-rose-700 font-medium leading-relaxed max-w-md mt-2">
          Tu cuenta ha sido vetada por la administración del sistema. No tienes autorización para ingresar ni utilizar las herramientas de la aplicación.
        </p>

        {currentUser.banReason && (
          <div className="mt-4 p-4 rounded-2xl bg-white border border-rose-200 text-left max-w-sm w-full shadow-xs">
            <span className="text-[10px] uppercase font-bold text-rose-500 block">Motivo del Veto:</span>
            <p className="text-xs font-medium text-slate-800 mt-1 leading-relaxed">
              "{currentUser.banReason}"
            </p>
            {currentUser.bannedAt && (
              <span className="text-[9px] text-slate-400 block mt-2 font-mono">
                Fecha: {new Date(currentUser.bannedAt).toLocaleString('es-VE')}
              </span>
            )}
          </div>
        )}

        <button 
          onClick={handleLogout} 
          className="mt-8 px-6 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold font-mono tracking-wider transition-all shadow-md shadow-rose-200 cursor-pointer"
          id="btn-logout-blocked"
        >
          SALIR DE LA CUENTA
        </button>
      </div>
    );
  }

  // Auth gate
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const isMasterAdmin = isUserMasterAdmin(currentUser.email);

  // Full page Admin Portal as requested by user
  if (viewMode === 'admin' && isMasterAdmin) {
    return (
      <AdminPortal
        currentUser={currentUser}
        onExitToApp={() => setViewMode('app')}
        onLogout={handleLogout}
        usersList={systemUsers}
        onUpdateUserPlan={handleUpdateSystemUserPlan}
        onBanUser={handleBanSystemUser}
        onUnbanUser={handleUnbanSystemUser}
        onDeleteUser={handleDeleteSystemUser}
        plans={systemPlans}
        onAddPlan={handleAddMonetizationPlan}
        onUpdatePlan={handleUpdateMonetizationPlan}
        onDeletePlan={handleDeleteMonetizationPlan}
        currentRates={exchangeRates}
        onRatesUpdated={(newRates) => {
          setExchangeRates(newRates);
          ratesService.saveManualRates(newRates);
        }}
        auditLogs={auditLogs}
        proFeaturesConfig={proFeaturesConfig}
        onUpdateProConfig={handleUpdateProConfig}
        isOnline={isOnline}
        isCloudActive={isCloudSyncActive}
        recordsCount={records.length}
        inventoryCount={inventory.length}
        debtsCount={debts.length}
      />
    );
  }

  // Pro Feature Access Gate based on Admin Configuration
  const isFeatureProLocked = (featureId: keyof ProFeaturesConfig): boolean => {
    if (isMasterAdmin || currentUser?.plan === 'premium') return false;
    return Boolean(proFeaturesConfig && proFeaturesConfig[featureId]);
  };

  const renderProPaywall = (featureName: string) => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fade-in max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4 shadow-sm border border-amber-200">
        <Crown className="w-8 h-8 text-amber-500 fill-amber-400" />
      </div>
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-black uppercase tracking-wider mb-3 border border-amber-200">
        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
        Módulo Exclusivo Pro
      </div>
      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
        {featureName} está configurado como Pro
      </h2>
      <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2 leading-relaxed">
        El administrador ha configurado el módulo de <strong>{featureName}</strong> como una función exclusiva para miembros con suscripción Pro. Actualiza tu cuenta para disfrutar de acceso ilimitado.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
        <button
          type="button"
          onClick={() => setActiveTab('inicio')}
          className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
        >
          Volver al Inicio
        </button>
        <button
          type="button"
          onClick={() => setIsPlansOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
        >
          <Crown className="w-4 h-4 text-slate-950" />
          <span>Ver Planes Pro</span>
        </button>
      </div>
    </div>
  );

  // Render proper view based on active navbar index
  const renderTabContent = () => {
    switch (activeTab) {
      case 'inicio':
        return (
          <TabInicio
            userPlan={currentUser.plan}
            rates={exchangeRates}
            onRefreshRates={handleUpdateRates}
            onOpenSale={() => setIsSaleOpen(true)}
            onOpenExpense={() => setIsExpenseOpen(true)}
            onChangeTab={setActiveTab}
            onShowPlansDialog={() => setIsPlansOpen(true)}
            inventory={inventory}
            userEmail={currentUser.email}
            records={records}
            onAddRecord={handleAddNewRecord}
            debts={debts}
            onAddDebt={handleAddDebt}
            onDeleteDebt={handleDeleteDebt}
            onToggleDebtPaid={handleToggleDebtCheck}
            selectedCurrency={selectedCurrency}
            proFeaturesConfig={proFeaturesConfig}
            isOnline={isOnline}
            isCloudActive={isCloudSyncActive}
          />
        );
      case 'balance':
        return (
          <TabBalance
            records={records}
            inventory={inventory}
            onDeleteRecord={handleDeleteRecord}
            onOpenSale={() => setIsSaleOpen(true)}
            onOpenExpense={() => setIsExpenseOpen(true)}
            rates={exchangeRates}
            onNavigateToGeneralBalance={() => setActiveTab('balance_general')}
            selectedCurrency={selectedCurrency}
          />
        );
      case 'cotizaciones':
        if (isFeatureProLocked('cotizaciones')) {
          return renderProPaywall('Cotizaciones');
        }
        return (
          <SuggestedQuotes
            inventory={inventory}
            rates={exchangeRates}
            userEmail={currentUser.email}
            onClose={() => setActiveTab('inicio')}
          />
        );
      case 'inventario':
        if (isFeatureProLocked('inventario')) {
          return renderProPaywall('Inventario de Productos');
        }
        return (
          <TabInventario
            inventory={inventory}
            records={records}
            onDeleteRecord={handleDeleteRecord}
            onAddProduct={handleAddProduct}
            onDeleteProduct={handleDeleteProduct}
            onUpdateProductStock={handleUpdateProductStock}
            onUpdateProductDetails={handleUpdateProductDetails}
            onOpenCreateModal={() => setIsCreateProductOpen(true)}
            onOpenExpense={() => setIsExpenseOpen(true)}
            onSellProduct={(item) => {
              setSalePreselectedProductId(item.id);
              setIsSaleOpen(true);
            }}
            rates={exchangeRates}
            selectedCurrency={selectedCurrency}
            userEmail={currentUser?.email}
          />
        );
      case 'deudas':
        if (isFeatureProLocked('deudas')) {
          return renderProPaywall('Control de Deudas y Cobros');
        }
        return (
          <TabDeudas
            debts={debts}
            onAddDebt={handleAddDebt}
            onDeleteDebt={handleDeleteDebt}
            onToggleDebtPaid={handleToggleDebtCheck}
            onApplyPayment={handleApplyDebtPayment}
            onUpdateDebt={handleUpdateDebt}
            rates={exchangeRates}
            onOpenSale={() => setIsSaleOpen(true)}
            selectedCurrency={selectedCurrency}
            userEmail={currentUser?.email}
            companyName={currentUser?.companyName || 'Finova Comercio'}
          />
        );
      case 'clientes':
        if (isFeatureProLocked('clientes')) {
          return renderProPaywall('Gestión de Clientes');
        }
        return (
          <SuggestedClients
            userEmail={currentUser.email}
            rates={exchangeRates}
            onAddRecord={handleAddNewRecord}
            onClose={() => setActiveTab('inicio')}
          />
        );
      case 'estadisticas':
        if (isFeatureProLocked('estadisticas')) {
          return renderProPaywall('Estadísticas y Análisis');
        }
        return (
          <SuggestedStats
            records={records}
            inventory={inventory}
            rates={exchangeRates}
            onClose={() => setActiveTab('inicio')}
          />
        );
      case 'proveedores':
        return (
          <SuggestedSuppliers
            userEmail={currentUser.email}
            onClose={() => setActiveTab('inicio')}
          />
        );
      case 'empleados':
        return (
          <SuggestedEmployees
            userEmail={currentUser.email}
            onAddRecord={handleAddNewRecord}
            onClose={() => setActiveTab('inicio')}
          />
        );
      case 'balance_general':
        if (isFeatureProLocked('balance_general')) {
          return renderProPaywall('Balance General y Auditoría');
        }
        return (
          <TabBalanceGeneral
            records={records}
            inventory={inventory}
            debts={debts}
            rates={exchangeRates}
            selectedCurrency={selectedCurrency}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-slate-900 select-none font-sans antialiased text-slate-800 overflow-hidden">
      
      {/* RESPONSIVE CONTAINER - Fullscreen PWA on mobile, spacious desktop web app on PC */}
      <div className="w-full h-full bg-slate-50 overflow-hidden flex flex-col relative transition-all duration-300">

        {/* --- MOBILE HEADER (Warm TreintaApp style with Currency Switcher) --- */}
        <header className="md:hidden shrink-0 bg-amber-400 text-slate-950 px-3 py-2.5 shadow-xs flex items-center justify-between z-35">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* App Brand Logo */}
            <AppLogo size="sm" variant="icon" className="shrink-0 ring-1 ring-amber-500/50 shadow-xs" />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-black text-xs text-slate-950 truncate">
                  {currentUser.companyName || currentUser.name || 'Mi Empresa'}
                </span>
                {currentUser.plan === 'premium' && (
                  <Crown className="w-3 h-3 text-amber-900 fill-amber-500 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[10px] text-slate-800 font-bold leading-tight truncate">
                  {currentUser.role === 'admin' ? 'Administrador' : 'Empresa'} • {currentUser.plan === 'premium' ? '★ Pro' : 'Básico'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Currency Selector ($ USD / € EUR) */}
            <div className="flex items-center bg-amber-500/40 p-0.5 rounded-xl border border-amber-600/20">
              <button
                type="button"
                onClick={() => handleCurrencyChange('USD')}
                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                  selectedCurrency === 'USD'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'text-slate-900 hover:text-slate-950'
                }`}
                title="Ver valores en Dólares ($)"
              >
                $ USD
              </button>
              <button
                type="button"
                onClick={() => handleCurrencyChange('EUR')}
                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                  selectedCurrency === 'EUR'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'text-slate-900 hover:text-slate-950'
                }`}
                title="Ver valores en Euros (€)"
              >
                € EUR
              </button>
            </div>

            {/* Admin Portal Toggle for Luis / SuperAdmin */}
            {isMasterAdmin && (
              <button
                type="button"
                onClick={() => setViewMode('admin')}
                className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 text-amber-400 border border-amber-400/60 rounded-xl text-[10.5px] font-black flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                title="Ir al Panel de Administración Central"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Panel Admin</span>
              </button>
            )}

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-slate-900 hover:bg-amber-500/40 rounded-xl transition-all cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4 text-slate-950" />
            </button>
          </div>
        </header>

        {/* --- DESKTOP / PC HEADER (Cross-platform responsive design with Currency Selector) --- */}
        <header className="hidden md:flex shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-3 items-center justify-between z-35 shadow-xs">
          {/* Left: Store identity & role */}
          <div className="flex items-center gap-3">
            <AppLogo size="md" variant="icon" className="shrink-0 shadow-sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-slate-900 tracking-tight">
                  {currentUser.companyName || currentUser.name || 'Mi Empresa'}
                </span>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                  {currentUser.role === 'admin' ? 'Administrador' : 'Empresa'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  {currentUser.plan === 'premium' ? '★ Plan Pro' : 'Plan Básico'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Finova Pro • Panel de Gestión Empresarial
              </p>
            </div>
          </div>

          {/* Center: Live BCV Exchange Ticker */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 px-4 py-1.5 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-500">BCV USD:</span>
              <span className="text-xs font-black font-mono text-slate-900">
                Bs. {exchangeRates.bcvUsd.toFixed(2)}
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">BCV EUR:</span>
              <span className="text-xs font-black font-mono text-slate-900">
                Bs. {exchangeRates.bcvEur.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={refreshRates}
              className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              title="Actualizar tasas BCV"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right: Currency Toggle & Quick actions */}
          <div className="flex items-center gap-2.5">
            {/* Currency Selector Pill */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleCurrencyChange('USD')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  selectedCurrency === 'USD'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Moneda principal: Dólar ($)"
              >
                $ USD
              </button>
              <button
                type="button"
                onClick={() => handleCurrencyChange('EUR')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  selectedCurrency === 'EUR'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Moneda principal: Euro (€)"
              >
                € EUR
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsSaleOpen(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Nueva Venta</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpenseOpen(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Minus className="w-3.5 h-3.5" />
              <span>- Nuevo Gasto</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPlansOpen(true)}
              className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all cursor-pointer"
              title="Planes de suscripción"
            >
              <Crown className="w-4 h-4" />
            </button>

            {/* Admin Portal button for Luis */}
            {isMasterAdmin && (
              <button
                type="button"
                onClick={() => setViewMode('admin')}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Ir al Panel de Administrador"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Panel Admin</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* --- DESKTOP NAVIGATION TABS BAR (Visible on PC / Desktop >= md) --- */}
        <div className="hidden md:flex bg-white border-b border-slate-200/80 px-6 py-2 items-center justify-between">
          <nav className="flex items-center gap-1 max-w-6xl overflow-x-auto no-scrollbar">
            {[
              { id: 'inicio', label: 'Inicio', icon: Home },
              { id: 'balance', label: 'Balance', icon: BarChart2 },
              { id: 'deudas', label: 'Deudas', icon: Receipt },
              { id: 'inventario', label: 'Inventario', icon: BookOpen },
              { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText },
              { id: 'clientes', label: 'Clientes', icon: Users },
              { id: 'estadisticas', label: 'Estadísticas', icon: TrendingUp },
              { id: 'proveedores', label: 'Proveedores', icon: Truck },
              { id: 'empleados', label: 'Empleados', icon: Briefcase },
              { id: 'balance_general', label: 'Balance General', icon: PieChart },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer relative ${
                    isActive ? 'text-blue-600 font-extrabold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="desktopNavActiveIndicator"
                      className="absolute inset-0 bg-blue-50/80 rounded-xl border border-blue-200/80 -z-10"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* --- MAIN SCROLLABLE CONTENT BODY --- */}
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-8 lg:px-12 py-5 space-y-4 no-scrollbar bg-slate-50 relative">
          <div className="space-y-6 pb-24 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {renderTabContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* --- DOCKED NAVIGATION & FOOTER CREDIT --- */}
        {/* MOBILE BOTTOM NAVIGATION BAR (TreintaApp style from Screenshots 1, 2, 3, 4) */}
        <div className="md:hidden shrink-0 bg-white/98 backdrop-blur-md border-t border-slate-200/80 z-45 shadow-[0_-4px_20px_rgba(15,23,42,0.04)]">
          <nav className="pt-1.5 pb-1 px-2 flex justify-between items-center relative">
            {/* 1. Inicio */}
            <button
              type="button"
              onClick={() => setActiveTab('inicio')}
              className={`flex flex-col items-center flex-1 py-1 transition-all relative cursor-pointer ${
                activeTab === 'inicio' ? 'text-blue-600 font-extrabold' : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <Home className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight font-semibold">Inicio</span>
              {activeTab === 'inicio' && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5"></span>
              )}
            </button>

            {/* 2. Balance */}
            <button
              type="button"
              onClick={() => setActiveTab('balance')}
              className={`flex flex-col items-center flex-1 py-1 transition-all relative cursor-pointer ${
                activeTab === 'balance' ? 'text-blue-600 font-extrabold' : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <BarChart2 className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight font-semibold">Balance</span>
              {activeTab === 'balance' && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5"></span>
              )}
            </button>

            {/* 3. Center Crown / Mascot Elevated Button (Screenshots 1, 2, 3, 4) */}
            <div className="flex flex-col items-center flex-1 -mt-5 relative z-20">
              <button
                type="button"
                onClick={() => setIsPlansOpen(true)}
                className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-black flex items-center justify-center shadow-lg shadow-amber-500/30 border-2 border-white cursor-pointer active:scale-90 transition-transform"
                title="Planes y Mejoras"
              >
                <Crown className="w-6 h-6 text-slate-950" />
              </button>
              <span className="text-[9px] tracking-tight font-bold text-amber-800 mt-0.5">Planes</span>
            </div>

            {/* 4. Deudas */}
            <button
              type="button"
              onClick={() => setActiveTab('deudas')}
              className={`flex flex-col items-center flex-1 py-1 transition-all relative cursor-pointer ${
                activeTab === 'deudas' ? 'text-blue-600 font-extrabold' : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <Receipt className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight font-semibold">Deudas</span>
              {activeTab === 'deudas' && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5"></span>
              )}
            </button>

            {/* 5. Inventario */}
            <button
              type="button"
              onClick={() => setActiveTab('inventario')}
              className={`flex flex-col items-center flex-1 py-1 transition-all relative cursor-pointer ${
                activeTab === 'inventario' ? 'text-blue-600 font-extrabold' : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <BookOpen className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight font-semibold">Inventario</span>
              {activeTab === 'inventario' && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5"></span>
              )}
            </button>
          </nav>
          <div className="h-[max(0.25rem,env(safe-area-inset-bottom))] bg-white"></div>
        </div>

        {/* DESKTOP FOOTER BAR (Visible on PC / Desktop screens >= md) */}
        <div className="hidden md:flex items-center justify-between px-6 py-2.5 bg-white border-t border-slate-200/80 text-[10.5px] text-slate-400 font-medium">
          <div className="font-bold text-slate-600 flex items-center gap-1.5">
            <AppLogo size="sm" variant="icon" className="w-4 h-4 rounded-md" />
            <span>Mifinanzas.com</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Tasa Oficial BCV: <strong className="text-slate-800 font-mono">Bs. {exchangeRates.bcvUsd.toFixed(2)}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium">Sistema Financiero & Administrativo</span>
          </div>
        </div>

      </div>

      {/* --- MOBILE "MORE MODULES" DRAWER MODAL --- */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 p-5 space-y-4 animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Grid className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Módulos del Sistema</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Selecciona el módulo al que deseas acceder</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('cotizaciones');
                  setIsMobileMenuOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  activeTab === 'cotizaciones' ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-black' : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/60 text-slate-700'
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold">Cotizaciones</span>
                <span className="text-[9px] text-slate-400">Presupuestos y WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('deudas');
                  setIsMobileMenuOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  activeTab === 'deudas' ? 'bg-amber-50 border-amber-200 text-amber-900 font-black' : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/60 text-slate-700'
                }`}
              >
                <Receipt className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold">Deudas</span>
                <span className="text-[9px] text-slate-400">Por cobrar y por pagar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('clientes');
                  setIsMobileMenuOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  activeTab === 'clientes' ? 'bg-blue-50 border-blue-200 text-blue-900 font-black' : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/60 text-slate-700'
                }`}
              >
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold">Clientes</span>
                <span className="text-[9px] text-slate-400">Fichas y cobros</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('estadisticas');
                  setIsMobileMenuOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  activeTab === 'estadisticas' ? 'bg-purple-50 border-purple-200 text-purple-900 font-black' : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/60 text-slate-700'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold">Estadísticas</span>
                <span className="text-[9px] text-slate-400">Métricas y tendencias</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('proveedores');
                  setIsMobileMenuOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  activeTab === 'proveedores' ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-black' : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/60 text-slate-700'
                }`}
              >
                <Truck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold">Proveedores</span>
                <span className="text-[9px] text-slate-400">Mayoristas y pedidos</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('empleados');
                  setIsMobileMenuOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  activeTab === 'empleados' ? 'bg-cyan-50 border-cyan-200 text-cyan-900 font-black' : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/60 text-slate-700'
                }`}
              >
                <Briefcase className="w-4 h-4 text-cyan-600" />
                <span className="text-xs font-bold">Empleados</span>
                <span className="text-[9px] text-slate-400">Nómina y comisiones</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('balance_general');
                  setIsMobileMenuOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 col-span-2 ${
                  activeTab === 'balance_general' ? 'bg-sky-50 border-sky-200 text-sky-900 font-black' : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/60 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold">Balance General</span>
                </div>
                <span className="text-[9px] text-slate-400">Patrimonio neto, capital de trabajo y salud financiera</span>
              </button>
            </div>

            <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsPlansOpen(true);
                }}
                className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Crown className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>Ver Planes y Membresías</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- GLOBAL TOAST NOTIFICATION ALERT --- */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-55 bg-slate-900 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-xl flex items-center gap-2 border border-blue-50/50"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MONETISATION PLANS PRESENTATION DIALOG --- */}
      {isPlansOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-blue-100 flex flex-col max-h-[85vh]">
            <div className="p-4 bg-gradient-to-tr from-blue-700 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Crown className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>Planes de Membresía</span>
              </div>
              <button 
                onClick={() => setIsPlansOpen(false)}
                className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-grow">
              <p className="text-xs text-slate-500 leading-relaxed text-center">
                Adquiere una membresía para habilitar analíticas avanzadas, clientes ilimitados, catálogos digitales interactivos y soporte prioritario.
              </p>

              <div className="space-y-3">
                {systemPlans.map((plan) => (
                  <div 
                    key={plan.id}
                    className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-2xl flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 uppercase">
                          {plan.name}
                          {plan.id === 'plan-premium' && (
                            <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded font-bold">
                              RECOMENDADO
                            </span>
                          )}
                        </h4>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">{plan.features.length} beneficios activos</span>
                      </div>

                      <div className="text-right">
                        <strong className="text-sm font-black text-blue-600 block">${plan.price}</strong>
                        <span className="text-[9px] text-slate-400 uppercase font-black uppercase">por {plan.frequency}</span>
                      </div>
                    </div>

                    <ul className="mt-3.5 space-y-1.5 text-[10px] text-slate-500 font-medium pl-1">
                      {plan.features.map((f, idx) => {
                        const isNoAds = f.includes('Sin anuncios') || f.includes('removida');
                        const isHasAds = f.includes('Contiene publicidad') || f.includes('anuncios');
                        return (
                          <li key={idx} className="flex items-start gap-1.5 leading-normal">
                            <span className={isNoAds ? "text-amber-500 font-bold" : isHasAds && !isNoAds ? "text-slate-400" : "text-emerald-500"}>
                              {isNoAds ? '★' : isHasAds && !isNoAds ? '⚠' : '✓'}
                            </span>
                            <span className={isNoAds ? "text-amber-600 font-extrabold text-slate-700" : isHasAds && !isNoAds ? "text-slate-450 italic" : ""}>
                              {f}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Simulates activation */}
                    <button
                      onClick={() => handleSelectedSubscribeSimulated(plan)}
                      className={`w-full py-2 mt-3 rounded-xl font-bold text-[10px] tracking-wide transition-all active:scale-95 ${
                        currentUser.plan === 'premium' && plan.id === 'plan-premium'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 pointer-events-none'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200'
                      }`}
                    >
                      {currentUser.plan === 'premium' && plan.id === 'plan-premium'
                        ? '★ PLAN PREMIUM ACTIVO'
                        : `SUSCRIBIRSE POR $${plan.price}`
                      }
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Soporte: info@galaxystore.com</span>
              <span>100% Garantía Reembolso</span>
            </div>
          </div>
        </div>
      )}

      {/* --- INBOUND MODAL DIALOG PORTALS --- */}

      {/* A. Sale Flow Modal (Configured exactly as in user images with 3-step process) */}
      <SaleFlowModal
        isOpen={isSaleOpen}
        onClose={() => {
          setIsSaleOpen(false);
          setSalePreselectedProductId(null);
        }}
        onCompleteSale={(record, soldItems) => {
          handleAddNewRecord(record, soldItems);
        }}
        onAddDebt={(debt) => {
          handleAddDebt(debt);
        }}
        rates={exchangeRates}
        initialCurrency={selectedCurrency}
        inventory={inventory}
        onAddProduct={handleAddProduct}
        onOpenQuotes={() => setActiveTab('cotizaciones')}
        currentUserEmail={currentUser?.email}
        preSelectedProductId={salePreselectedProductId}
      />

      {/* B. Expense Flow Modal */}
      <ExpenseFlowModal
        isOpen={isExpenseOpen}
        onClose={() => setIsExpenseOpen(false)}
        onCompleteExpense={(rec, purchasedItems) => handleAddNewRecord(rec, undefined, purchasedItems)}
        onAddDebt={handleAddDebt}
        onRestockInventory={handleRestockInventory}
        onAddProduct={handleAddProduct}
        rates={exchangeRates}
        initialCurrency={selectedCurrency}
        inventory={inventory}
        currentUserEmail={currentUser?.email}
        onNavigateToDeudas={() => setActiveTab('deudas')}
      />

      {/* C. Create Product catalogue */}
      <AddInventoryModal
        isOpen={isCreateProductOpen}
        onClose={() => setIsCreateProductOpen(false)}
        onSubmit={handleAddProduct}
        rates={exchangeRates}
      />

      {/* D. Create Debt entry */}
      <AddDebtModal
        isOpen={isCreateDebtOpen}
        onClose={() => setIsCreateDebtOpen(false)}
        onSubmit={handleAddDebt}
        rates={exchangeRates}
        initialCurrency={selectedCurrency}
        currentUserEmail={currentUser?.email}
      />

      {/* E. Graceful Sign-Out Routine Modal (Specification 6) */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        step={logoutStep}
        onRetry={handleRetryLogoutSync}
        onForceLogout={handleForceLogoutWithoutSync}
        onCancel={() => setIsLogoutModalOpen(false)}
        errorMessage={logoutErrorMsg}
      />

      {/* Floating PWA Install Prompt */}
      <FloatingInstallPrompt />

    </div>
  );
}
