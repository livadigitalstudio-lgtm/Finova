import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Mic, MicOff, Send, Plus, 
  CheckCircle2, DollarSign, Users, ShoppingBag, 
  ArrowDownRight, RotateCcw, Square, Volume2, 
  Sparkles, Check, AlertCircle, Trash2, ShieldCheck, 
  UserMinus, Boxes, Calculator
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ExchangeRates, FinancialRecord, InventoryItem, DebtItem } from '../types';
import { getLocalDateString } from '../utils/dateUtils';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  todaySales: number;
  todayExpenses: number;
  todayBalance: number;
  totalInventoryValue: number;
  currency: string;
  rates: ExchangeRates;
  inventory: InventoryItem[];
  debts: DebtItem[];
  records?: FinancialRecord[];
  clients?: any[];
  companyName?: string;
  userName?: string;
  onAddNewRecord: (record: Omit<FinancialRecord, 'id'>, soldItems?: any[]) => void;
  onAddNewDebt?: (debt: Omit<DebtItem, 'id' | 'dateCreated'>) => void;
  onAddNewClient?: (client: { name: string; phone?: string; location?: string; notes?: string }) => void;
  onDeleteClient?: (clientNameOrId: string) => boolean | Promise<boolean>;
  onDeleteRecord?: (id: string, options?: { revertInventory?: boolean }) => Promise<void> | void;
  onDeleteDebt?: (id: string) => Promise<void> | void;
  onSettleClientDebts?: (clientName: string) => Promise<{ settledCount: number; totalAmount: number }> | any;
  onAddInventoryProduct?: (product: Omit<InventoryItem, 'id'>) => Promise<InventoryItem> | InventoryItem | any;
  onDeleteInventoryProduct?: (productId: string) => Promise<void> | void;
  onUpdateInventoryStock?: (productId: string, newStock: number) => Promise<void> | void;
}

interface ActionCardDetail {
  type: 'record_sale' | 'record_expense' | 'record_debt' | 'record_client' | 'delete_client' | 'delete_transaction' | 'settle_client' | 'add_inventory_product' | 'delete_inventory_product' | 'update_inventory_stock' | 'calculate_math';
  title: string;
  amount?: number;
  currency?: string;
  concept?: string;
  details?: string;
  extraBadge?: string;
}

interface MessageHistory {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actionCard?: ActionCardDetail | null;
  timestamp: Date;
}

// Iconic Gemini 4-Point Multi-Color Sparkle Star
const GeminiStar = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    <defs>
      <linearGradient id="geminiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4285F4" />
        <stop offset="35%" stopColor="#24C1E0" />
        <stop offset="70%" stopColor="#FBBC04" />
        <stop offset="100%" stopColor="#EA4335" />
      </linearGradient>
    </defs>
    <path 
      d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z" 
      fill="url(#geminiGrad)" 
    />
  </svg>
);

