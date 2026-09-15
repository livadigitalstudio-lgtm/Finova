import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, ShoppingCart, Banknote, FileText, ArrowLeft, 
  Search, Plus, Minus, Trash2, Info, CreditCard, Landmark, 
  Coins, Smartphone, Zap, Check, X, ChevronRight, ChevronDown, 
  ChevronUp, Tag, User, Calendar, QrCode, SlidersHorizontal, 
  Pencil, Sparkles, AlertCircle
} from 'lucide-react';
import { InventoryItem, ExchangeRates, FinancialRecord, SoldItemDetail, DebtItem } from '../types';
import { formatMoney, CurrencyCode, convertAmount } from '../utils/currency';
import { getLocalDateString } from '../utils/dateUtils';
import { storageService } from '../services/storageService';
import { 
  getUserCategories, 
  saveUserCategories as persistUserCategories, 
  addUserCategory, 
  deleteUserCategory, 
  isForbiddenCategory 
} from '../utils/categoryUtils';

interface Client {
  id: string;
  name: string;
  phone: string;
  location?: string;
  notes?: string;
  balanceUsd?: number;
}

interface SaleFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteSale: (
    record: Omit<FinancialRecord, 'id'>,
    soldItems?: SoldItemDetail[]
  ) => void;
  onAddDebt?: (debt: Omit<DebtItem, 'id' | 'dateCreated'>) => void;
  rates: ExchangeRates;
  initialCurrency?: 'USD' | 'EUR';
  inventory: InventoryItem[];
  onAddProduct: (item: Omit<InventoryItem, 'id'>) => void;
  onOpenQuotes?: () => void;
  currentUserEmail?: string;
  preSelectedProductId?: string | null;
}

type SaleStep = 'choice' | 'select_products' | 'confirm_quantities' | 'payment_details';

