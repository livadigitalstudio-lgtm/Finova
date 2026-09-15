import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, Calendar, ChevronDown, ChevronRight, X, Plus, Minus, Check, 
  Search, AlertCircle, Info, Tag, Package, Droplets, Home, Users, Scale, 
  Megaphone, Truck, Wrench, Armchair, LayoutGrid, Banknote, CreditCard, 
  Landmark, MessageSquare, Crown, Sparkles, PlusCircle, CheckCircle2, ShoppingBag
} from 'lucide-react';
import { 
  FinancialRecord, InventoryItem, DebtItem, ExchangeRates, PurchasedItemDetail 
} from '../types';
import { convertAmount } from '../utils/currency';
import { getLocalDateString } from '../utils/dateUtils';
import { storageService } from '../services/storageService';

export interface SupplierItem {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  location?: string;
}

interface ExpenseFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteExpense: (
    record: Omit<FinancialRecord, 'id'>,
    purchasedItems?: PurchasedItemDetail[]
  ) => void;
  onAddDebt?: (debt: Omit<DebtItem, 'id' | 'dateCreated'>) => void;
  onRestockInventory?: (purchasedItems: PurchasedItemDetail[]) => void;
  onAddProduct: (item: Omit<InventoryItem, 'id'>) => Promise<InventoryItem | void> | InventoryItem | void;
  rates: ExchangeRates;
  initialCurrency?: 'USD' | 'EUR';
  inventory: InventoryItem[];
  currentUserEmail?: string;
  onNavigateToDeudas?: () => void;
}

// 10 Official Expense Categories matching Treinta app screenshots
export const EXPENSE_CATEGORIES = [
  { id: 'servicios_publicos', name: 'Servicios públicos', icon: Droplets, color: 'text-sky-600' },
  { id: 'compra_productos', name: 'Compra de productos e insumos', icon: Package, color: 'text-emerald-600', isInventoryPurchase: true },
  { id: 'arriendo', name: 'Arriendo', icon: Home, color: 'text-amber-600' },
  { id: 'nomina', name: 'Nómina', icon: Users, color: 'text-indigo-600' },
  { id: 'gastos_administrativos', name: 'Gastos administrativos', icon: Scale, color: 'text-slate-600' },
  { id: 'mercadeo_publicidad', name: 'Mercadeo y publicidad', icon: Megaphone, color: 'text-pink-600' },
  { id: 'transporte_logistica', name: 'Transporte, domicilios y logística', icon: Truck, color: 'text-orange-600' },
  { id: 'mantenimiento_reparaciones', name: 'Mantenimiento y reparaciones', icon: Wrench, color: 'text-teal-600' },
  { id: 'muebles_equipos', name: 'Muebles, equipos o maquinaria', icon: Armchair, color: 'text-purple-600' },
  { id: 'otros', name: 'Otros', icon: LayoutGrid, color: 'text-gray-600' }
];

// 6 Official Payment Methods matching Treinta app screenshots
export const PAYMENT_METHODS = [
  { id: 'Efectivo', label: 'Efectivo', iconType: 'cash' },
  { id: 'Tarjeta', label: 'Tarjeta', iconType: 'card' },
  { id: 'Transferencia bancaria', label: 'Transferencia bancaria', iconType: 'bank' },
  { id: 'Binance', label: 'Binance', iconType: 'binance' },
  { id: 'Pago Móvil', label: 'Pago Móvil', iconType: 'pagomovil' },
  { id: 'Zelle', label: 'Zelle', iconType: 'zelle' }
];

function formatExpenseDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const todayStr = getLocalDateString();
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const monthName = months[m - 1] || '';
  if (dateStr === todayStr) {
    return `Hoy, ${d} ${monthName}`;
  }
  return `${d} ${monthName}`;
}