export default function VoiceAssistantModal({
  isOpen,
  onClose,
  todaySales,
  todayExpenses,
  todayBalance,
  totalInventoryValue,
  currency,
  rates,
  inventory,
  debts,
  records = [],
  clients = [],
  companyName,
  userName,
  onAddNewRecord,
  onAddNewDebt,
  onAddNewClient,
  onDeleteClient,
  onDeleteRecord,
  onDeleteDebt,
  onSettleClientDebts,
  onAddInventoryProduct,
  onDeleteInventoryProduct,
  onUpdateInventoryStock,
}: VoiceAssistantModalProps) {
  // Messages state: starts empty to show the Gemini center greeting
  const [messages, setMessages] = useState<MessageHistory[]>([]);
  const [textInput, setTextInput] = useState('');

  // Voice speech & mic states (Direct microphone access - zero friction)
  const [voiceSpeakingEnabled, setVoiceSpeakingEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [listeningMode, setListeningMode] = useState<'dictation' | 'live' | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechInterim, setSpeechInterim] = useState('');
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const pendingListeningModeRef = useRef<'dictation' | 'live'>('dictation');

  // Available high-quality natural voices
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceGender, setSelectedVoiceGender] = useState<'female' | 'male' | 'auto'>('auto');
  const [showVoicePicker, setShowVoicePicker] = useState(false);

  // References
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const voiceSpeakingEnabledRef = useRef(voiceSpeakingEnabled);
  const listeningModeRef = useRef(listeningMode);
  const isOpenRef = useRef(isOpen);
  const textInputRef = useRef(textInput);
  const textBeforeDictationRef = useRef('');

  useEffect(() => {
    voiceSpeakingEnabledRef.current = voiceSpeakingEnabled;
  }, [voiceSpeakingEnabled]);

  useEffect(() => {
    listeningModeRef.current = listeningMode;
  }, [listeningMode]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    textInputRef.current = textInput;
  }, [textInput]);

  // Load and cache high-quality natural voices asynchronously
  const populateVoices = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const spanish = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('es'));
      setAvailableVoices(spanish.length > 0 ? spanish : voices);
    }
  }, []);

  useEffect(() => {
    populateVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [populateVoices]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopListening();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto-scroll chat to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isProcessing, scrollToBottom]);

  // --- NATURAL HUMAN VOICE SYNTHESIS ---
  // High-fidelity natural voice synthesizer with conversational pacing and warm tone
  const speakText = useCallback((textToSpeak: string, overrideGender?: 'female' | 'male' | 'auto') => {
    if (!voiceSpeakingEnabledRef.current || typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    // Natural text preprocessor: translates numbers, currencies and cleans symbols for human pacing
    let clean = textToSpeak
      .replace(/[*_#`~[\]()<>]/g, '')
      .replace(/\$(\d+)\.(\d{1,2})/g, '$1 dólares con $2')
      .replace(/\$(\d+(?:[.,]\d+)?)/g, '$1 dólares')
      .replace(/(\d+(?:[.,]\d+)?)\$/g, '$1 dólares')
      .replace(/€(\d+(?:[.,]\d+)?)/g, '$1 euros')
      .replace(/(\d+(?:[.,]\d+)?)\s*€/g, '$1 euros')
      .replace(/Bs\.?/gi, 'bolívares')
      .replace(/%/g, ' por ciento')
      .replace(/Tel:?/gi, 'teléfono')
      .replace(/\s*•\s*/g, ', ')
      .replace(/!{2,}/g, '!')
      .replace(/\?{2,}/g, '?')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return;

    try {
      window.speechSynthesis.cancel(); // Stop any ongoing speech immediately

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 0.98;     // Natural, unhurried conversational human pace
      utterance.pitch = 1.0;    // Natural human pitch
      utterance.volume = 1.0;

      const liveVoices = window.speechSynthesis.getVoices();
      const allVoices = liveVoices && liveVoices.length > 0 ? liveVoices : availableVoices;
      const spanishVoices = allVoices.filter(v => v.lang && v.lang.toLowerCase().startsWith('es'));
      const voicePool = spanishVoices.length > 0 ? spanishVoices : allVoices;

      const activeGender = overrideGender || selectedVoiceGender;

      // Score voices based on human neural/natural quality
      const scored = voicePool.map(v => {
        const name = (v.name || '').toLowerCase();
        const lang = (v.lang || '').toLowerCase();
        let score = 10;

        // 1. Cloud / Remote Neural & Natural voices from Google, Apple, Microsoft (Highest human fidelity)
        if (v.localService === false) score += 600;
        if (name.includes('natural') || name.includes('online') || name.includes('neural')) score += 500;
        if (name.includes('google')) score += 450;
        if (name.includes('siri') || name.includes('apple')) score += 400;
        if (name.includes('enhanced') || name.includes('premium')) score += 350;
        
        // 2. Recognized high-quality Latin American and Spanish human voice profiles
        if (
          name.includes('sabina') || 
          name.includes('jorge') || 
          name.includes('dalia') || 
          name.includes('paulina') || 
          name.includes('monica') || 
          name.includes('mónica') || 
          name.includes('paloma') || 
          name.includes('salome') || 
          name.includes('alvaro') ||
          name.includes('carlos') ||
          name.includes('lucia') ||
          name.includes('sofia') ||
          name.includes('juan') ||
          name.includes('diego') ||
          name.includes('elena') ||
          name.includes('camila') ||
          name.includes('luis')
        ) {
          score += 260;
        }

        // 3. Gender preference if requested
        if (activeGender === 'female') {
          if (
            name.includes('female') || 
            name.includes('mujer') || 
            name.includes('sabina') || 
            name.includes('dalia') || 
            name.includes('paulina') || 
            name.includes('monica') || 
            name.includes('mónica') || 
            name.includes('paloma') || 
            name.includes('salome') || 
            name.includes('lucia') || 
            name.includes('sofia') || 
            name.includes('helena') || 
            name.includes('elena') || 
            name.includes('camila') || 
            name.includes('sfg')
          ) {
            score += 180;
          }
        } else if (activeGender === 'male') {
          if (
            name.includes('male') || 
            name.includes('hombre') || 
            name.includes('jorge') || 
            name.includes('alonso') || 
            name.includes('carlos') || 
            name.includes('pablo') || 
            name.includes('raul') || 
            name.includes('alvaro') || 
            name.includes('juan') || 
            name.includes('diego') || 
            name.includes('luis') || 
            name.includes('sfd')
          ) {
            score += 180;
          }
        }

        // 4. Favor Latin American locale codes slightly over generic
        if (lang.includes('us') || lang.includes('mx') || lang.includes('419') || lang.includes('co') || lang.includes('ve')) {
          score += 60;
        }

        // 5. Heavily filter out and penalize robotic or mechanical engines
        if (
          name.includes('espeak') || 
          name.includes('klatt') || 
          name.includes('robot') || 
          name.includes('desktop') || 
          name.includes('sampler') ||
          name.includes('synth') ||
          name.includes('compact')
        ) {
          score -= 2000;
        }

        return { voice: v, score };
      });

      scored.sort((a, b) => b.score - a.score);

      if (scored.length > 0 && scored[0].score > -100) {
        utterance.voice = scored[0].voice;
        utterance.lang = scored[0].voice.lang || 'es-US';
      } else {
        utterance.lang = 'es-US';
      }

      utterance.onstart = () => {
        if (isMountedRef.current) setIsSpeaking(true);
      };

      utterance.onend = () => {
        if (isMountedRef.current) {
          setIsSpeaking(false);
          // In live hands-free mode, seamlessly listen for user's next turn
          if (listeningModeRef.current === 'live' && isOpenRef.current) {
            setTimeout(() => {
              if (isOpenRef.current && isMountedRef.current && listeningModeRef.current === 'live') {
                startListening('live');
              }
            }, 350);
          }
        }
      };

      utterance.onerror = () => {
        if (isMountedRef.current) setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('TTS error:', err);
      if (isMountedRef.current) setIsSpeaking(false);
    }
  }, [selectedVoiceGender, availableVoices]);

  // Preview human voice when selecting from menu
  const previewVoice = useCallback((gender: 'female' | 'male' | 'auto') => {
    setSelectedVoiceGender(gender);
    setShowVoicePicker(false);
    if (!voiceSpeakingEnabledRef.current) {
      setVoiceSpeakingEnabled(true);
    }
    const sample = gender === 'female'
      ? 'Hola, he activado la voz femenina natural para asistirte en Finova.'
      : gender === 'male'
      ? 'Hola, he activado la voz masculina natural para asistirte en Finova.'
      : 'Hola, esta es la voz recomendada de Finova para tu negocio.';
    setTimeout(() => {
      speakText(sample, gender);
    }, 60);
  }, [speakText]);

  // --- TOGGLE TOP-RIGHT MICROPHONE / VOICE MODE ---
  const handleToggleVoiceMode = () => {
    const nextState = !voiceSpeakingEnabled;
    setVoiceSpeakingEnabled(nextState);
    if (!nextState) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    }
  };

  // --- STOP LISTENING ---
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setSpeechInterim('');
  }, []);

  // --- DISPATCH TRANSACTION ACTION ---
  const executeAssistantAction = useCallback((action: { type: string; data: any }): ActionCardDetail | null => {
    if (!action || !action.type || !action.data) return null;

    if (action.type === 'record_sale') {
      const data = action.data;
      const amountVal = Number(data.amount) || 0;
      const cur = data.currency || currency || 'USD';
      const bcvRate = cur === 'EUR' ? (rates.bcvEur || 968.07) : (rates.bcvUsd || 832.49);
      const amountBs = cur === 'VES' ? amountVal : amountVal * bcvRate;

      // Auto-create client if specified and not yet in agenda
      let clientCreated = false;
      if (data.clientName && data.clientName.trim() && onAddNewClient) {
        const clientNameClean = data.clientName.trim();
        const exists = clients.some(c => c.name && c.name.toLowerCase() === clientNameClean.toLowerCase());
        if (!exists) {
          onAddNewClient({
            name: clientNameClean,
            notes: 'Añadido automáticamente al registrar venta en Finova AI',
          });
          clientCreated = true;
        }
      }

      const displayDesc = data.clientName 
        ? `${data.description || 'Venta'} (Cliente: ${data.clientName})`
        : (data.description || 'Venta por Finova AI');

      onAddNewRecord({
        type: 'ingreso',
        amount: amountVal,
        amountBs,
        exchangeRateUsed: bcvRate,
        description: displayDesc,
        category: data.category || 'Venta de productos',
        date: getLocalDateString(new Date()),
        paymentMethod: data.paymentMethod || 'Efectivo',
        currency: cur === 'EUR' ? 'EUR' : 'USD',
      });

      return {
        type: 'record_sale',
        title: 'Venta Registrada con Éxito',
        amount: amountVal,
        currency: cur,
        concept: displayDesc,
        details: `Método: ${data.paymentMethod || 'Efectivo'}${clientCreated ? ' • Cliente añadido a la libreta' : ''}`,
        extraBadge: clientCreated ? 'Venta + Cliente' : 'Ingreso Añadido',
      };
    }

    if (action.type === 'record_expense') {
      const data = action.data;
      const amountVal = Number(data.amount) || 0;
      const cur = data.currency || currency || 'USD';
      const bcvRate = cur === 'EUR' ? (rates.bcvEur || 968.07) : (rates.bcvUsd || 832.49);
      const amountBs = cur === 'VES' ? amountVal : amountVal * bcvRate;

      onAddNewRecord({
        type: 'egreso',
        amount: amountVal,
        amountBs,
        exchangeRateUsed: bcvRate,
        description: data.description || 'Gasto por Finova AI',
        category: data.category || 'Operativo',
        date: getLocalDateString(new Date()),
        paymentMethod: data.paymentMethod || 'Efectivo',
        currency: cur === 'EUR' ? 'EUR' : 'USD',
      });

      return {
        type: 'record_expense',
        title: 'Gasto Anotado con Éxito',
        amount: amountVal,
        currency: cur,
        concept: data.description,
        details: `Categoría: ${data.category || 'Operativo'}`,
        extraBadge: 'Egreso Restado',
      };
    }

    if (action.type === 'record_debt') {
      const data = action.data;
      const amountVal = Number(data.amount) || 0;
      const cur = data.currency || 'USD';
      const bcvRate = cur === 'EUR' ? (rates.bcvEur || 968.07) : (rates.bcvUsd || 832.49);
      const debtor = data.debtorName || 'Cliente';

      // Auto-create client if debtor is specified and not yet in clients
      let clientCreated = false;
      if (debtor && debtor !== 'Cliente' && onAddNewClient) {
        const exists = clients.some(c => c.name && c.name.toLowerCase() === debtor.toLowerCase());
        if (!exists) {
          onAddNewClient({
            name: debtor,
            notes: 'Añadido automáticamente al registrar deuda en Finova AI',
          });
          clientCreated = true;
        }
      }

      if (onAddNewDebt) {
        onAddNewDebt({
          type: data.type === 'por_pagar' ? 'por_pagar' : 'por_cobrar',
          debtorName: debtor,
          amount: amountVal,
          remainingAmount: amountVal,
          paidAmount: 0,
          currency: cur === 'EUR' ? 'EUR' : 'USD',
          amountBs: amountVal * bcvRate,
          exchangeRateUsed: bcvRate,
          dueDate: getLocalDateString(new Date(Date.now() + 7 * 86400000)),
          status: 'pendiente',
          description: data.concept || 'Registrado por Finova AI',
        });
      }

      return {
        type: 'record_debt',
        title: data.type === 'por_pagar' ? 'Deuda por Pagar Registrada' : 'Cuenta por Cobrar Registrada',
        amount: amountVal,
        currency: cur,
        concept: debtor,
        details: `${data.concept || 'Pendiente en cartera'}${clientCreated ? ' • Cliente añadido a la agenda' : ''}`,
        extraBadge: clientCreated ? 'Deuda + Cliente' : (data.type === 'por_pagar' ? 'Por Pagar' : 'Por Cobrar'),
      };
    }

    if (action.type === 'record_client') {
      const data = action.data;
      if (onAddNewClient) {
        onAddNewClient({
          name: data.name || 'Cliente',
          phone: data.phone || '',
          location: data.location || '',
          notes: data.notes || 'Registrado por Finova AI',
        });
      }

      return {
        type: 'record_client',
        title: 'Cliente Registrado en la Agenda',
        concept: data.name,
        details: data.phone ? `Tel: ${data.phone}` : 'Guardado en libreta de clientes',
        extraBadge: 'Nuevo Cliente',
      };
    }

    if (action.type === 'delete_transaction') {
      const data = action.data;
      const targetName = (data.targetName || '').toLowerCase().trim();
      const targetAmount = Number(data.amount) || 0;
      let deletedItemName = data.targetName || 'Registro';
      let foundAndDeleted = false;

      // 1. Try finding in debts first (if itemType allows or matches name/amount)
      if (data.itemType !== 'venta' && data.itemType !== 'gasto' && debts && debts.length > 0 && onDeleteDebt) {
        const matchedDebt = debts.find(d => {
          const nameMatch = targetName && d.debtorName && d.debtorName.toLowerCase().includes(targetName);
          const descMatch = targetName && d.description && d.description.toLowerCase().includes(targetName);
          const amtMatch = targetAmount > 0 && Math.abs(d.amount - targetAmount) < 0.05;
          return nameMatch || (amtMatch && (targetName === 'registro' || !targetName)) || (nameMatch && amtMatch) || descMatch;
        });

        if (matchedDebt) {
          onDeleteDebt(matchedDebt.id);
          deletedItemName = `Deuda de ${matchedDebt.debtorName} ($${matchedDebt.amount})`;
          foundAndDeleted = true;
        }
      }

      // 2. Try finding in records if not found in debts and onDeleteRecord is available
      if (!foundAndDeleted && records && records.length > 0 && onDeleteRecord) {
        const matchedRecord = records.find(r => {
          const descMatch = targetName && r.description && r.description.toLowerCase().includes(targetName);
          const catMatch = targetName && r.category && r.category.toLowerCase().includes(targetName);
          const amtMatch = targetAmount > 0 && Math.abs(r.amount - targetAmount) < 0.05;
          return descMatch || catMatch || (amtMatch && (targetName === 'registro' || !targetName));
        });

        if (matchedRecord) {
          onDeleteRecord(matchedRecord.id);
          deletedItemName = `${matchedRecord.type === 'ingreso' ? 'Venta' : 'Gasto'}: ${matchedRecord.description} ($${matchedRecord.amount})`;
          foundAndDeleted = true;
        }
      }

      return {
        type: 'delete_transaction',
        title: foundAndDeleted ? 'Registro Eliminado' : 'Eliminación Procesada',
        concept: deletedItemName,
        amount: targetAmount > 0 ? targetAmount : undefined,
        currency: 'USD',
        details: foundAndDeleted ? 'Se eliminó correctamente del balance y base de datos.' : `Orden de borrado procesada para "${data.targetName}".`,
        extraBadge: 'Eliminado',
      };
    }

    if (action.type === 'settle_client') {
      const data = action.data;
      const clientName = data.clientName || 'Cliente';
      if (onSettleClientDebts) {
        onSettleClientDebts(clientName);
      }

      return {
        type: 'settle_client',
        title: 'Solvencia Otorgada al Cliente',
        concept: clientName,
        details: 'Todas las deudas pendientes han sido saldadas a $0.00.',
        extraBadge: 'Solvente',
      };
    }

    if (action.type === 'delete_client') {
      const data = action.data;
      const target = (data.clientName || data.name || '').trim();
      let success = false;
      if (onDeleteClient && target) {
        success = Boolean(onDeleteClient(target));
      }
      return {
        type: 'delete_client',
        title: success ? 'Cliente Eliminado' : 'Cliente Borrado',
        concept: target || 'Cliente',
        details: success ? 'Se removió correctamente del directorio de clientes.' : `Se procesó la orden para eliminar a "${target}".`,
        extraBadge: 'Cliente Eliminado',
      };
    }

    if (action.type === 'add_inventory_product') {
      const data = action.data;
      const prodName = data.name || 'Producto';
      const priceVal = Number(data.price) || 0;
      const costVal = Number(data.cost) || (priceVal * 0.7);
      const stockVal = Number(data.stock) || 1;
      const cur = data.currency || currency || 'USD';
      if (onAddInventoryProduct) {
        onAddInventoryProduct({
          name: prodName,
          price: priceVal,
          cost: costVal,
          stock: stockVal,
          category: data.category || 'General',
          currency: cur === 'EUR' ? 'EUR' : 'USD',
          priceCurrency: cur === 'VES' ? 'VES' : (cur === 'EUR' ? 'EUR' : 'USD'),
          costCurrency: cur === 'VES' ? 'VES' : (cur === 'EUR' ? 'EUR' : 'USD'),
          status: stockVal > 0 ? 'disponible' : 'no_disponible',
        });
      }
      return {
        type: 'add_inventory_product',
        title: 'Producto Añadido al Inventario',
        concept: prodName,
        amount: priceVal,
        currency: cur,
        details: `Stock: ${stockVal} unidades • Precio: $${priceVal.toFixed(2)}`,
        extraBadge: 'Inventario +',
      };
    }

    if (action.type === 'delete_inventory_product') {
      const data = action.data;
      const targetName = (data.productName || data.name || '').toLowerCase().trim();
      let found = false;
      let matchedName = data.productName || data.name || 'Producto';
      if (inventory && inventory.length > 0 && onDeleteInventoryProduct) {
        const matched = inventory.find(i => 
          i.name.toLowerCase() === targetName || 
          i.name.toLowerCase().includes(targetName) ||
          targetName.includes(i.name.toLowerCase())
        );
        if (matched) {
          onDeleteInventoryProduct(matched.id);
          matchedName = matched.name;
          found = true;
        }
      }
      return {
        type: 'delete_inventory_product',
        title: found ? 'Producto Eliminado del Inventario' : 'Eliminación de Inventario',
        concept: matchedName,
        details: found ? 'Se removió del inventario y catálogo comercial.' : `Orden de eliminación procesada para "${matchedName}".`,
        extraBadge: 'Inventario -',
      };
    }

    if (action.type === 'update_inventory_stock') {
      const data = action.data;
      const targetName = (data.productName || data.name || '').toLowerCase().trim();
      const change = Number(data.change) || 0;
      const newStockVal = data.newStock !== undefined ? Number(data.newStock) : undefined;
      let found = false;
      let finalStock = 0;
      let matchedName = data.productName || data.name || 'Producto';

      if (inventory && inventory.length > 0 && onUpdateInventoryStock) {
        const matched = inventory.find(i => 
          i.name.toLowerCase() === targetName || 
          i.name.toLowerCase().includes(targetName) ||
          targetName.includes(i.name.toLowerCase())
        );
        if (matched) {
          finalStock = newStockVal !== undefined ? Math.max(0, newStockVal) : Math.max(0, matched.stock + change);
          onUpdateInventoryStock(matched.id, finalStock);
          matchedName = matched.name;
          found = true;
        }
      }
      return {
        type: 'update_inventory_stock',
        title: found ? 'Stock Actualizado' : 'Ajuste de Stock',
        concept: matchedName,
        details: found ? `Existencia actual: ${finalStock} unidades` : `Ajuste registrado para "${matchedName}".`,
        extraBadge: found ? `${finalStock} unids` : 'Stock',
      };
    }

    if (action.type === 'calculate_math') {
      const data = action.data;
      return {
        type: 'calculate_math',
        title: 'Cálculo Realizado',
        concept: data.operation || 'Operación',
        amount: Number(data.result) || 0,
        currency: data.currency || currency || 'USD',
        details: data.explanation || `Resultado: ${data.result}`,
        extraBadge: 'Cálculo Exacto',
      };
    }

    return null;
  }, [
    currency, 
    rates, 
    onAddNewRecord, 
    onAddNewDebt, 
    onAddNewClient, 
    onDeleteClient,
    onDeleteDebt, 
    onDeleteRecord, 
    onSettleClientDebts, 
    onAddInventoryProduct,
    onDeleteInventoryProduct,
    onUpdateInventoryStock,
    debts, 
    records, 
    clients,
    inventory
  ]);

  // --- SEND MESSAGE TO FINOVA GEMINI BACKEND ---
  const handleSendMessage = useCallback(async (msgText: string) => {
    const trimmed = msgText.trim();
    if (!trimmed || isProcessing) return;

    // Append user message to thread
    const userMsg: MessageHistory = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setTextInput('');
    setSpeechInterim('');
    setIsProcessing(true);

    try {
      const debtorsList = debts
        .filter(d => d.type === 'por_cobrar' && d.status === 'pendiente')
        .map(d => `${d.debtorName} ($${(d.remainingAmount ?? d.amount).toFixed(2)}${d.clientPhone ? ' - ' + d.clientPhone : ''})`)
        .join(', ');

      const payablesList = debts
        .filter(d => d.type === 'por_pagar' && d.status === 'pendiente')
        .map(d => `${d.debtorName} ($${(d.remainingAmount ?? d.amount).toFixed(2)})`)
        .join(', ');

      const clientsSample = clients.slice(0, 5).map(c => `${c.name} (${c.phone || 'Sin tel.'})`).join(', ');

      const contextPayload = {
        companyName: companyName || 'Mi Negocio',
        userName: userName || 'Usuario',
        currency,
        todaySales,
        todayExpenses,
        todayBalance,
        totalInventoryValue,
        pendingReceivables: debts
          .filter(d => d.type === 'por_cobrar' && d.status === 'pendiente')
          .reduce((sum, d) => sum + (d.remainingAmount ?? d.amount), 0),
        debtorsList: debtorsList || 'No hay clientes con deudas pendientes',
        pendingPayables: debts
          .filter(d => d.type === 'por_pagar' && d.status === 'pendiente')
          .reduce((sum, d) => sum + (d.remainingAmount ?? d.amount), 0),
        payablesList: payablesList || 'No hay deudas por pagar pendientes',
        totalClients: clients.length,
        clientsSample: clientsSample || 'Sin clientes registrados',
        rates: {
          bcvUsd: rates.bcvUsd || 832.49,
          bcvEur: rates.bcvEur || 968.07,
        },
        inventorySample: inventory.slice(0, 8).map(i => ({
          name: i.name,
          stock: i.stock,
          price: i.price,
          currency: i.currency,
        })),
      };

      const historyPayload = messages.slice(-6).map(m => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          context: contextPayload,
          history: historyPayload,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error en servidor: ${res.statusText}`);
      }

      const data = await res.json();
      const reply = data.reply || 'Entendido.';
      let actionCard: ActionCardDetail | null = null;

      if (data.action) {
        actionCard = executeAssistantAction(data.action);
      }

      const assistantMsg: MessageHistory = {
        id: `finova-${Date.now()}`,
        role: 'assistant',
        text: reply,
        actionCard,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Speak reply out loud with natural human voice (if top-right mic toggle is enabled)
      speakText(reply);
    } catch (err: any) {
      console.error('Error enviando mensaje a Finova:', err);
      const fallbackText = 'Hubo un inconveniente conectando con el servicio. Por favor intenta de nuevo.';
      setMessages(prev => [
        ...prev,
        {
          id: `finova-err-${Date.now()}`,
          role: 'assistant',
          text: fallbackText,
          timestamp: new Date(),
        },
      ]);
      speakText(fallbackText);
    } finally {
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    messages,
    debts,
    clients,
    companyName,
    userName,
    currency,
    todaySales,
    todayExpenses,
    todayBalance,
    totalInventoryValue,
    rates,
    inventory,
    executeAssistantAction,
    speakText,
  ]);

  // --- START SPEECH RECOGNITION (DICTATION OR LIVE MODE) ---
  // --- START SPEECH RECOGNITION (DIRECT ACCESS - ZERO FRICTION) ---
  const startListening = useCallback((mode: 'dictation' | 'live') => {
    if (typeof window === 'undefined') return;

    setMicError(null);
    pendingListeningModeRef.current = mode;

    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRec) {
      setMicError('Tu navegador no soporta reconocimiento de voz nativo. Puedes usar el teclado para chatear.');
      return;
    }

    stopListening();

    try {
      const recognition = new SpeechRec();
      // Select best Latin American / device locale
      const userLang = (navigator.language || 'es-419').toLowerCase();
      recognition.lang = userLang.startsWith('es') ? navigator.language : 'es-419';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      setListeningMode(mode);
      textBeforeDictationRef.current = textInputRef.current;

      let accumulatedFinal = '';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechInterim('');
        setMicError(null);
      };

      recognition.onresult = (event: any) => {
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            accumulatedFinal += (accumulatedFinal ? ' ' : '') + trans.trim();
          } else {
            interimText += trans;
          }
        }

        const currentCombined = (accumulatedFinal + ' ' + interimText).trim();
        setSpeechInterim(currentCombined);

        if (mode === 'dictation') {
          // LIVE DICTATION: Real-time typing directly into the text input bar!
          const prefix = textBeforeDictationRef.current ? textBeforeDictationRef.current + ' ' : '';
          setTextInput(prefix + currentCombined);
        } else {
          // LIVE MODE: Auto-send on natural pause of speech
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (currentCombined.trim().length > 1) {
              recognition.stop();
            }
          }, 1800);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('SpeechRecognition error:', e.error);
        if (e.error === 'not-allowed') {
          setMicError('El micrófono está bloqueado en el navegador.');
        } else if (e.error === 'network') {
          setMicError('Error de red al procesar el audio.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        const finalRecordedText = (accumulatedFinal || speechInterim).trim();
        setSpeechInterim('');

        if (mode === 'live') {
          if (finalRecordedText) {
            handleSendMessage(finalRecordedText);
          }
        } else {
          // In dictation mode, keep listening mode inactive but preserve the text in input
          setListeningMode(null);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Error starting speech recognition:', err);
      setIsListening(false);
      setListeningMode(null);
    }
  }, [stopListening, handleSendMessage, speechInterim]);

  // --- ACTIONS: DICTATION & CONTROLS ---

  // Tap Microphone Button (Dictation Mode)
  const handleToggleDictation = () => {
    if (isListening) {
      // User tapped "Cortar" / apagar micrófono
      // Stops mic and leaves whatever was transcribed inside the textInput
      stopListening();
      setListeningMode(null);
    } else {
      startListening('dictation');
    }
  };

  // Immediate send while speaking or after speaking
  const handleImmediateSendFromMic = () => {
    const textToSend = textInput.trim() || speechInterim.trim();
    stopListening();
    setListeningMode(null);
    if (textToSend) {
      handleSendMessage(textToSend);
    }
  };

  // Tap Gemini Live Waveform Button (`❙ıı`)
  const handleToggleLiveMode = () => {
    if (isListening && listeningMode === 'live') {
      stopListening();
      setListeningMode(null);
    } else {
      startListening('live');
    }
  };

  // Reset conversation (Pencil icon `✎`)
  const handleResetConversation = () => {
    setMessages([]);
    setTextInput('');
    setSpeechInterim('');
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  if (!isOpen) return null;

  const userInitials = (userName || 'LA')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.18 }}
        /* PURE SOLID WHITE BACKGROUND - Completely opaque so app background never bleeds through */
        className="fixed inset-0 z-50 flex flex-col bg-white select-none overflow-hidden"
      >
        {/* --- TOP BAR: Close (X) • IA Finova • Voice Toggle • User Profile --- */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white shrink-0">
          {/* Left: Close X button (replaces hamburger menu) */}
          <button
            onClick={onClose}
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
            title="Cerrar IA Finova"
          >
            <X className="w-6 h-6 stroke-[2.2]" />
          </button>

          {/* Center: "IA Finova" */}
          <div className="flex items-center gap-1.5">
            <h2 className="text-slate-900 font-bold text-lg tracking-tight">
              IA Finova
            </h2>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="En línea" />
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5">
            {/* Voice Tone / Gender Selector */}
            <div className="relative">
              <button
                onClick={() => setShowVoicePicker(!showVoicePicker)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                title="Cambiar tono o voz humana"
              >
                <Volume2 className="w-4 h-4" />
              </button>

              {/* Voice Picker Dropdown */}
              <AnimatePresence>
                {showVoicePicker && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute right-0 top-11 bg-white border border-slate-100 shadow-xl rounded-2xl p-2.5 w-60 z-30"
                  >
                    <div className="text-[11px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider flex items-center justify-between">
                      <span>Voz Humana de la IA</span>
                      <span className="text-[10px] text-sky-600 font-medium">Toca para probar</span>
                    </div>
                    <button
                      onClick={() => previewVoice('auto')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                        selectedVoiceGender === 'auto' ? 'bg-sky-50 text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                        <span>Voz Recomendada Finova</span>
                      </div>
                      {selectedVoiceGender === 'auto' && <Check className="w-3.5 h-3.5 text-sky-600" />}
                    </button>
                    <button
                      onClick={() => previewVoice('female')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                        selectedVoiceGender === 'female' ? 'bg-sky-50 text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-3.5 h-3.5 text-pink-500" />
                        <span>Voz Femenina Natural</span>
                      </div>
                      {selectedVoiceGender === 'female' && <Check className="w-3.5 h-3.5 text-sky-600" />}
                    </button>
                    <button
                      onClick={() => previewVoice('male')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                        selectedVoiceGender === 'male' ? 'bg-sky-50 text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Voz Masculina Natural</span>
                      </div>
                      {selectedVoiceGender === 'male' && <Check className="w-3.5 h-3.5 text-sky-600" />}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* New Conversation Button (✎) */}
            <button
              onClick={handleResetConversation}
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
              title="Nueva conversación"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Microphone Toggle (Top-Right): Voice Out Loud vs Silent Text Chat */}
            <button
              onClick={handleToggleVoiceMode}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                voiceSpeakingEnabled 
                  ? 'bg-sky-50 text-sky-600 ring-1 ring-sky-200 hover:bg-sky-100' 
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
              title={
                voiceSpeakingEnabled 
                  ? 'Voz de la IA activa: Te responderá hablando con voz humana' 
                  : 'Modo silencioso: Solo respuestas escritas por chat'
              }
            >
              {voiceSpeakingEnabled ? (
                <div className="relative">
                  <Mic className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                </div>
              ) : (
                <MicOff className="w-4 h-4" />
              )}
            </button>

            {/* User Profile Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-semibold flex items-center justify-center text-xs shadow-sm ring-1 ring-white">
              {userInitials || 'US'}
            </div>
          </div>
        </header>

        {/* --- MIC ERROR NOTIFICATION --- */}
        {micError && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{micError}</span>
            </div>
            <button
              onClick={() => setMicError(null)}
              className="w-5 h-5 flex items-center justify-center text-amber-700 hover:text-amber-950 font-bold ml-2 shrink-0"
              title="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        )}

        {/* --- MAIN CHAT CANVAS --- */}
        <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col justify-between bg-white">
          {messages.length === 0 ? (
            /* --- EMPTY STATE: Exact Google Gemini Center Sparkle + Heading --- */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 -mt-10">
              <motion.div
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center"
              >
                {/* 4-pointed Gemini sparkle diamond star */}
                <GeminiStar className="w-12 h-12 mb-5" />

                {/* Big bold headline: "Pregunta lo que quieras, [Nombre]" */}
                <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight leading-snug">
                  Pregunta lo que quieras, {userName || 'Luis Arturo'}
                </h1>

                {/* Subtitle explaining hands-free voice mode */}
                <p className="mt-3 text-sm text-slate-500 max-w-md">
                  Controla tu negocio con voz o texto: registra ventas, clientes, deudas, o consulta cuánto tienes en el medio.
                </p>
              </motion.div>
            </div>
          ) : (
            /* --- CONVERSATION STREAM: Wider, spacious chat bubbles --- */
            <div className="flex-1 space-y-4 max-w-3xl mx-auto w-full pb-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Assistant Avatar Star */}
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 shrink-0 mt-1">
                      <GeminiStar className="w-8 h-8" />
                    </div>
                  )}

                  {/* Message Bubble - Wider and more spacious */}
                  <div className={`max-w-[92%] sm:max-w-[88%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div
                      className={`inline-block px-5 py-3 rounded-2xl text-[15.5px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-slate-900 text-white rounded-br-sm shadow-sm'
                          : 'bg-slate-50 text-slate-900 rounded-bl-sm border border-slate-200/80 shadow-xs'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Action Confirmation Card (Receipt / Feedback) */}
                    {msg.actionCard && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`mt-2.5 p-3.5 rounded-xl border text-left shadow-xs ${
                          msg.actionCard.type === 'record_sale'
                            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                            : msg.actionCard.type === 'record_expense'
                            ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                            : msg.actionCard.type === 'record_debt'
                            ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                            : msg.actionCard.type === 'delete_transaction' || msg.actionCard.type === 'delete_client' || msg.actionCard.type === 'delete_inventory_product'
                            ? 'bg-red-50/90 border-red-200 text-red-950'
                            : msg.actionCard.type === 'settle_client'
                            ? 'bg-teal-50/90 border-teal-200 text-teal-950'
                            : msg.actionCard.type === 'add_inventory_product' || msg.actionCard.type === 'update_inventory_stock'
                            ? 'bg-purple-50/90 border-purple-200 text-purple-950'
                            : msg.actionCard.type === 'calculate_math'
                            ? 'bg-cyan-50/90 border-cyan-200 text-cyan-950'
                            : 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                            {msg.actionCard.type === 'delete_transaction' || msg.actionCard.type === 'delete_inventory_product' ? (
                              <Trash2 className="w-4 h-4 text-red-600" />
                            ) : msg.actionCard.type === 'delete_client' ? (
                              <UserMinus className="w-4 h-4 text-red-600" />
                            ) : msg.actionCard.type === 'settle_client' ? (
                              <ShieldCheck className="w-4 h-4 text-teal-600" />
                            ) : msg.actionCard.type === 'record_expense' ? (
                              <ArrowDownRight className="w-4 h-4 text-rose-600" />
                            ) : msg.actionCard.type === 'add_inventory_product' || msg.actionCard.type === 'update_inventory_stock' ? (
                              <Boxes className="w-4 h-4 text-purple-600" />
                            ) : msg.actionCard.type === 'calculate_math' ? (
                              <Calculator className="w-4 h-4 text-cyan-600" />
                            ) : msg.actionCard.type === 'record_client' ? (
                              <Users className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            )}
                            {msg.actionCard.title}
                          </span>
                          {msg.actionCard.extraBadge && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80">
                              {msg.actionCard.extraBadge}
                            </span>
                          )}
                        </div>

                        <div className="text-sm font-semibold">
                          {msg.actionCard.concept}
                          {msg.actionCard.amount !== undefined && (
                            <span className="ml-1 text-base font-bold">
                              • {msg.actionCard.currency === 'VES' ? 'Bs. ' : (msg.actionCard.currency === 'EUR' ? '€' : '$')}
                              {msg.actionCard.amount.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {msg.actionCard.details && (
                          <div className="text-xs text-slate-600 mt-0.5">
                            {msg.actionCard.details}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              ))}

              {/* Processing / Thinking Animation */}
              {isProcessing && (
                <div className="flex gap-3 justify-start items-center">
                  <div className="w-8 h-8 shrink-0">
                    <GeminiStar className="w-8 h-8 animate-spin" />
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-slate-600 text-sm flex items-center gap-2 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-bounce [animation-delay:0.3s]" />
                    <span className="ml-2 text-xs font-medium text-slate-500">IA Finova está pensando...</span>
                  </div>
                </div>
              )}

              {/* Real-time Listening Preview Banner (Live mode) */}
              {isListening && listeningMode === 'live' && speechInterim && (
                <div className="flex justify-end">
                  <div className="bg-sky-50 border border-sky-200 text-sky-800 italic px-4 py-2.5 rounded-2xl text-sm max-w-[85%] animate-pulse shadow-xs">
                    "{speechInterim}"
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* --- BOTTOM FLOATING CAPSULE --- */}
        <footer className="p-4 pb-6 bg-white shrink-0 border-t border-slate-100">
          <div className="max-w-2xl mx-auto relative">
            {/* Quick Actions Popup Menu (Triggered by + button) */}
            <AnimatePresence>
              {showQuickMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-16 left-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 w-56 z-30"
                >
                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      handleSendMessage('Registra una venta de ');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                  >
                    <ShoppingBag className="w-4 h-4 text-emerald-600" />
                    <span>Registrar venta</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      handleSendMessage('Registra un gasto de ');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                  >
                    <ArrowDownRight className="w-4 h-4 text-rose-600" />
                    <span>Registrar gasto</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      handleSendMessage('Anota que me deben ');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                  >
                    <DollarSign className="w-4 h-4 text-amber-600" />
                    <span>Anotar deuda</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      handleSendMessage('Registra un cliente ');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                  >
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span>Nuevo cliente</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating Pill Capsule */}
            <div className={`bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.09)] border px-3.5 py-2.5 flex items-center gap-2 transition-all ${
              isListening ? 'border-sky-400 ring-2 ring-sky-100' : 'border-slate-200'
            }`}>
              {/* + Action Button */}
              <button
                onClick={() => setShowQuickMenu(!showQuickMenu)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shrink-0"
                title="Acciones rápidas"
              >
                <Plus className="w-5 h-5 stroke-[2]" />
              </button>

              {/* Text Input Field: Real-time dictation writes directly here! */}
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <input
                  type="text"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleImmediateSendFromMic();
                    }
                  }}
                  placeholder={
                    isListening && listeningMode === 'dictation'
                      ? "Escuchando... Di lo que deseas escribir"
                      : isListening && listeningMode === 'live'
                      ? "Hablando en vivo con Finova..."
                      : "Pregúntale a Finova..."
                  }
                  className="w-full bg-transparent border-0 outline-none text-slate-900 placeholder-slate-400 text-[15px] px-1 font-normal"
                />

                {/* Live audio indicator if listening */}
                {isListening && (
                  <span className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[11px] font-bold animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                    <span>Grabando</span>
                  </span>
                )}
              </div>

              {/* Action Buttons: Cortar (Apagar mic y dejar texto) / Enviar de una vez / Micrófono / Live Waveform */}
              <div className="flex items-center gap-1 shrink-0">
                {isListening ? (
                  /* WHILE SPEAKING / LISTENING: Option to "CORTAR" (stop and keep text) OR "ENVIAR DE UNA VEZ" */
                  <div className="flex items-center gap-1.5">
                    {/* Botón CORTAR: Apaga el micrófono y deja lo que se escribió en la cajita de texto */}
                    <button
                      onClick={handleToggleDictation}
                      className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                      title="Cortar: Apaga el micrófono y deja el texto escrito"
                    >
                      <Square className="w-3.5 h-3.5 text-red-600 fill-red-600" />
                      <span>Cortar</span>
                    </button>

                    {/* Botón ENVIAR DE UNA VEZ: Envía inmediatamente lo dictado */}
                    <button
                      onClick={handleImmediateSendFromMic}
                      className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-black active:scale-95 transition-all shadow-sm"
                      title="Enviar de una vez a la IA"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* WHEN NOT RECORDING */
                  <>
                    {textInput.trim() ? (
                      /* Send Button when text is written */
                      <button
                        onClick={handleImmediateSendFromMic}
                        className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-black active:scale-95 transition-all shadow-sm"
                        title="Enviar mensaje"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        {/* 1. Botón Micrófono (Dictado directo al campo de texto) */}
                        <button
                          type="button"
                          onClick={handleToggleDictation}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                          title="Dictar por voz (escribe en el campo de texto)"
                        >
                          <Mic className="w-5 h-5" />
                        </button>

                        {/* 2. Botón con rayitas/onda (Modo Gemini Live / Manos Libres Instantáneo) */}
                        <button
                          type="button"
                          onClick={handleToggleLiveMode}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                            isListening && listeningMode === 'live'
                              ? 'bg-sky-500 text-white shadow-md ring-4 ring-sky-100'
                              : 'bg-sky-100 hover:bg-sky-200 text-sky-700 active:scale-95'
                          }`}
                          title="Modo Gemini Live (habla y envía de una vez con respuesta por voz)"
                        >
                          {/* Waveform bars `❙ıı` */}
                          <div className="flex items-center gap-0.5 h-4">
                            <span className="w-1 rounded-full bg-current h-3.5" />
                            <span className="w-1 rounded-full bg-current h-2" />
                            <span className="w-1 rounded-full bg-current h-3" />
                          </div>
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