export function SaleFlowModal({
  isOpen,
  onClose,
  onCompleteSale,
  onAddDebt,
  rates,
  initialCurrency = 'USD',
  inventory = [],
  onAddProduct,
  onOpenQuotes,
  currentUserEmail = '',
  preSelectedProductId = null
}: SaleFlowModalProps) {
  // Step state
  const [step, setStep] = useState<SaleStep>('choice');
  const [isFreeSale, setIsFreeSale] = useState(false);

  // Currency & Rate states
  const [currency, setCurrency] = useState<'USD' | 'EUR'>(initialCurrency);
  const [rateType, setRateType] = useState<'bcv' | 'paralelo' | 'custom'>('bcv');
  const [customRateInput, setCustomRateInput] = useState('');

  const officialRateUSD = rates?.bcvUsd && rates.bcvUsd > 0 ? rates.bcvUsd : 832.49;
  const officialRateEUR = rates?.bcvEur && rates.bcvEur > 0 ? rates.bcvEur : 968.07;
  const paraleloRateUSD = rates?.paraleloUsd && rates.paraleloUsd > 0 ? rates.paraleloUsd : parseFloat((officialRateUSD * 1.15).toFixed(2));

  const activeRate = useMemo(() => {
    if (rateType === 'custom') {
      const parsed = parseFloat(customRateInput.replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (currency === 'EUR') {
      return officialRateEUR;
    }
    if (rateType === 'paralelo') {
      return paraleloRateUSD;
    }
    return officialRateUSD;
  }, [currency, rateType, customRateInput, officialRateEUR, officialRateUSD, paraleloRateUSD]);

  const currentRate = activeRate;

  // Step 1: Product selection & custom prices
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [customUnitPrices, setCustomUnitPrices] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all'); // 'all', 'low_stock', or custom category
  const [sortOrder, setSortOrder] = useState<'name' | 'price_asc' | 'price_desc' | 'stock'>('name');

  // Multi-currency switch handler that preserves financial equilibrium
  const handleSwitchCurrency = (target: 'USD' | 'EUR') => {
    if (target === currency) return;

    const factor = target === 'EUR' 
      ? (officialRateUSD / officialRateEUR) 
      : (officialRateEUR / officialRateUSD);

    setCustomUnitPrices(prev => {
      const updated: Record<string, number> = {};
      for (const [prodId, p] of Object.entries(prev)) {
        updated[prodId] = Number(((Number(p) || 0) * factor).toFixed(2));
      }
      return updated;
    });

    if (freeSaleAmount) {
      const currentAmt = parseFloat(freeSaleAmount);
      if (!isNaN(currentAmt) && currentAmt > 0) {
        setFreeSaleAmount((currentAmt * factor).toFixed(2));
      }
    }

    setCurrency(target);
    if (target === 'EUR' && rateType === 'paralelo') {
      setRateType('bcv');
    }
  };

  // Step 3 / Free sale fields
  const [saleType, setSaleType] = useState<'pagado' | 'deuda'>('pagado');
  const [isMultiCurrencyActive, setIsMultiCurrencyActive] = useState(true);
  const [saleDate, setSaleDate] = useState(getLocalDateString());
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [numberOfPayments, setNumberOfPayments] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  
  // Free sale specific fields
  const [freeSaleAmount, setFreeSaleAmount] = useState('');
  const [freeSaleConcept, setFreeSaleConcept] = useState('');
  const [freeSaleCategory, setFreeSaleCategory] = useState('');

  // Discount
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');

  // Client
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');
  const [clientsList, setClientsList] = useState<Client[]>([]);

  // Accordions
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(false);
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(true);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Sub-modals inside the sale flow
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [isQuickClientModalOpen, setIsQuickClientModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  // New product form state
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdCost, setNewProdCost] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('1');
  const [newProdCurrency, setNewProdCurrency] = useState<'USD' | 'EUR'>('USD');

  // New client form state
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // User-defined categories (persisted in local storage, starts strictly EMPTY)
  const [userCategories, setUserCategories] = useState<string[]>(() => {
    return getUserCategories(currentUserEmail);
  });

  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Re-read user categories when user changes or category update event fires
  useEffect(() => {
    setUserCategories(getUserCategories(currentUserEmail));
    const handleSync = (e: Event) => {
      const customEv = e as CustomEvent<{ categories?: string[] }>;
      if (customEv.detail?.categories) {
        setUserCategories(customEv.detail.categories);
      } else {
        setUserCategories(getUserCategories(currentUserEmail));
      }
    };
    window.addEventListener('gt_categories_updated', handleSync);
    return () => window.removeEventListener('gt_categories_updated', handleSync);
  }, [currentUserEmail]);

  // Sync user categories
  const saveUserCategories = (cats: string[]) => {
    const saved = persistUserCategories(cats, currentUserEmail);
    setUserCategories(saved);
  };

  // Load clients
  const clientsStorageKey = `gt_clients_${currentUserEmail || 'guest'}`;
  useEffect(() => {
    try {
      const cached = localStorage.getItem(clientsStorageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) setClientsList(parsed);
      }
    } catch (e) {
      console.warn('Error loading clients', e);
    }
  }, [clientsStorageKey, isOpen]);

  // Handle modal initialization
  const initializedRef = useRef(false);
  useEffect(() => {
    if (isOpen && !initializedRef.current) {
      initializedRef.current = true;
      setCurrency(initialCurrency);
      setSaleDate(getLocalDateString());
      setIsEditingDate(false);
      setSaleType('pagado');
      setNumberOfPayments(1);
      setPaymentMethod('Efectivo');
      setDiscountPercent('');
      setDiscountAmount('');
      setSelectedClientId('');
      setSelectedClientName('');
      setReferenceNumber('');
      setNotes('');
      setFreeSaleAmount('');
      setFreeSaleConcept('');
      setFreeSaleCategory('');
      setSearchQuery('');
      setSelectedCategoryFilter('all');

      if (preSelectedProductId) {
        const target = inventory.find(p => p.id === preSelectedProductId);
        if (target) {
          const targetCurrency = target.currency || 'USD';
          setCurrency(targetCurrency);
          setSelectedQuantities({ [target.id]: 1 });
          setCustomUnitPrices({ [target.id]: target.price });
          setIsFreeSale(false);
          setStep('confirm_quantities');
          return;
        }
      }

      setSelectedQuantities({});
      setCustomUnitPrices({});
      setIsFreeSale(false);
      setStep('choice');
    } else if (!isOpen) {
      initializedRef.current = false;
    }
  }, [isOpen, initialCurrency, preSelectedProductId, inventory]);

  // Derived selected items list
  const selectedItemsList = useMemo(() => {
    const list: { item: InventoryItem; quantity: number; unitPrice: number }[] = [];
    for (const [prodId, rawQty] of Object.entries(selectedQuantities)) {
      const qty = Number(rawQty) || 0;
      if (qty > 0) {
        const prod = inventory.find(p => p.id === prodId);
        if (prod) {
          const prodPriceCur = prod.priceCurrency || prod.currency || 'USD';
          let defaultUnitPrice = prod.price;
          // If the product price currency doesn't match the active sale currency, normalize with equilibrium
          if (prodPriceCur !== currency) {
            defaultUnitPrice = parseFloat(convertAmount(prod.price, prodPriceCur, currency, rates).toFixed(2));
          }
          const unitPrice = typeof customUnitPrices[prodId] === 'number' 
            ? customUnitPrices[prodId] 
            : defaultUnitPrice;
          list.push({ item: prod, quantity: qty, unitPrice });
        }
      }
    }
    return list;
  }, [selectedQuantities, customUnitPrices, inventory, currency, rates]);

  // Total units selected
  const totalUnits = useMemo(() => {
    if (isFreeSale) return 1;
    return selectedItemsList.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [isFreeSale, selectedItemsList]);

  // Subtotal before discount
  const subtotal = useMemo(() => {
    if (isFreeSale) {
      return parseFloat(freeSaleAmount) || 0;
    }
    return selectedItemsList.reduce((acc, curr) => acc + (curr.unitPrice * curr.quantity), 0);
  }, [isFreeSale, freeSaleAmount, selectedItemsList]);

  // Discount calculation
  const numericDiscount = useMemo(() => {
    const directAmt = parseFloat(discountAmount) || 0;
    if (directAmt > 0) return Math.min(directAmt, subtotal);
    const pct = parseFloat(discountPercent) || 0;
    if (pct > 0) return Math.min((subtotal * pct) / 100, subtotal);
    return 0;
  }, [discountAmount, discountPercent, subtotal]);

  // Final Total
  const finalTotal = Math.max(0, subtotal - numericDiscount);
  const totalInBs = finalTotal * activeRate;
  const secondaryEquivalent = currency === 'USD' 
    ? (totalInBs / officialRateEUR) 
    : (totalInBs / officialRateUSD);

  // Handle discount inputs sync
  const handleDiscountPercentChange = (val: string) => {
    setDiscountPercent(val);
    const num = parseFloat(val);
    if (!isNaN(num) && subtotal > 0) {
      const calculated = ((subtotal * num) / 100).toFixed(2);
      setDiscountAmount(calculated);
    } else {
      setDiscountAmount('');
    }
  };

  const handleDiscountAmountChange = (val: string) => {
    setDiscountAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && subtotal > 0) {
      const calculatedPct = ((num / subtotal) * 100).toFixed(1);
      setDiscountPercent(calculatedPct);
    } else {
      setDiscountPercent('');
    }
  };

  // Stepper handlers in Step 1
  const handleIncreaseQty = (prod: InventoryItem) => {
    const current = selectedQuantities[prod.id] || 0;
    // If no products are selected yet, lock sale currency to this product's configured price currency
    const totalSelected = (Object.values(selectedQuantities) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
    if (totalSelected === 0) {
      const pCur = prod.priceCurrency || prod.currency;
      if (pCur === 'EUR' || pCur === 'USD') {
        setCurrency(pCur);
      }
    }
    setSelectedQuantities(prev => ({
      ...prev,
      [prod.id]: current + 1
    }));
    if (customUnitPrices[prod.id] === undefined) {
      setCustomUnitPrices(prev => ({ ...prev, [prod.id]: prod.price }));
    }
  };

  const handleDecreaseQty = (prodId: string) => {
    const current = selectedQuantities[prodId] || 0;
    if (current <= 1) {
      setSelectedQuantities(prev => {
        const next = { ...prev };
        delete next[prodId];
        return next;
      });
    } else {
      setSelectedQuantities(prev => ({
        ...prev,
        [prodId]: current - 1
      }));
    }
  };

  const handleRemoveSelectedItem = (prodId: string) => {
    setSelectedQuantities(prev => {
      const next = { ...prev };
      delete next[prodId];
      return next;
    });
  };

  const handleUpdateUnitPrice = (prodId: string, priceStr: string) => {
    const val = parseFloat(priceStr);
    setCustomUnitPrices(prev => ({
      ...prev,
      [prodId]: isNaN(val) ? 0 : val
    }));
  };

  // Filtered inventory for Step 1
  const allAvailableCategories = useMemo(() => {
    const set = new Set<string>();
    userCategories.forEach(c => c && set.add(c.trim()));
    inventory.forEach(p => p.category && set.add(p.category.trim()));
    return Array.from(set);
  }, [userCategories, inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(prod => {
      const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (prod.category && prod.category.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let matchesCategory = true;
      if (selectedCategoryFilter === 'low_stock') {
        matchesCategory = prod.stock <= 3;
      } else if (selectedCategoryFilter !== 'all') {
        matchesCategory = prod.category === selectedCategoryFilter;
      }

      return matchesSearch && matchesCategory;
    }).sort((a, b) => {
      if (sortOrder === 'price_asc') return a.price - b.price;
      if (sortOrder === 'price_desc') return b.price - a.price;
      if (sortOrder === 'stock') return b.stock - a.stock;
      return a.name.localeCompare(b.name);
    });
  }, [inventory, searchQuery, selectedCategoryFilter, sortOrder]);

  // Form submit / finish sale
  const handleFinishSale = () => {
    if (subtotal <= 0) {
      alert('Por favor especifica un monto o selecciona al menos 1 producto.');
      return;
    }

    if (saleType === 'deuda' && !selectedClientName.trim()) {
      alert('Para registrar una venta como Deuda (por cobrar), debes seleccionar o escribir un cliente.');
      return;
    }

    // Build sold items detail with exact cost & price currencies for auditability
    const soldItems: SoldItemDetail[] = isFreeSale ? [] : selectedItemsList.map(s => ({
      productId: s.item.id,
      name: s.item.name,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      unitCost: s.item.cost,
      costCurrency: s.item.costCurrency || s.item.currency || 'USD',
      priceCurrency: s.item.priceCurrency || s.item.currency || 'USD'
    }));

    // Build description
    let descriptionText = '';
    if (isFreeSale) {
      descriptionText = freeSaleConcept.trim() || 'Venta libre';
    } else {
      descriptionText = soldItems.map(s => `${s.quantity}x ${s.name}`).join(', ');
    }

    if (referenceNumber.trim()) {
      descriptionText += ` (Ref: ${referenceNumber.trim()})`;
    }
    if (notes.trim()) {
      descriptionText += ` - ${notes.trim()}`;
    }

    // Determine category
    let finalCategory = 'Ventas';
    if (isFreeSale && freeSaleCategory.trim()) {
      finalCategory = freeSaleCategory.trim();
    } else if (selectedItemsList.length > 0 && selectedItemsList[0].item.category) {
      finalCategory = selectedItemsList[0].item.category;
    }

    // If paid -> create FinancialRecord
    if (saleType === 'pagado') {
      let finalPaymentMethod = paymentMethod || 'Efectivo';
      if (finalPaymentMethod === 'Efectivo' || finalPaymentMethod === 'Efectivo USD' || finalPaymentMethod === 'Efectivo EUR') {
        finalPaymentMethod = currency === 'EUR' ? 'Efectivo EUR' : 'Efectivo USD';
      }

      const recordPayload: Omit<FinancialRecord, 'id'> = {
        type: 'ingreso',
        amount: finalTotal,
        amountBs: Number(totalInBs.toFixed(2)),
        exchangeRateUsed: currentRate,
        description: descriptionText,
        category: finalCategory,
        date: saleDate,
        paymentMethod: finalPaymentMethod,
        currency,
        soldItems
      };

      onCompleteSale(recordPayload, soldItems);
    } else {
      // If deuda -> register as account receivable
      if (onAddDebt) {
        onAddDebt({
          type: 'por_cobrar',
          debtorName: selectedClientName.trim() || 'Cliente sin nombre',
          amount: finalTotal,
          amountBs: Number(totalInBs.toFixed(2)),
          exchangeRateUsed: currentRate,
          currency: currency,
          dueDate: saleDate,
          status: 'pendiente',
          description: `Venta a crédito: ${descriptionText}`
        });
      }

      // Also register financial record if user tracks revenue or deduct inventory
      const debtSaleRecord: Omit<FinancialRecord, 'id'> = {
        type: 'ingreso',
        amount: finalTotal,
        amountBs: totalInBs,
        exchangeRateUsed: currentRate,
        description: `[A crédito / Deuda] ${descriptionText}`,
        category: finalCategory,
        date: saleDate,
        paymentMethod: 'Por cobrar (Deuda)',
        currency,
        soldItems
      };

      onCompleteSale(debtSaleRecord, soldItems);
    }

    onClose();
  };

  // Quick product create
  const handleCreateQuickProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;

    const stockNum = parseInt(newProdStock) || 0;
    const costNum = parseFloat(newProdCost) || 0;
    const priceNum = parseFloat(newProdPrice) || 0;
    const finalCat = newProdCategory.trim();

    if (finalCat) {
      if (isForbiddenCategory(finalCat)) {
        alert('Por favor especifica una categoría propia de tu negocio (ej. Ropa, Calzado, Tecnología, etc.).');
        return;
      }
      addUserCategory(finalCat, currentUserEmail);
    }

    onAddProduct({
      name: newProdName.trim(),
      stock: stockNum,
      cost: costNum,
      price: priceNum,
      costCurrency: newProdCurrency,
      priceCurrency: newProdCurrency,
      currency: newProdCurrency,
      status: stockNum > 0 ? 'disponible' : 'no_disponible',
      category: finalCat || undefined
    });

    setCurrency(newProdCurrency);
    setNewProdName('');
    setNewProdCategory('');
    setNewProdCost('');
    setNewProdPrice('');
    setNewProdStock('1');
    setNewProdCurrency('USD');
    setIsQuickProductModalOpen(false);
  };

  // Quick client create
  const handleCreateQuickClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    const newClient: Client = {
      id: `client-${Date.now()}`,
      name: newClientName.trim(),
      phone: newClientPhone.trim(),
      balanceUsd: 0
    };

    const updated = [newClient, ...clientsList];
    setClientsList(updated);
    try {
      localStorage.setItem(clientsStorageKey, JSON.stringify(updated));
    } catch (err) {
      console.warn('Could not save client', err);
    }

    setSelectedClientId(newClient.id);
    setSelectedClientName(newClient.name);
    setNewClientName('');
    setNewClientPhone('');
    setIsQuickClientModalOpen(false);
  };

  // Add category from manager
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (isForbiddenCategory(trimmed)) {
      alert('Por favor escribe una categoría propia para tus productos (ej. Ropa, Calzado, Tecnología, Alimentos, etc.)');
      return;
    }
    const updated = addUserCategory(trimmed, currentUserEmail);
    setUserCategories(updated);
    setNewCategoryInput('');
  };

  const handleDeleteCategory = (catName: string) => {
    const updated = deleteUserCategory(catName, currentUserEmail);
    setUserCategories(updated);
    if (selectedCategoryFilter === catName) {
      setSelectedCategoryFilter('all');
    }
  };

  if (!isOpen) return null;

  // Render method helpers
  const paymentMethodsList = [
    { id: 'Efectivo', name: 'Efectivo', icon: Banknote },
    { id: 'Tarjeta', name: 'Tarjeta', icon: CreditCard },
    { id: 'Transferencia bancaria', name: 'Transferencia bancaria', icon: Landmark },
    { id: 'Binance', name: 'Binance', icon: Coins },
    { id: 'Pago Móvil', name: 'Pago Móvil', icon: Smartphone },
    { id: 'Zelle', name: 'Zelle', icon: Zap },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-xs sm:items-center sm:justify-center sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-[#F8F9FA] min-h-screen sm:min-h-0 sm:h-[92vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-150">

        {/* ========================================================= */}
        {/* STEP 0: NUEVA VENTA - SELECT TYPE OF SALE (IMAGE 1)       */}
        {/* ========================================================= */}
        {step === 'choice' && (
          <div className="flex flex-col h-full">
            {/* Top Amber Header Bar */}
            <div className="bg-amber-400 px-4 py-3.5 flex items-center justify-between text-slate-950 shrink-0 shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 -ml-1 text-slate-950 hover:bg-black/10 rounded-full transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                </button>
                <h2 className="text-base font-extrabold tracking-tight text-slate-950">
                  Nueva venta
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-black/10 text-slate-950 transition-colors cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  ¿Qué tipo de venta deseas registrar?
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Selecciona una opción para abrir la pantalla completa con todas sus funcionalidades:
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {/* Option 1: Venta de productos */}
                <button
                  type="button"
                  onClick={() => {
                    setIsFreeSale(false);
                    setStep('select_products');
                  }}
                  className="w-full p-4 rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/20 bg-white flex items-center justify-between text-left transition-all shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-100/90 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                      <ShoppingBag className="w-7 h-7 stroke-[1.75]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-amber-900">
                        Venta de productos
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Registra una venta seleccionando los productos de tu inventario.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 shrink-0 ml-2" />
                </button>

                {/* Option 2: Venta libre */}
                <button
                  type="button"
                  onClick={() => {
                    setIsFreeSale(true);
                    setStep('payment_details');
                  }}
                  className="w-full p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/20 bg-white flex items-center justify-between text-left transition-all shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100/90 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                      <Banknote className="w-7 h-7 stroke-[1.75]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-emerald-900">
                        Venta libre
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Registra un ingreso <span className="font-semibold text-slate-700">sin seleccionar productos</span> de tu inventario.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 shrink-0 ml-2" />
                </button>

                {/* Option 3: Cotizaciones */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenQuotes) onOpenQuotes();
                  }}
                  className="w-full p-4 rounded-2xl border border-slate-200 hover:border-orange-400 hover:bg-orange-50/20 bg-white flex items-center justify-between text-left transition-all shadow-xs group cursor-pointer relative"
                >
                  <span className="absolute top-3 right-4 bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Nuevo
                  </span>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-orange-100/90 border border-orange-200 flex items-center justify-center text-orange-700 shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                      <FileText className="w-7 h-7 stroke-[1.75]" />
                    </div>
                    <div className="pr-12">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-orange-900">
                        Cotizaciones
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Crea cotizaciones para tus clientes y compártelas con ellos.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 shrink-0 ml-2" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 1: SELECCIONAR PRODUCTOS (IMAGE 2)                   */}
        {/* ========================================================= */}
        {step === 'select_products' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Top yellow header bar */}
            <div className="bg-amber-400 px-4 py-3.5 flex items-center justify-between text-slate-950 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep('choice')}
                  className="p-1 -ml-1 rounded-full hover:bg-black/10 transition-all cursor-pointer"
                  title="Volver"
                >
                  <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                </button>
                <h2 className="text-base font-extrabold tracking-tight">Seleccionar productos</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchQuery(prev => prev ? '' : ' ')}
                  className="p-1.5 rounded-full hover:bg-black/10 transition-all cursor-pointer"
                  title="Buscar"
                >
                  <Search className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sample = prompt('Escribe el código o nombre a buscar:');
                    if (sample) setSearchQuery(sample);
                  }}
                  className="p-1.5 rounded-full hover:bg-black/10 transition-all cursor-pointer"
                  title="Escanear código de barras"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-header controls */}
            <div className="p-4 bg-white border-b border-slate-100 space-y-3 shrink-0">
              {/* Rate info banner */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">Tasas oficiales BCV:</span>
                  <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-slate-600">
                    <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200">USD: Bs. {officialRateUSD.toFixed(2)}</span>
                    <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200">EUR: Bs. {officialRateEUR.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Search input (if open) */}
              {searchQuery !== '' && (
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar producto por nombre..."
                    value={searchQuery.trim() === '' ? '' : searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* + Nuevo producto full-width prominent button (as in image 2) */}
              <button
                type="button"
                onClick={() => setIsQuickProductModalOpen(true)}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border-2 border-slate-900 text-slate-900 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Nuevo producto</span>
              </button>

              {/* Filter and categories pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
                {/* Sort button */}
                <button
                  type="button"
                  onClick={() => {
                    const next = sortOrder === 'name' ? 'price_asc' : sortOrder === 'price_asc' ? 'price_desc' : sortOrder === 'price_desc' ? 'stock' : 'name';
                    setSortOrder(next);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 hover:bg-slate-800 transition-all cursor-pointer"
                  title="Ordenar productos"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>

                {/* Manage categories button */}
                <button
                  type="button"
                  onClick={() => setIsCategoryManagerOpen(true)}
                  className="w-8 h-8 rounded-xl border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 hover:bg-slate-50 transition-all cursor-pointer"
                  title="Gestionar mis categorías"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                {/* Tab: Todas */}
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategoryFilter === 'all'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todas
                </button>

                {/* Tab: Unidades bajas */}
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('low_stock')}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer border ${
                    selectedCategoryFilter === 'low_stock'
                      ? 'bg-amber-100 border-amber-400 text-amber-950 font-black'
                      : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                  }`}
                >
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  <span>Unidades bajas</span>
                </button>

                {/* Dynamic user-defined categories */}
                {allAvailableCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer border ${
                      selectedCategoryFilter === cat
                        ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                        : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products list area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredInventory.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <ShoppingBag className="w-8 h-8 stroke-[1.5]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800">
                      {inventory.length === 0 
                        ? 'No tienes productos aún' 
                        : 'No se encontraron productos con ese filtro'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      {inventory.length === 0
                        ? 'Crea tu primer producto para empezar a venderlo con control de inventario automático.'
                        : 'Prueba quitando el filtro o busca otro nombre.'}
                    </p>
                  </div>
                  {inventory.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setIsQuickProductModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Crear mi primer producto</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredInventory.map(prod => {
                  const qty = selectedQuantities[prod.id] || 0;
                  const isLow = prod.stock <= 3 && prod.stock > 0;
                  const isOut = prod.stock === 0;

                  return (
                    <div
                      key={prod.id}
                      className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all"
                    >
                      {/* Product icon avatar */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-purple-100/80 border border-purple-200/60 flex items-center justify-center font-black text-purple-700 text-base shrink-0">
                          {prod.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {prod.name}
                          </h4>
                          
                          {/* Stock and currency badge */}
                          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-block font-extrabold text-[9px] px-1.5 py-0.5 rounded-md ${
                              prod.currency === 'EUR' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {prod.currency === 'EUR' ? '€ EUR' : '$ USD'}
                            </span>
                            {isOut ? (
                              <span className="inline-block bg-rose-50 border border-rose-200 text-rose-600 font-extrabold text-[10px] px-2 py-0.5 rounded-md">
                                No disponible
                              </span>
                            ) : isLow ? (
                              <span className="inline-block bg-amber-50 border border-amber-200 text-amber-700 font-extrabold text-[10px] px-2 py-0.5 rounded-md">
                                Pocas unidades ({prod.stock})
                              </span>
                            ) : (
                              <span className="inline-block bg-slate-100 text-slate-600 font-bold text-[10px] px-2 py-0.5 rounded-md">
                                {prod.stock} disponibles
                              </span>
                            )}
                          </div>

                          {/* Price in product's native currency */}
                          {(() => {
                            const prodCur = prod.currency || 'USD';
                            const prodSym = prodCur === 'EUR' ? '€' : '$';
                            const prodRate = prodCur === 'EUR' ? officialRateEUR : officialRateUSD;
                            const bsVal = prod.price * prodRate;
                            return (
                              <div className="text-xs sm:text-sm font-black text-slate-900 mt-1 font-mono flex items-baseline gap-1.5 flex-wrap">
                                <span>
                                  {prodSym}{prod.price.toFixed(2)} <span className="text-[10px] text-slate-500 font-bold">{prodCur}</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ≈ Bs. {bsVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Stepper buttons */}
                      <div className="flex items-center gap-2 shrink-0 border border-slate-200 rounded-xl p-1 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => handleDecreaseQty(prod.id)}
                          disabled={qty === 0}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-all ${
                            qty === 0 
                              ? 'text-slate-300 cursor-not-allowed' 
                              : 'text-slate-700 hover:bg-white active:scale-95 cursor-pointer'
                          }`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-black font-mono text-xs sm:text-sm text-slate-900">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIncreaseQty(prod)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-slate-900 hover:bg-white active:scale-95 transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom sticky bar (Image 2) */}
            <div className="p-3 bg-white border-t border-slate-100 shrink-0">
              <button
                type="button"
                disabled={totalUnits === 0}
                onClick={() => setStep('confirm_quantities')}
                className={`w-full py-3.5 px-4 rounded-2xl flex items-center justify-between transition-all font-bold text-xs sm:text-sm ${
                  totalUnits > 0
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-md cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                    totalUnits > 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {totalUnits}
                  </span>
                  <span>Añadir productos</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono font-black">
                  <span>{currency === 'USD' ? '$' : '€'}{subtotal.toFixed(2)}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: CONFIRMA PRECIOS Y CANTIDADES (IMAGE 3)           */}
        {/* ========================================================= */}
        {step === 'confirm_quantities' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Top yellow header bar */}
            <div className="bg-amber-400 px-4 py-3.5 flex items-center justify-between text-slate-950 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep('select_products')}
                  className="p-1 -ml-1 rounded-full hover:bg-black/10 transition-all cursor-pointer"
                  title="Volver"
                >
                  <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                </button>
                <h2 className="text-base font-extrabold tracking-tight">Confirma precios y cantidades</h2>
              </div>
            </div>

            {/* Currency info bar */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">Moneda de venta:</span>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                  currency === 'EUR' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {currency === 'EUR' ? '€ Euro (EUR)' : '$ Dólar (USD)'}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 font-semibold">
                Tasa: Bs. {activeRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Scrollable container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Blue info callout (Image 3) */}
              <div className="bg-sky-50 border border-sky-200 text-sky-900 rounded-2xl p-3.5 flex items-start gap-3">
                <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <p className="text-xs font-medium leading-relaxed">
                  Al crear la venta se descontarán las unidades seleccionadas de tu inventario.
                </p>
              </div>

              {/* Selected items cards list */}
              <div className="space-y-4">
                {selectedItemsList.map(({ item, quantity, unitPrice }) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                    {/* Header of item */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center font-black text-purple-700 text-xs shrink-0">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {item.name}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedItem(item.id)}
                        className="w-8 h-8 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all cursor-pointer shrink-0"
                        title="Eliminar de la venta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Inputs: Cantidad and Precio unitario */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {/* Cantidad stepper */}
                      <div>
                        <label className="block text-[10px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                          Cantidad <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center justify-between border border-slate-200 bg-slate-50 rounded-xl p-1.5">
                          <button
                            type="button"
                            onClick={() => handleDecreaseQty(item.id)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold active:scale-95 transition-all cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono font-black text-sm text-slate-900">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleIncreaseQty(item)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold active:scale-95 transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Precio unitario input */}
                      <div>
                        <label className="block text-[10px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                          Precio unitario <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 font-bold font-mono text-slate-400 text-xs">
                            {currency === 'USD' ? '$' : '€'}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={unitPrice}
                            onChange={(e) => handleUpdateUnitPrice(item.id, e.target.value)}
                            className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs sm:text-sm font-black text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Subtext info */}
                    <div className="text-[11px] font-bold text-slate-400 font-mono pt-1 flex items-baseline justify-between">
                      <div>
                        Precio por {quantity} {quantity === 1 ? 'unidad' : 'unidades'}:{' '}
                        <span className="text-slate-800 font-black">
                          {currency === 'USD' ? '$' : '€'}{(unitPrice * quantity).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold">
                        Bs. {((unitPrice * quantity) * activeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom sticky bar (Image 3) */}
            <div className="p-3 bg-white border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setStep('payment_details')}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center justify-between transition-all font-bold text-xs sm:text-sm cursor-pointer shadow-md"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center">
                    {totalUnits}
                  </span>
                  <span>Confirmar</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono font-black">
                  <span>{currency === 'USD' ? '$' : '€'}{subtotal.toFixed(2)}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: NUEVA VENTA (PAYMENT & DETAILS - IMAGES 4 & 5)    */}
        {/* ========================================================= */}
        {step === 'payment_details' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Top yellow header bar */}
            <div className="bg-amber-400 px-4 py-3.5 flex items-center justify-between text-slate-950 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isFreeSale) {
                      setStep('choice');
                    } else {
                      setStep('confirm_quantities');
                    }
                  }}
                  className="p-1 -ml-1 rounded-full hover:bg-black/10 transition-all cursor-pointer"
                  title="Volver"
                >
                  <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                </button>
                <h2 className="text-base font-extrabold tracking-tight">Nueva venta</h2>
              </div>
            </div>

            {/* Scrollable form content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Pagado vs Deuda segmented buttons (Image 4) */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSaleType('pagado')}
                  className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                    saleType === 'pagado'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pagado
                </button>
                <button
                  type="button"
                  onClick={() => setSaleType('deuda')}
                  className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                    saleType === 'deuda'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Deuda
                </button>
              </div>

              {/* Multi-moneda toggle & Currency/Rate card */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                        Moneda y tasa de cambio
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Cálculo automático en divisas y bolívares
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMultiCurrencyActive(!isMultiCurrencyActive)}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      isMultiCurrencyActive ? 'bg-slate-900' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                        isMultiCurrencyActive ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {isMultiCurrencyActive && (
                  <div className="pt-2 border-t border-slate-100 space-y-2.5">
                    {/* Moneda configurada por el producto */}
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                      <span className="text-xs font-bold text-slate-600">Moneda de la venta:</span>
                      <span className={`px-2.5 py-1 rounded-lg font-black text-xs inline-flex items-center gap-1.5 ${
                        currency === 'EUR' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        <span>{currency === 'EUR' ? '€' : '$'}</span>
                        <span>{currency === 'EUR' ? 'Euro (EUR)' : 'Dólar (USD)'}</span>
                      </span>
                    </div>

                    {/* Rate Selector Pills */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Tasa aplicada:
                        </span>
                        <span className="text-[11px] font-mono font-black text-emerald-700">
                          1 {currency === 'USD' ? '$' : '€'} = Bs. {activeRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setRateType('bcv')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            rateType === 'bcv'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                          }`}
                        >
                          Tasa BCV ({currency === 'USD' ? officialRateUSD.toFixed(2) : officialRateEUR.toFixed(2)})
                        </button>

                        {currency === 'USD' && (
                          <button
                            type="button"
                            onClick={() => setRateType('paralelo')}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              rateType === 'paralelo'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                            }`}
                          >
                            Tasa Paralelo ({paraleloRateUSD.toFixed(2)})
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setRateType('custom');
                            if (!customRateInput) setCustomRateInput(activeRate.toString());
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            rateType === 'custom'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                          }`}
                        >
                          Personalizada
                        </button>
                      </div>

                      {rateType === 'custom' && (
                        <div className="pt-2 flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700">Bs. por cada {currency === 'USD' ? '$' : '€'}:</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ej. 850.00"
                            value={customRateInput}
                            onChange={(e) => setCustomRateInput(e.target.value)}
                            className="w-32 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Free sale specific inputs (when coming from Venta libre) */}
              {isFreeSale && (
                <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold text-xs">
                    <Banknote className="w-4 h-4" />
                    <span>Datos del ingreso libre</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                      Monto a cobrar ({currency === 'USD' ? '$' : '€'}) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 font-bold font-mono text-slate-400 text-sm">
                        {currency === 'USD' ? '$' : '€'}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={freeSaleAmount}
                        onChange={(e) => setFreeSaleAmount(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-base font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                      Concepto / Detalle
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Servicio, Venta general..."
                      value={freeSaleConcept}
                      onChange={(e) => setFreeSaleConcept(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                      Categoría
                    </label>
                    <input
                      type="text"
                      list="sale-user-categories"
                      placeholder="Escribe o selecciona categoría..."
                      value={freeSaleCategory}
                      onChange={(e) => setFreeSaleCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    <datalist id="sale-user-categories">
                      {allAvailableCategories.map(c => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                </div>
              )}

              {/* Resumen y lista de productos seleccionados (Ver / Cambiar productos) */}
              {!isFreeSale && selectedItemsList.length > 0 && (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-black text-xs">
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <span className="text-xs font-black text-slate-900">
                          Productos en la venta ({totalUnits})
                        </span>
                        <p className="text-[10px] text-slate-400">
                          Subtotal: {currency === 'EUR' ? '€' : '$'}{subtotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('select_products')}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg border border-amber-200 transition-colors cursor-pointer"
                    >
                      Ver / Cambiar productos
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto pr-1">
                    {selectedItemsList.map(({ item, quantity, unitPrice }) => (
                      <div key={item.id} className="py-1.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-black text-[10px] flex items-center justify-center shrink-0">
                            {quantity}x
                          </span>
                          <span className="font-semibold text-slate-800 truncate">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 shrink-0">
                          {currency === 'EUR' ? '€' : '$'}{(unitPrice * quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fecha de la venta (Image 4) */}
              <div className="flex items-center justify-between text-xs py-1">
                <div className="font-extrabold text-slate-900">
                  Fecha de la venta :{' '}
                  <span className="font-bold text-slate-700">{saleDate}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingDate(!isEditingDate)}
                  className="text-blue-600 hover:text-blue-700 font-bold underline cursor-pointer"
                >
                  {isEditingDate ? 'Listo' : 'Editar'}
                </button>
              </div>
              {isEditingDate && (
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              )}

              {/* Number of payments & methods (When Pagado - Image 4) */}
              {saleType === 'pagado' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-900 mb-2">
                      Selecciona el número de pagos y su método <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setNumberOfPayments(num)}
                          className={`w-9 h-9 rounded-xl font-black text-xs shrink-0 transition-all cursor-pointer ${
                            numberOfPayments === num
                              ? 'bg-amber-400 text-slate-950 shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment methods cards grid (Image 4) */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {paymentMethodsList.map(method => {
                      const IconComp = method.icon;
                      const isSelected = paymentMethod === method.id;

                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id)}
                          className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 shadow-xs ring-1 ring-emerald-500'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <IconComp className={`w-5 h-5 ${isSelected ? 'text-emerald-600' : 'text-slate-500'}`} />
                          <span className="text-[10.5px] font-bold leading-tight">
                            {method.id === 'Efectivo'
                              ? (currency === 'EUR' ? 'Efectivo (€)' : 'Efectivo ($)')
                              : method.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* If Deuda -> notice */}
              {saleType === 'deuda' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-medium leading-relaxed">
                  Esta venta se registrará a crédito y quedará anotada como una cuenta por cobrar en el módulo de Deudas.
                </div>
              )}

              {/* Descuento section (Image 4) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-900">
                  Descuento
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      max="100"
                      value={discountPercent}
                      onChange={(e) => handleDiscountPercentChange(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                  </div>
                  <span className="font-bold text-slate-400">=</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 font-mono">
                      {currency === 'USD' ? '$' : '€'}
                    </span>
                    <input
                      type="number"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={discountAmount}
                      onChange={(e) => handleDiscountAmountChange(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Cliente selector (Image 4 & 5) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-slate-900">
                    Cliente {saleType === 'deuda' && <span className="text-rose-500">*</span>}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickClientModalOpen(true)}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                  >
                    + Nuevo cliente
                  </button>
                </div>
                <div className="relative">
                  <select
                    value={selectedClientId}
                    onChange={(e) => {
                      const cId = e.target.value;
                      setSelectedClientId(cId);
                      const found = clientsList.find(c => c.id === cId);
                      setSelectedClientName(found ? found.name : '');
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 appearance-none focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white cursor-pointer"
                  >
                    <option value="">Selecciona un cliente</option>
                    {clientsList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Más opciones accordion (Image 5) */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setIsMoreOptionsOpen(!isMoreOptionsOpen)}
                  className="w-full p-3 flex items-center justify-between text-xs font-bold text-slate-800 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <span>Más opciones</span>
                  {isMoreOptionsOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {isMoreOptionsOpen && (
                  <div className="p-3 border-t border-slate-100 space-y-3 bg-slate-50/50 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Nro. de Referencia / Comprobante
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. REF-8921"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Notas u observaciones
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Notas sobre el pago, entrega o cliente..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Detalle del pago accordion (Image 4 & 5) */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setIsPaymentDetailOpen(!isPaymentDetailOpen)}
                  className="w-full p-3 flex items-center justify-between text-xs font-bold text-slate-800 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <span>Detalle del pago</span>
                  {isPaymentDetailOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {isPaymentDetailOpen && (
                  <div className="p-3 border-t border-slate-100 space-y-1.5 text-xs bg-slate-50/50">
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>Subtotal</span>
                      <span className="font-mono font-bold">{currency === 'USD' ? '$' : '€'}{subtotal.toFixed(2)}</span>
                    </div>
                    {numericDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Descuento aplicado</span>
                        <span className="font-mono font-bold">-{currency === 'USD' ? '$' : '€'}{numericDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 font-extrabold pt-1 border-t border-slate-200">
                      <span>Total final</span>
                      <span className="font-mono text-sm">{currency === 'USD' ? '$' : '€'}{finalTotal.toFixed(2)}</span>
                    </div>
                    {isMultiCurrencyActive && (
                      <div className="flex justify-between text-[11px] text-slate-600 font-medium pt-1">
                        <span>Equivalente en Bs ({rateType === 'custom' ? 'Personalizada' : rateType === 'paralelo' ? 'Paralelo' : 'BCV'}):</span>
                        <span className="font-mono font-black text-slate-900">
                          Bs. {totalInBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom sticky bar: Crear venta (Images 4 & 5) */}
            <div className="p-3 bg-white border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={handleFinishSale}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center justify-between transition-all font-bold text-xs sm:text-sm cursor-pointer shadow-md"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center">
                    {isFreeSale ? '1' : totalUnits}
                  </span>
                  <span>Crear venta</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono font-black">
                  <span>{currency === 'USD' ? '$' : '€'}{finalTotal.toFixed(2)}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-MODAL 1: QUICK CREATE PRODUCT                         */}
        {/* ========================================================= */}
        {isQuickProductModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden border border-slate-200 shadow-2xl">
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-400" />
                  Nuevo producto
                </h3>
                <button
                  type="button"
                  onClick={() => setIsQuickProductModalOpen(false)}
                  className="rounded-full bg-white/10 p-1.5 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateQuickProduct} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[9px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                    Nombre del producto <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Camisa, Zapato, Artículo..."
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                      Categoría
                    </label>
                    <input
                      type="text"
                      list="user-categories-list"
                      placeholder="Ej. Ropa, Calzado..."
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    <datalist id="user-categories-list">
                      {allAvailableCategories.map(c => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                      Stock inicial
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProdStock}
                      onChange={(e) => setNewProdStock(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                    Moneda del producto <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setNewProdCurrency('USD')}
                      className={`py-1.5 px-3 rounded-lg font-black text-xs transition-all cursor-pointer ${
                        newProdCurrency === 'USD'
                          ? 'bg-white text-emerald-800 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      $ Dólar (USD)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewProdCurrency('EUR')}
                      className={`py-1.5 px-3 rounded-lg font-black text-xs transition-all cursor-pointer ${
                        newProdCurrency === 'EUR'
                          ? 'bg-white text-blue-800 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      € Euro (EUR)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                      Costo ({newProdCurrency === 'EUR' ? '€' : '$'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={newProdCost}
                      onChange={(e) => setNewProdCost(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                      Precio de venta ({newProdCurrency === 'EUR' ? '€' : '$'}) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickProductModalOpen(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 cursor-pointer shadow-sm"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-MODAL 2: QUICK CREATE CLIENT                          */}
        {/* ========================================================= */}
        {isQuickClientModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden border border-slate-200 shadow-2xl">
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                  <User className="w-4 h-4 text-emerald-400" />
                  Nuevo cliente
                </h3>
                <button
                  type="button"
                  onClick={() => setIsQuickClientModalOpen(false)}
                  className="rounded-full bg-white/10 p-1.5 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateQuickClient} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[9px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                    Nombre del cliente <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 0412-1234567"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickClientModalOpen(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 cursor-pointer shadow-sm"
                  >
                    Guardar cliente
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-MODAL 3: CATEGORY MANAGER (Pencil icon in Step 1)    */}
        {/* ========================================================= */}
        {isCategoryManagerOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden border border-slate-200 shadow-2xl">
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-400" />
                  Gestionar mis categorías
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCategoryManagerOpen(false)}
                  className="rounded-full bg-white/10 p-1.5 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {/* Form to add new category */}
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nueva categoría (ej. Calzado)..."
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer shrink-0"
                  >
                    Añadir
                  </button>
                </form>

                {/* Categories list */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {userCategories.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      Aún no tienes categorías agregadas. Escribe una arriba para crearla.
                    </p>
                  ) : (
                    userCategories.map(cat => (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80"
                      >
                        <span className="font-bold text-slate-800">{cat}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCategoryManagerOpen(false)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold cursor-pointer"
                  >
                    Listo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