export function ExpenseFlowModal({
  isOpen,
  onClose,
  onCompleteExpense,
  onAddDebt,
  onRestockInventory,
  onAddProduct,
  rates,
  initialCurrency = 'USD',
  inventory = [],
  currentUserEmail = '',
  onNavigateToDeudas
}: ExpenseFlowModalProps) {
  // Main form states
  const [expenseMode, setExpenseMode] = useState<'pagado' | 'deuda'>('pagado');
  const [expenseDate, setExpenseDate] = useState(getLocalDateString());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);

  // Products purchase selection
  const [selectedProductQuantities, setSelectedProductQuantities] = useState<Record<string, number>>({});
  const [productUnitCosts, setProductUnitCosts] = useState<Record<string, number>>({});
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // New product inline creation
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdQuantity, setNewProdQuantity] = useState('1');
  const [newProdCost, setNewProdCost] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdError, setNewProdError] = useState('');

  // Amount & Concept
  const [amountStr, setAmountStr] = useState('');
  const [hasInteractedWithAmount, setHasInteractedWithAmount] = useState(false);
  const [concept, setConcept] = useState('');

  // Supplier state
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [isSupplierSheetOpen, setIsSupplierSheetOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [newSupplierInput, setNewSupplierInput] = useState('');
  const [suppliersList, setSuppliersList] = useState<SupplierItem[]>([]);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');

  // Deuda specific due date
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });

  // Load suppliers
  useEffect(() => {
    if (currentUserEmail) {
      const cached = storageService.getSync<SupplierItem[]>(`gt_suppliers_${currentUserEmail}`, []);
      setSuppliersList(cached);
      storageService.get<SupplierItem[]>(`gt_suppliers_${currentUserEmail}`, cached).then(list => {
        if (list && list.length > 0) setSuppliersList(list);
      });
    }
  }, [currentUserEmail, isOpen]);

  // Currency & Rate states
  const [currency, setCurrency] = useState<'USD' | 'EUR'>(initialCurrency || 'USD');
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

  // Reset or initialize state when opening
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setExpenseMode('pagado');
      setExpenseDate(getLocalDateString());
      setSelectedCategory('');
      setSelectedProductQuantities({});
      setProductUnitCosts({});
      setAmountStr('');
      setHasInteractedWithAmount(false);
      setConcept('');
      setSelectedSupplier('');
      setPaymentMethod('Efectivo');
      setCurrency(initialCurrency || 'USD');
      setRateType('bcv');
      setCustomRateInput('');
      setIsCategorySheetOpen(false);
      setIsProductSelectorOpen(false);
      setIsSupplierSheetOpen(false);
      setIsNewProductModalOpen(false);
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, initialCurrency]);

  // Derived selected products detail list
  const selectedProductsList: PurchasedItemDetail[] = useMemo(() => {
    const list: PurchasedItemDetail[] = [];
    for (const [prodId, qty] of Object.entries(selectedProductQuantities)) {
      if (typeof qty === 'number' && qty > 0) {
        const prod = inventory.find(p => p.id === prodId);
        if (prod) {
          const prodCostCur = prod.costCurrency || prod.currency || 'USD';
          let defaultUnitCost = prod.cost || prod.price || 0;
          if (prodCostCur !== currency) {
            defaultUnitCost = parseFloat(convertAmount(defaultUnitCost, prodCostCur, currency, rates).toFixed(2));
          }
          const unitCost = productUnitCosts[prodId] !== undefined ? productUnitCosts[prodId] : defaultUnitCost;
          list.push({
            productId: prod.id,
            name: prod.name,
            quantity: qty,
            unitCost,
            currency: currency
          });
        }
      }
    }
    return list;
  }, [selectedProductQuantities, productUnitCosts, inventory, currency, rates]);

  // Total calculated cost from products
  const totalCalculatedFromProducts = useMemo(() => {
    return selectedProductsList.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0);
  }, [selectedProductsList]);

  const totalProductsSelectedCount = useMemo(() => {
    return selectedProductsList.reduce((acc, item) => acc + item.quantity, 0);
  }, [selectedProductsList]);

  // Auto-sync amount if user is selecting products in "Compra de productos e insumos"
  const isInventoryCategory = selectedCategory === 'Compra de productos e insumos';

  const numericAmount = useMemo(() => {
    if (isInventoryCategory && selectedProductsList.length > 0) {
      return totalCalculatedFromProducts;
    }
    const parsed = parseFloat(amountStr.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }, [isInventoryCategory, selectedProductsList.length, totalCalculatedFromProducts, amountStr]);

  const amountInBs = numericAmount * activeRate;
  const secondaryEquivalent = currency === 'USD' 
    ? (amountInBs / officialRateEUR) 
    : (amountInBs / officialRateUSD);

  // Handlers for product selection quantities
  const handleIncreaseQty = (prod: InventoryItem) => {
    const currentQty = selectedProductQuantities[prod.id] || 0;
    const newQty = currentQty + 1;
    setSelectedProductQuantities(prev => ({
      ...prev,
      [prod.id]: newQty
    }));
    if (productUnitCosts[prod.id] === undefined) {
      const prodCostCur = prod.costCurrency || prod.currency || 'USD';
      const baseCost = prod.cost || prod.price || 0;
      const initialCost = prodCostCur !== currency
        ? parseFloat(convertAmount(baseCost, prodCostCur, currency, rates).toFixed(2))
        : baseCost;
      setProductUnitCosts(prev => ({
        ...prev,
        [prod.id]: initialCost
      }));
    }
  };

  const handleDecreaseQty = (prodId: string) => {
    const currentQty = selectedProductQuantities[prodId] || 0;
    if (currentQty <= 1) {
      setSelectedProductQuantities(prev => {
        const next = { ...prev };
        delete next[prodId];
        return next;
      });
    } else {
      setSelectedProductQuantities(prev => ({
        ...prev,
        [prodId]: currentQty - 1
      }));
    }
  };

  const handleUpdateUnitCost = (prodId: string, costVal: number) => {
    setProductUnitCosts(prev => ({
      ...prev,
      [prodId]: Math.max(0, costVal)
    }));
  };

  // Quick addition of brand new product on the fly
  const handleCreateNewProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      setNewProdError('Ingresa el nombre del producto');
      return;
    }
    const cost = parseFloat(newProdCost.replace(',', '.')) || 0;
    const price = parseFloat(newProdPrice.replace(',', '.')) || (cost > 0 ? Number((cost * 1.3).toFixed(2)) : 0);
    const qty = parseInt(newProdQuantity, 10) || 1;

    try {
      const createdItem = await onAddProduct({
        name: newProdName.trim(),
        stock: qty,
        cost: cost,
        price: price,
        costCurrency: currency,
        priceCurrency: currency,
        currency: currency,
        status: 'disponible',
        category: newProdCategory.trim() || 'General'
      });

      // If createdItem is returned, add to selection immediately
      const idToSelect = (createdItem as InventoryItem)?.id || `prod-${Date.now()}`;
      setSelectedProductQuantities(prev => ({
        ...prev,
        [idToSelect]: qty
      }));
      setProductUnitCosts(prev => ({
        ...prev,
        [idToSelect]: cost
      }));

      // Reset form and close
      setNewProdName('');
      setNewProdCategory('');
      setNewProdQuantity('1');
      setNewProdCost('');
      setNewProdPrice('');
      setNewProdError('');
      setIsNewProductModalOpen(false);
    } catch (err) {
      console.error("Error creating product:", err);
      setNewProdError('No se pudo crear el producto');
    }
  };

  // Supplier selection & creation
  const handleSelectOrAddSupplier = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSelectedSupplier(trimmed);

    // If new, save to list
    const exists = suppliersList.some(s => s.name.toLowerCase() === trimmed.toLowerCase());
    if (!exists && currentUserEmail) {
      const newSup: SupplierItem = {
        id: `sup-${Date.now()}`,
        name: trimmed
      };
      const updated = [newSup, ...suppliersList];
      setSuppliersList(updated);
      storageService.set(`gt_suppliers_${currentUserEmail}`, updated);
    }
    setIsSupplierSheetOpen(false);
    setNewSupplierInput('');
  };

  // Final submit
  const handleSaveExpense = () => {
    setHasInteractedWithAmount(true);
    if (numericAmount <= 0) {
      return;
    }

    if (expenseMode === 'deuda' && !selectedSupplier.trim()) {
      setIsSupplierSheetOpen(true);
      return;
    }

    const effectiveConcept = concept.trim() || (
      isInventoryCategory && selectedProductsList.length > 0
        ? `Compra de ${totalProductsSelectedCount} unidades (${selectedProductsList.map(p => p.name).slice(0, 3).join(', ')}${selectedProductsList.length > 3 ? '...' : ''})`
        : `Gasto en ${selectedCategory || 'General'}`
    );

    if (expenseMode === 'deuda') {
      // 1. Register Debt (Por pagar)
      if (onAddDebt) {
        onAddDebt({
          type: 'por_pagar',
          debtorName: selectedSupplier.trim() || 'Proveedor',
          amount: numericAmount,
          amountBs: Number(amountInBs.toFixed(2)),
          exchangeRateUsed: activeRate,
          currency: currency,
          dueDate: dueDate,
          status: 'pendiente',
          description: effectiveConcept
        });
      }

      // 2. If products were purchased on credit, restock inventory immediately
      if (selectedProductsList.length > 0 && onRestockInventory) {
        onRestockInventory(selectedProductsList);
      }

      onClose();
      if (onNavigateToDeudas) {
        onNavigateToDeudas();
      }
    } else {
      // "Pagado" mode
      const newRecord: Omit<FinancialRecord, 'id'> = {
        type: 'egreso',
        amount: numericAmount,
        amountBs: Number(amountInBs.toFixed(2)),
        exchangeRateUsed: activeRate,
        description: effectiveConcept,
        category: selectedCategory || 'Compra de productos e insumos',
        date: expenseDate,
        paymentMethod: paymentMethod,
        currency: currency,
        purchasedItems: selectedProductsList.length > 0 ? selectedProductsList : undefined,
        supplier: selectedSupplier.trim() || undefined
      };

      onCompleteExpense(newRecord, selectedProductsList.length > 0 ? selectedProductsList : undefined);
      onClose();
    }
  };

  if (!isOpen) return null;

  const isAmountInvalid = hasInteractedWithAmount && numericAmount <= 0;

  // Filtered inventory for product selector
  const filteredProducts = inventory.filter(prod => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return prod.name.toLowerCase().includes(q) || (prod.category && prod.category.toLowerCase().includes(q));
  });

  // Filtered suppliers
  const filteredSuppliers = suppliersList.filter(s => {
    if (!supplierSearch.trim()) return true;
    return s.name.toLowerCase().includes(supplierSearch.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-xs sm:items-center sm:justify-center sm:p-4 overflow-y-auto">
      {/* Container simulating mobile app card or full mobile screen */}
      <div className="w-full max-w-lg bg-[#F8F9FA] min-h-screen sm:min-h-0 sm:max-h-[92vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* TOP HEADER: Amber brand yellow matching Finova app and SaleFlowModal */}
        <div className="bg-amber-400 px-4 py-3.5 flex items-center justify-between text-slate-950 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="p-1 -ml-1 text-slate-950 hover:bg-black/10 rounded-full transition-colors cursor-pointer"
              aria-label="Regresar"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <h1 className="text-base font-extrabold text-slate-950 tracking-tight">
              Nuevo gasto
            </h1>
          </div>
        </div>

        {/* SCROLLABLE FORM BODY */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          
          {/* 1. SEGMENTED SWITCH: Pagado / Deuda */}
          <div className="bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpenseMode('pagado')}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                expenseMode === 'pagado'
                  ? 'bg-[#0D7A5F] text-white shadow-sm'
                  : 'bg-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Pagado
            </button>
            <button
              type="button"
              onClick={() => setExpenseMode('deuda')}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                expenseMode === 'deuda'
                  ? 'bg-[#7B1113] text-white shadow-sm'
                  : 'bg-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Deuda
            </button>
          </div>

          {/* 2. DEUDA NOTIFICATION BANNER (When Deuda is selected - Screenshot 5) */}
          {expenseMode === 'deuda' && (
            <div className="bg-[#EBF5FF] border border-[#BEE3F8] rounded-2xl p-3.5 flex items-center gap-3 text-blue-900 animate-fadeIn">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xs sm:text-sm font-medium leading-tight">
                Al finalizar te llevaremos a la sección <span className="font-bold">"Deudas"</span>
              </p>
            </div>
          )}

          {/* 3. FECHA DEL GASTO * */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Fecha del gasto <span className="text-rose-500 font-bold">*</span>
            </label>
            <div 
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-2xl px-4 py-3 flex items-center justify-between cursor-pointer transition-colors shadow-2xs"
            >
              <span className="text-sm font-semibold text-slate-800">
                {formatExpenseDateLabel(expenseDate)}
              </span>
              <Calendar className="w-5 h-5 text-slate-600" />
            </div>

            {/* Quick date dropdown */}
            {isDatePickerOpen && (
              <div className="mt-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-lg space-y-2 animate-fadeIn">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseDate(getLocalDateString());
                      setIsDatePickerOpen(false);
                    }}
                    className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setExpenseDate(d.toISOString().split('T')[0]);
                      setIsDatePickerOpen(false);
                    }}
                    className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl"
                  >
                    Ayer
                  </button>
                </div>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setExpenseDate(e.target.value);
                      setIsDatePickerOpen(false);
                    }
                  }}
                  className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
                />
              </div>
            )}
          </div>

          {/* 4. CATEGORÍA DEL GASTO * */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Categoría del gasto <span className="text-rose-500 font-bold">*</span>
            </label>
            <div
              onClick={() => setIsCategorySheetOpen(true)}
              className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-2xl px-4 py-3 flex items-center justify-between cursor-pointer transition-colors shadow-2xs"
            >
              <span className={`text-sm ${selectedCategory ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                {selectedCategory || 'Selecciona una opción'}
              </span>
              <ChevronDown className="w-5 h-5 text-slate-600" />
            </div>
          </div>

          {/* 5. SPECIAL BANNER: "SELECCIONAR PRODUCTOS" (Screenshot 4 & 5) */}
          {isInventoryCategory && (
            <div 
              onClick={() => setIsProductSelectorOpen(true)}
              className="bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-sm rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-3">
                {/* Visual product icon / illustration */}
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-xl shrink-0">
                  🍎👒👖
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      Seleccionar productos
                    </span>
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center">
                      {selectedProductsList.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                    Al agregar productos se actualizará tu inventario automáticamente
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </div>
          )}

          {/* 5.5 MONEDA Y TASA DE CAMBIO DE LA COMPRA / GASTO */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-2xs">
            {/* Currency switcher: Dólar ($) vs Euro (€) */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Moneda de la compra</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <span className="text-[11px] font-bold text-slate-500">
                {currency === 'USD' ? 'Dólares ($ USD)' : 'Euros (€ EUR)'}
              </span>
            </div>

            {/* Tactile Currency Pills */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setCurrency('USD');
                  if (rateType === 'custom' && !customRateInput) {
                    setRateType('bcv');
                  }
                }}
                className={`py-2 px-3 rounded-lg font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                  $
                </span>
                <span>Dólar ($ USD)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrency('EUR');
                  if (rateType === 'paralelo') {
                    setRateType('bcv');
                  }
                }}
                className={`py-2 px-3 rounded-lg font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  currency === 'EUR'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center font-black text-xs">
                  €
                </span>
                <span>Euro (€ EUR)</span>
              </button>
            </div>

            {/* Exchange Rate selection options */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">
                  Tasa de cambio aplicada:
                </span>
                <span className="text-[11px] font-mono font-black text-emerald-700">
                  1 {currency === 'USD' ? '$' : '€'} = Bs. {activeRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Rate buttons */}
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
                    if (!customRateInput) {
                      setCustomRateInput(activeRate.toString());
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    rateType === 'custom'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                  }`}
                >
                  Personalizada {rateType === 'custom' && customRateInput ? `(${customRateInput})` : ''}
                </button>
              </div>

              {/* Custom rate input field if rateType === 'custom' */}
              {rateType === 'custom' && (
                <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 animate-fadeIn">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
                    Ingresa la tasa acordada (Bs. por cada {currency === 'USD' ? '$' : '€'})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                      Bs.
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={activeRate.toString()}
                      value={customRateInput}
                      onChange={(e) => setCustomRateInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs font-mono font-bold bg-white border border-amber-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-amber-800">
                    Los cálculos en Bolívares y balances se adaptarán exactamente a esta tasa.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 6. VALOR * */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Valor ({currency === 'USD' ? '$ USD' : '€ EUR'}) <span className="text-rose-500 font-bold">*</span>
              </label>
              {isAmountInvalid && (
                <span className="text-xs font-semibold text-rose-600 animate-fadeIn">
                  El valor debe ser mayor a 0
                </span>
              )}
            </div>

            {isInventoryCategory && selectedProductsList.length > 0 ? (
              <div className="py-2">
                <div className="text-2xl font-black text-slate-900 flex items-baseline gap-1">
                  <span className="text-lg text-slate-500">{currency === 'USD' ? '$' : '€'}</span>
                  <span>{totalCalculatedFromProducts.toFixed(2)}</span>
                </div>
                <div className="text-xs text-emerald-600 font-medium mt-0.5">
                  Calculado automáticamente de {totalProductsSelectedCount} unidades seleccionadas
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                  {currency === 'USD' ? '$' : '€'}
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountStr}
                  onFocus={() => setHasInteractedWithAmount(true)}
                  onChange={(e) => {
                    setHasInteractedWithAmount(true);
                    setAmountStr(e.target.value);
                  }}
                  className="w-full pl-8 pr-4 py-2 text-xl font-bold text-slate-900 bg-slate-50/70 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl outline-hidden transition-all"
                />
              </div>
            )}

            {/* Valor total sub-bar */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
              <span className="font-bold text-slate-700">Valor total</span>
              <div className="text-right">
                <span className="text-base font-black text-slate-900">
                  {currency === 'USD' ? '$' : '€'}{numericAmount > 0 ? numericAmount.toFixed(2) : '0'}
                </span>
                {numericAmount > 0 && (
                  <div className="space-y-0.5">
                    <span className="block text-[10px] font-bold text-emerald-700">
                      ≈ Bs. {amountInBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="block text-[9.5px] text-slate-400">
                      ≈ {currency === 'USD' ? '€' : '$'}{secondaryEquivalent.toFixed(2)} {currency === 'USD' ? 'EUR' : 'USD'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 7. PROVEEDOR (or PROVEEDOR * in Deuda mode) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Proveedor {expenseMode === 'deuda' ? <span className="text-rose-500 font-bold">*</span> : ''}
            </label>
            <div
              onClick={() => setIsSupplierSheetOpen(true)}
              className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-2xl px-4 py-3 flex items-center justify-between cursor-pointer transition-colors shadow-2xs"
            >
              <span className={`text-sm ${selectedSupplier ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                {selectedSupplier || 'Escoge tu proveedor'}
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-blue-600 text-amber-300 flex items-center justify-center text-[10px] shadow-2xs">
                  <Crown className="w-3 h-3 fill-amber-300" />
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </div>
            </div>
          </div>

          {/* 8. FECHA LÍMITE (Only when in Deuda mode) */}
          {expenseMode === 'deuda' && (
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Fecha límite de pago (Vencimiento)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 outline-hidden shadow-2xs"
              />
            </div>
          )}

          {/* 9. MÉTODO DE PAGO * (Screenshot 1 & 2 - shown when Pagado) */}
          {expenseMode === 'pagado' && (
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                Método de pago <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {PAYMENT_METHODS.map((pm) => {
                  const isSelected = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`h-24 p-2 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center ${
                        isSelected
                          ? 'border-2 border-[#0B7A5D] bg-[#0B7A5D]/5 shadow-xs'
                          : 'border border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Icons matching the 6 cards */}
                      {pm.iconType === 'cash' && (
                        <div className="w-9 h-6 border-2 border-slate-800 rounded-md flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-800"></div>
                        </div>
                      )}
                      {pm.iconType === 'card' && (
                        <div className="w-9 h-6 border-2 border-slate-800 rounded-md flex flex-col justify-start pt-1 px-1">
                          <div className="w-full h-1 bg-slate-800 rounded-2xs"></div>
                        </div>
                      )}
                      {pm.iconType === 'bank' && (
                        <Landmark className="w-6 h-6 text-slate-800" />
                      )}
                      {pm.iconType === 'binance' && (
                        <div className="w-6 h-6 rounded-md bg-[#F3BA2F] flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-slate-900">
                            <path d="M12 2.5L16.5 7L12 11.5L7.5 7L12 2.5Z M7.5 12L12 16.5L7.5 21L3 16.5L7.5 12Z M16.5 12L21 16.5L16.5 21L12 16.5L16.5 12Z M12 7L16.5 11.5L12 16L7.5 11.5L12 7Z"/>
                          </svg>
                        </div>
                      )}
                      {pm.iconType === 'pagomovil' && (
                        <div className="w-6 h-6 rounded-full border-2 border-slate-800 flex items-center justify-center">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-800" />
                        </div>
                      )}
                      {pm.iconType === 'zelle' && (
                        <div className="w-6 h-6 rounded-md bg-[#7414CA] flex items-center justify-center text-white font-black text-xs">
                          Z
                        </div>
                      )}

                      <span className="text-[11px] font-bold text-slate-800 leading-tight">
                        {pm.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 10. CONCEPTO (Screenshot 2) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Concepto
            </label>
            <input
              type="text"
              placeholder="Dale un nombre a este gasto"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 outline-hidden transition-all placeholder:text-slate-400 shadow-2xs"
            />
          </div>

          <div className="h-6"></div>
        </div>

        {/* BOTTOM FIXED CTA BUTTON: "Crear gasto" */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={handleSaveExpense}
            className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm sm:text-base tracking-wide transition-all shadow-md active:scale-[0.99] cursor-pointer ${
              numericAmount <= 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : expenseMode === 'deuda'
                  ? 'bg-[#7B1113] hover:bg-red-900 text-white shadow-red-900/20'
                  : 'bg-[#0D7A5F] hover:bg-[#0A634D] text-white shadow-emerald-800/20'
            }`}
          >
            Crear gasto
          </button>
        </div>

        {/* --- SUB-MODAL 1: BOTTOM SHEET "Escoge una categoría" (Screenshot 3 & 6) --- */}
        {isCategorySheetOpen && (
          <div className="fixed inset-0 z-60 flex flex-col justify-end sm:items-center sm:justify-center bg-black/50 backdrop-blur-2xs animate-fadeIn">
            <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
              
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Escoge una categoría
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCategorySheetOpen(false)}
                  className="p-1 rounded-full text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Categories list */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-2 py-1">
                {EXPENSE_CATEGORIES.map((cat) => {
                  const IconComponent = cat.icon;
                  const isSelected = selectedCategory === cat.name;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        setIsCategorySheetOpen(false);
                      }}
                      className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <IconComponent className={`w-5 h-5 text-slate-700`} />
                        <span className="text-sm font-medium text-slate-900">
                          {cat.name}
                        </span>
                      </div>

                      {/* Radio button indicator (Screenshot 3 vs 6) */}
                      <div className="w-6 h-6 flex items-center justify-center">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full border-2 border-[#0D7A5F] flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#0D7A5F]"></div>
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-300"></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        )}

        {/* --- SUB-MODAL 2: "SELECCIONAR PRODUCTOS" VIEW (Prompt requirement) --- */}
        {isProductSelectorOpen && (
          <div className="fixed inset-0 z-60 flex flex-col bg-slate-900/60 backdrop-blur-xs sm:items-center sm:justify-center sm:p-4 overflow-y-auto animate-fadeIn">
            <div className="w-full max-w-lg bg-[#F8F9FA] min-h-screen sm:min-h-0 sm:h-[92vh] sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden relative animate-slideUp">
              
              {/* Header in matching amber brand yellow */}
              <div className="bg-amber-400 px-4 py-3.5 flex items-center justify-between text-slate-950 shrink-0 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsProductSelectorOpen(false)}
                    className="p-1 -ml-1 text-slate-950 hover:bg-black/10 rounded-full transition-colors cursor-pointer"
                    title="Volver"
                  >
                    <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                  </button>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-950 tracking-tight">
                      Seleccionar productos
                    </h2>
                    <p className="text-[11px] text-slate-950/80 font-medium">
                      Indica cantidades y costo para actualizar inventario
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProductSelectorOpen(false)}
                  className="p-1.5 rounded-full hover:bg-black/10 text-slate-950 cursor-pointer transition-colors"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search + Action toolbar */}
              <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-white shrink-0">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar producto o categoría..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:border-emerald-500"
                  />
                </div>

                {/* "+ Agregar nuevo producto" button */}
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(true)}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo producto</span>
                </button>
              </div>

              {/* Products list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-50">
                {filteredProducts.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">No hay productos en inventario</p>
                    <p className="text-xs text-slate-400 mt-1">Usa "+ Nuevo producto" para ingresar mercancía que compraste.</p>
                  </div>
                ) : (
                  filteredProducts.map((prod) => {
                    const qty = selectedProductQuantities[prod.id] || 0;
                    const isSelected = qty > 0;
                    const unitCost = productUnitCosts[prod.id] !== undefined ? productUnitCosts[prod.id] : (prod.cost || prod.price || 0);

                    return (
                      <div
                        key={prod.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/20 shadow-2xs'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 leading-snug">
                              {prod.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-600">
                                {prod.category || 'General'}
                              </span>
                              <span>Stock actual: <strong className="text-slate-700">{prod.stock}</strong></span>
                            </div>
                          </div>

                          {/* Stepper */}
                          <div className="flex items-center gap-2 shrink-0">
                            {qty > 0 ? (
                              <div className="flex items-center border border-slate-200 bg-white rounded-xl shadow-2xs p-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleDecreaseQty(prod.id)}
                                  className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-8 text-center text-xs font-black text-slate-900">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleIncreaseQty(prod)}
                                  className="w-7 h-7 flex items-center justify-center text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleIncreaseQty(prod)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Agregar</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* If selected: show unit cost adjustment input */}
                        {isSelected && (
                          <div className="mt-3 pt-2.5 border-t border-emerald-100/60 flex items-center justify-between text-xs animate-fadeIn">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-600 font-medium">Costo de compra unitario:</span>
                              <div className="flex items-center border border-slate-200 bg-white rounded-lg px-2 py-1 w-24">
                                <span className="text-slate-400 font-bold mr-1">{currency === 'USD' ? '$' : '€'}</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={unitCost || ''}
                                  onChange={(e) => handleUpdateUnitCost(prod.id, parseFloat(e.target.value) || 0)}
                                  className="w-full text-xs font-bold text-slate-900 outline-hidden"
                                />
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 text-[10px] block">Subtotal</span>
                              <span className="font-black text-emerald-800 text-xs">
                                {currency === 'USD' ? '$' : '€'}{(qty * unitCost).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom footer: Total + Confirm */}
              <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <span className="text-xs text-slate-500 font-medium block">
                    {totalProductsSelectedCount} unid. en {selectedProductsList.length} productos
                  </span>
                  <span className="text-lg font-black text-slate-900">
                    {currency === 'USD' ? '$' : '€'}{totalCalculatedFromProducts.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProductSelectorOpen(false)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-xs cursor-pointer transition-all"
                >
                  Confirmar productos
                </button>
              </div>

            </div>
          </div>
        )}

        {/* --- SUB-MODAL 3: INLINE "+ AGREGAR NUEVO PRODUCTO QUE INGRESÓ" --- */}
        {isNewProductModalOpen && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-fadeIn">
            <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto animate-slideUp">
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Package className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Nuevo producto que ingresó
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {newProdError && (
                <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                  {newProdError}
                </div>
              )}

              <form onSubmit={handleCreateNewProductSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre del producto <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Harina PAN 1kg, Aceite Diana..."
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Categoría
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Alimentos, Bebidas"
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cantidad comprada <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="1"
                      value={newProdQuantity}
                      onChange={(e) => setNewProdQuantity(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Costo unitario ({currency === 'USD' ? '$' : '€'}) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="0.00"
                      value={newProdCost}
                      onChange={(e) => setNewProdCost(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Precio de venta ({currency === 'USD' ? '$' : '€'})
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Sugerido"
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl outline-hidden"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Este producto se agregará al inventario y se incluirá automáticamente en este gasto.
                </p>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewProductModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    Guardar e incluir
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* --- SUB-MODAL 4: SUPPLIER SELECTION SHEET (Screenshot 1, 2, 4) --- */}
        {isSupplierSheetOpen && (
          <div className="fixed inset-0 z-60 flex flex-col justify-end sm:items-center sm:justify-center bg-black/50 backdrop-blur-2xs animate-fadeIn">
            <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
              
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-amber-300 flex items-center justify-center text-[10px]">
                    <Crown className="w-3 h-3 fill-amber-300" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Escoge tu proveedor
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSupplierSheetOpen(false)}
                  className="p-1 rounded-full text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Fast new supplier addition */}
              <div className="p-3 border-b border-slate-100 bg-slate-50 flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre de proveedor o distribuidor..."
                  value={newSupplierInput}
                  onChange={(e) => setNewSupplierInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSelectOrAddSupplier(newSupplierInput);
                    }
                  }}
                  className="flex-1 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl outline-hidden focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleSelectOrAddSupplier(newSupplierInput)}
                  disabled={!newSupplierInput.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Guardar
                </button>
              </div>

              {/* Suppliers List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
                {filteredSuppliers.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    <p className="text-xs font-medium">Escribe arriba para registrar tu primer proveedor.</p>
                  </div>
                ) : (
                  filteredSuppliers.map((s) => {
                    const isSelected = selectedSupplier.toLowerCase() === s.name.toLowerCase();
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleSelectOrAddSupplier(s.name)}
                        className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/70 text-blue-900' : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div>
                          <span className="text-sm font-bold block">{s.name}</span>
                          {s.phone && <span className="text-[11px] text-slate-400">{s.phone}</span>}
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
