import React, { useState, useMemo } from 'react';
import { 
  Download, Plus, Search, Tag, Eye, Info, Trash2, Edit2, 
  Check, ChevronDown, Sliders, Box, AlertTriangle, Crown, Sparkles, 
  TrendingUp, ArrowRight, Package, DollarSign, RefreshCw, X, ShoppingBag,
  Receipt, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem, ExchangeRates, FinancialRecord, ProductCurrency } from '../types';
import { formatMoney, CurrencyCode, formatRecordDisplay, convertAmount, getProductProfitMetrics, getCurrencySymbol, getCurrencyLabel } from '../utils/currency';
import { isForbiddenCategory } from '../utils/categoryUtils';

interface TabInventarioProps {
  inventory: InventoryItem[];
  records?: FinancialRecord[];
  onDeleteRecord?: (id: string, options?: { revertInventory?: boolean }) => void;
  onAddProduct: (item: Omit<InventoryItem, 'id'>) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateProductStock: (id: string, newStock: number) => void;
  onUpdateProductDetails: (id: string, updatedFields: Partial<InventoryItem>) => void;
  onOpenCreateModal: () => void;
  onOpenExpense?: () => void;
  onSellProduct?: (item: InventoryItem) => void;
  rates: ExchangeRates;
  selectedCurrency?: CurrencyCode;
  userEmail?: string;
}

export default function TabInventario({
  inventory,
  records = [],
  onDeleteRecord,
  onAddProduct,
  onDeleteProduct,
  onUpdateProductStock,
  onUpdateProductDetails,
  onOpenCreateModal,
  onOpenExpense,
  onSellProduct,
  rates,
  selectedCurrency = 'USD',
  userEmail
}: TabInventarioProps) {
  const [filterType, setFilterType] = useState<'todas' | 'stock_bajo' | 'agotados'>('todas');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Inline editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState<number>(0);
  const [editCost, setEditCost] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCostCurrency, setEditCostCurrency] = useState<ProductCurrency>('USD');
  const [editPriceCurrency, setEditPriceCurrency] = useState<ProductCurrency>('USD');
  
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Purchase history & deletion modal states
  const [showPurchasesHistoryModal, setShowPurchasesHistoryModal] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<FinancialRecord | null>(null);
  const [revertStockOnPurchaseDelete, setRevertStockOnPurchaseDelete] = useState(true);

  // Purchases records affecting inventory
  const purchaseRecords = useMemo(() => {
    return records
      .filter(r => 
        r.type === 'egreso' && (
          (r.purchasedItems && r.purchasedItems.length > 0) ||
          r.category === 'Compra de productos e insumos' ||
          r.category === 'Inventario'
        )
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records]);

  // Read available categories dynamically from inventory + user categories (0 hardcoded)
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    try {
      const saved = localStorage.getItem(`gt_user_categories_${userEmail || 'guest'}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach(c => {
            if (c && typeof c === 'string' && !isForbiddenCategory(c)) {
              cats.add(c.trim());
            }
          });
        }
      }
    } catch (e) {}

    inventory.forEach(item => {
      if (item.category && !isForbiddenCategory(item.category)) {
        cats.add(item.category.trim());
      }
    });

    return Array.from(cats);
  }, [inventory, userEmail]);

  // Low stock counter (items with stock > 0 but <= 3)
  const lowStockProducts = useMemo(() => inventory.filter(item => item.stock > 0 && item.stock <= 3), [inventory]);
  // Depleted counter (items with stock === 0)
  const depletedProducts = useMemo(() => inventory.filter(item => item.stock === 0), [inventory]);

  // Filters logic: filter by search term, stock tab and category
  const filteredProducts = useMemo(() => {
    return inventory.filter(item => {
      // 1. Search term match
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // 2. Tab filter match
      let matchesTab = true;
      if (filterType === 'stock_bajo') {
        matchesTab = item.stock > 0 && item.stock <= 3;
      } else if (filterType === 'agotados') {
        matchesTab = item.stock === 0;
      }

      // 3. Category match
      let matchesCategory = true;
      if (selectedCategory !== 'todas') {
        matchesCategory = (item.category || '').toLowerCase() === selectedCategory.toLowerCase();
      }

      return matchesSearch && matchesTab && matchesCategory;
    });
  }, [inventory, searchTerm, filterType, selectedCategory]);

  const bcvUsd = rates?.bcvUsd && rates.bcvUsd > 0 ? rates.bcvUsd : 832.49;
  const bcvEur = rates?.bcvEur && rates.bcvEur > 0 ? rates.bcvEur : 968.07;

  // Calculate totals normalized into selectedCurrency
  const { totalCostValue, totalRetailPriceValue, totalUnitsInStock, totalProfitPotential } = useMemo(() => {
    let costSum = 0;
    let priceSum = 0;
    let units = 0;

    inventory.forEach(item => {
      const stock = item.stock || 0;
      units += stock;
      const costCur = item.costCurrency || item.currency || 'USD';
      const priceCur = item.priceCurrency || item.currency || 'USD';

      const unitCostNorm = convertAmount(item.cost, costCur, selectedCurrency, rates);
      const unitPriceNorm = convertAmount(item.price, priceCur, selectedCurrency, rates);

      costSum += unitCostNorm * stock;
      priceSum += unitPriceNorm * stock;
    });

    return {
      totalCostValue: costSum,
      totalRetailPriceValue: priceSum,
      totalUnitsInStock: units,
      totalProfitPotential: priceSum - costSum
    };
  }, [inventory, selectedCurrency, rates]);

  const retailMoney = useMemo(() => formatMoney(totalRetailPriceValue, selectedCurrency, rates), [totalRetailPriceValue, selectedCurrency, rates]);
  const costMoney = useMemo(() => formatMoney(totalCostValue, selectedCurrency, rates), [totalCostValue, selectedCurrency, rates]);
  const profitMoney = useMemo(() => formatMoney(totalProfitPotential, selectedCurrency, rates), [totalProfitPotential, selectedCurrency, rates]);

  const startEditing = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setEditStock(item.stock);
    setEditCost(item.cost);
    setEditPrice(item.price);
    setEditCostCurrency(item.costCurrency || item.currency || 'USD');
    setEditPriceCurrency(item.priceCurrency || item.currency || 'USD');
  };

  const saveProductEdits = (itemId: string) => {
    const calculatedStatus = editStock > 0 ? 'disponible' : 'no_disponible';
    onUpdateProductDetails(itemId, {
      stock: editStock,
      cost: editCost,
      price: editPrice,
      costCurrency: editCostCurrency,
      priceCurrency: editPriceCurrency,
      currency: editPriceCurrency === 'EUR' ? 'EUR' : 'USD',
      status: calculatedStatus
    });
    setEditingItemId(null);
    triggerNotification('Detalles actualizados correctamente.');
  };

  const adjustStockInline = (itemId: string, currentStock: number, delta: number) => {
    const nextStock = Math.max(0, currentStock + delta);
    onUpdateProductStock(itemId, nextStock);
    triggerNotification(`Cantidad modificada a: ${nextStock}`);
  };

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  const triggerPDFDownload = () => {
    const headers = 'Producto,Categoría,Costo (USD),Precio (USD),Existencia,Valor Costo (USD),Estatus\n';
    const rows = inventory.map(item => {
      const itemVal = item.cost * item.stock;
      return `"${item.name}","${item.category || 'General'}",$${item.cost.toFixed(2)},$${item.price.toFixed(2)},${item.stock},$${itemVal.toFixed(2)},"${item.stock > 0 ? 'FIJO':'AGOTADO'}"`;
    }).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reporte_Inventario_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    triggerNotification('¡Reporte CSV exportado con éxito!');
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- TREINTA STYLE HERO HEADER & INVENTORY SUMMARY CARDS --- */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-950 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">Inventario</h2>
              <p className="text-[11px] text-slate-400 font-medium">Control de existencias y márgenes comerciales</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={triggerPDFDownload}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Descargar reporte en CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPurchasesHistoryModal(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer relative"
              title="Ver compras y entradas registradas para el inventario"
            >
              <Receipt className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Historial Compras</span>
              <span className="sm:hidden">Compras</span>
              {purchaseRecords.length > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[9px] font-black">
                  {purchaseRecords.length}
                </span>
              )}
            </button>

            {onOpenExpense && (
              <button
                type="button"
                onClick={onOpenExpense}
                className="px-2.5 sm:px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                title="Registrar una compra o reabastecimiento de stock"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden sm:inline">Registrar Compra</span>
                <span className="sm:hidden">Comprar</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenCreateModal}
              className="px-3 sm:px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Producto</span>
            </button>
          </div>
        </div>

        {/* 3-Column Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Card 1: Total Inventory Retail Value */}
          <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Valor en Venta (PVP)
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {retailMoney.primary}
            </div>
            <div className="text-[10.5px] font-bold text-slate-500 font-mono mt-0.5">
              {retailMoney.bolivares}
            </div>
          </div>

          {/* Card 2: Total Cost & Units */}
          <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Costo Invertido ({totalUnitsInStock} u)
            </span>
            <div className="text-xl font-black text-slate-700 font-mono mt-0.5">
              {costMoney.primary}
            </div>
            <div className="text-[10.5px] font-bold text-slate-500 font-mono mt-0.5">
              {costMoney.bolivares}
            </div>
          </div>

          {/* Card 3: Estimated Profit */}
          <div className="bg-emerald-50/60 border border-emerald-200/60 p-3.5 rounded-2xl">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              Ganancia Estimada
            </span>
            <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
              {profitMoney.primary}
            </div>
            <div className="text-[10.5px] font-bold text-emerald-600 font-mono mt-0.5">
              {profitMoney.bolivares}
            </div>
          </div>
        </div>
      </div>

      {/* --- LOW STOCK ALERT BANNER --- */}
      {(lowStockProducts.length > 0 || depletedProducts.length > 0) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-50 text-amber-900 border border-amber-200/80 p-4 rounded-3xl flex items-start gap-3 shadow-xs text-xs leading-relaxed"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-200/80 flex items-center justify-center shrink-0 mt-0.5 text-amber-900">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div className="flex-grow">
            <span className="font-black text-amber-950 block text-xs">Alerta de Existencias</span>
            <p className="mt-0.5 text-slate-700 text-[11px]">
              Tienes <strong className="text-amber-950 font-black">{depletedProducts.length} agotados</strong> y{' '}
              <strong className="text-amber-950 font-black">{lowStockProducts.length} productos en stock bajo</strong> (≤ 3 unidades).
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={() => setFilterType('stock_bajo')}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3 py-1 rounded-xl text-[10.5px] transition-colors cursor-pointer"
              >
                Ver Stock Crítico ({lowStockProducts.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('agotados')}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1 rounded-xl text-[10.5px] transition-colors cursor-pointer"
              >
                Ver Agotados ({depletedProducts.length})
              </button>
              {filterType !== 'todas' && (
                <button
                  type="button"
                  onClick={() => setFilterType('todas')}
                  className="text-slate-500 hover:text-slate-800 font-bold text-[10px] px-2 self-center cursor-pointer"
                >
                  Restablecer
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* --- SEARCH AND STOCK FILTERS BAR --- */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre de producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all font-semibold"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Type Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'todas', label: `Todos (${inventory.length})` },
            { id: 'stock_bajo', label: `Stock Bajo (${lowStockProducts.length})` },
            { id: 'agotados', label: `Agotados (${depletedProducts.length})` }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterType(f.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filterType === f.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Dynamic Category Chips (only shown if user has registered categories) */}
        {availableCategories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0">Categoría:</span>
            <button
              type="button"
              onClick={() => setSelectedCategory('todas')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'todas'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            {availableCategories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* --- PRODUCT CARDS (RESPONSIVE GRID FOR PC & MOBILE) --- */}
      <div>
        {filteredProducts.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">
                {inventory.length === 0 ? 'Tu inventario comienza en cero' : 'No se encontraron productos con ese filtro'}
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {inventory.length === 0 
                  ? 'Registra tus productos y crea tus propias categorías adaptadas a lo que venda tu negocio.'
                  : 'Prueba buscando otro nombre o seleccionando otra categoría.'}
              </p>
            </div>
            {inventory.length === 0 && (
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="mt-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar mi primer producto</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredProducts.map((item) => {
              const metrics = getProductProfitMetrics(item, rates, selectedCurrency);
              const isEditing = editingItemId === item.id;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white border rounded-3xl p-4 flex flex-col justify-between transition-all duration-200 ${
                    isEditing 
                      ? 'border-blue-500 ring-2 ring-blue-100 shadow-md' 
                      : item.stock === 0 
                        ? 'border-rose-200 bg-rose-50/10'
                        : 'border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  {/* Top card header: Name, badge, actions */}
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border uppercase tracking-wider shrink-0 ${
                          item.stock === 0
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : item.stock <= 3
                              ? 'bg-amber-100 text-amber-900 border-amber-200'
                              : 'bg-slate-100 text-slate-800 border-slate-200'
                        }`}>
                          {item.name.substring(0, 2)}
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-slate-900 truncate">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[9px] uppercase tracking-wide bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                              {item.category || 'General'}
                            </span>
                            {metrics.hasMixedCurrencies ? (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-200/60" title={`Costo: ${metrics.costCur} | Venta: ${metrics.priceCur}`}>
                                {metrics.costCur} ➔ {metrics.priceCur}
                              </span>
                            ) : (
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                metrics.priceCur === 'EUR' ? 'bg-blue-100 text-blue-800' : metrics.priceCur === 'VES' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {getCurrencySymbol(metrics.priceCur)} {metrics.priceCur}
                              </span>
                            )}
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                              item.stock === 0
                                ? 'bg-rose-100 text-rose-800'
                                : item.stock <= 3
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {item.stock === 0 ? 'Agotado' : `${item.stock} disponibles`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Header controls: Info, Edit, Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                          title="Editar producto y moneda"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveInfoId(activeInfoId === item.id ? null : item.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                          title="Detalles"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProduct(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable details calculation */}
                    <AnimatePresence>
                      {activeInfoId === item.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 mt-3 text-[11px] text-slate-600 space-y-2.5 font-mono"
                        >
                          {(() => {
                            return (
                              <div className="space-y-1">
                                <p className="font-bold text-[9px] uppercase text-slate-400 tracking-wider font-sans">Métricas de Costo y Venta:</p>
                                <p>• Costo adquisición: <strong className="text-slate-900">{getCurrencySymbol(metrics.costCur)}{item.cost.toFixed(2)} {metrics.costCur}</strong> (Bs. {metrics.costInBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
                                <p>• Precio venta (PVP): <strong className="text-slate-900">{getCurrencySymbol(metrics.priceCur)}{item.price.toFixed(2)} {metrics.priceCur}</strong> (Bs. {metrics.priceInBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
                                <p>• Inversión total en stock: <strong className="text-slate-900">{getCurrencySymbol(metrics.costCur)}{(item.cost * item.stock).toFixed(2)} {metrics.costCur}</strong> (Bs. {(metrics.costInBs * item.stock).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
                                <p>• Retorno bruto estimado: <strong className="text-slate-900">{getCurrencySymbol(metrics.priceCur)}{(item.price * item.stock).toFixed(2)} {metrics.priceCur}</strong> (Bs. {(metrics.priceInBs * item.stock).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
                                <p>• Utilidad unitaria: <strong className={metrics.unitProfitInPriceCur >= 0 ? "text-emerald-700" : "text-rose-600"}>
                                  {metrics.unitProfitInPriceCur >= 0 ? '+' : ''}{getCurrencySymbol(metrics.priceCur)}{metrics.unitProfitInPriceCur.toFixed(2)} {metrics.priceCur} ({metrics.profitMarginPct.toFixed(1)}%)
                                </strong></p>
                              </div>
                            );
                          })()}

                          {/* Compras registradas de este producto */}
                          {(() => {
                            const itemPurchases = (records || []).filter(r => 
                              r.type === 'egreso' && r.purchasedItems?.some(pi => pi.productId === item.id)
                            );
                            if (itemPurchases.length === 0) return null;

                            return (
                              <div className="pt-2 border-t border-slate-200/80 font-sans space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase text-amber-900 flex items-center gap-1">
                                    <Package className="w-3 h-3 text-amber-600" />
                                    Compras asociadas a este producto:
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-semibold">{itemPurchases.length}</span>
                                </div>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                  {itemPurchases.map(pr => {
                                    const purchasedDetail = pr.purchasedItems?.find(pi => pi.productId === item.id);
                                    return (
                                      <div key={pr.id} className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                                        <div className="min-w-0 pr-2">
                                          <p className="font-bold text-slate-800 text-[11px] truncate">{pr.description}</p>
                                          <p className="text-[10px] text-slate-400 font-mono">
                                            {pr.date} • +{purchasedDetail?.quantity || 1} un. • ${pr.amount} {pr.currency || 'USD'}
                                          </p>
                                        </div>
                                        {onDeleteRecord && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setPurchaseToDelete(pr);
                                              setRevertStockOnPurchaseDelete(true);
                                            }}
                                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-rose-200 transition-all cursor-pointer shrink-0"
                                            title="Borrar esta compra y revertir stock"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                            <span>Borrar compra</span>
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Margin summary pill */}
                    <div className="mt-3 bg-slate-50 border border-slate-200/60 p-2 rounded-2xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-bold text-[10px] uppercase">Margen:</span>
                        {metrics.hasMixedCurrencies && (
                          <span className="text-[9px] text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded font-black tracking-tight" title="Costo y venta en diferentes monedas con conversión automática">
                            Mixto
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono font-bold ${metrics.unitProfitInPriceCur >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                          {metrics.unitProfitInPriceCur >= 0 ? '+' : ''}{getCurrencySymbol(metrics.priceCur)}{metrics.unitProfitInPriceCur.toFixed(2)} {metrics.priceCur}
                        </span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                          metrics.profitMarginPct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {metrics.profitMarginPct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card bottom: Prices and stock controls */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100">
                    {isEditing ? (
                      /* Inline editor with independent cost and price currency selection */
                      <div className="space-y-2.5 text-xs bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                        {/* Currency selectors */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[8px] text-slate-500 uppercase font-black mb-1">Moneda Costo</label>
                            <div className="grid grid-cols-3 gap-0.5 bg-slate-200/70 p-0.5 rounded-lg">
                              {(['USD', 'EUR', 'VES'] as ProductCurrency[]).map(cur => (
                                <button
                                  key={`cost-${cur}`}
                                  type="button"
                                  onClick={() => setEditCostCurrency(cur)}
                                  className={`py-1 text-center rounded-md font-bold text-[9px] transition-all cursor-pointer ${
                                    editCostCurrency === cur ? 'bg-white shadow-xs text-slate-900 font-black' : 'text-slate-600'
                                  }`}
                                >
                                  {cur === 'VES' ? 'Bs' : cur}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[8px] text-slate-500 uppercase font-black mb-1">Moneda Venta</label>
                            <div className="grid grid-cols-3 gap-0.5 bg-slate-200/70 p-0.5 rounded-lg">
                              {(['USD', 'EUR', 'VES'] as ProductCurrency[]).map(cur => (
                                <button
                                  key={`price-${cur}`}
                                  type="button"
                                  onClick={() => setEditPriceCurrency(cur)}
                                  className={`py-1 text-center rounded-md font-bold text-[9px] transition-all cursor-pointer ${
                                    editPriceCurrency === cur ? 'bg-white shadow-xs text-slate-900 font-black' : 'text-slate-600'
                                  }`}
                                >
                                  {cur === 'VES' ? 'Bs' : cur}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <label className="block text-[8px] text-slate-400 uppercase font-black mb-1">Stock</label>
                            <input
                              type="number"
                              min="0"
                              value={editStock}
                              onChange={(e) => setEditStock(parseInt(e.target.value) || 0)}
                              className="w-full text-center py-1 font-mono font-bold bg-white rounded-xl border border-slate-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[8px] text-slate-400 uppercase font-black mb-1">
                              Costo ({getCurrencySymbol(editCostCurrency)})
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={editCost}
                              onChange={(e) => setEditCost(parseFloat(e.target.value) || 0)}
                              className="w-full text-center py-1 font-mono font-bold bg-white rounded-xl border border-slate-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[8px] text-slate-400 uppercase font-black mb-1">
                              Precio ({getCurrencySymbol(editPriceCurrency)})
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={editPrice}
                              onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                              className="w-full text-center py-1 font-mono font-bold bg-white rounded-xl border border-slate-200 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Live margin in inline editor */}
                        {(() => {
                          const costInPriceCur = convertAmount(editCost, editCostCurrency, editPriceCurrency, rates);
                          const netProfit = editPrice - costInPriceCur;
                          const pct = editPrice > 0 ? (netProfit / editPrice) * 100 : 0;
                          return (
                            <div className="flex items-center justify-between text-[9.5px] px-1 font-mono text-slate-600">
                              <span>Margen estimado:</span>
                              <span className={netProfit >= 0 ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
                                {netProfit >= 0 ? '+' : ''}{getCurrencySymbol(editPriceCurrency)}{netProfit.toFixed(2)} {editPriceCurrency} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                          );
                        })()}

                        <div className="flex gap-1.5 justify-end mt-2 pt-1 border-t border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-[11px] cursor-pointer border border-slate-200"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => saveProductEdits(item.id)}
                            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Guardar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display prices in product currency and fast + / - stepper */
                      <div className="flex items-center justify-between">
                        <div>
                          {(() => {
                            const priceCur = item.priceCurrency || item.currency || 'USD';
                            const costCur = item.costCurrency || item.currency || 'USD';
                            const priceSym = getCurrencySymbol(priceCur);
                            const costSym = getCurrencySymbol(costCur);
                            const priceBs = convertAmount(item.price, priceCur, 'VES', rates);
                            return (
                              <>
                                <div className="text-base font-black text-slate-900 font-mono">
                                  {priceSym}{item.price.toFixed(2)} <span className="text-[10px] text-slate-500 font-bold">{priceCur}</span>
                                </div>
                                <div className="text-[10.5px] font-bold text-slate-500 font-mono">
                                  Bs. {priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                {costCur !== priceCur && (
                                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                    Costo: {costSym}{item.cost.toFixed(2)} {costCur}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* Stock Stepper */}
                        <div className="flex items-center gap-1">
                          <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200/60 p-0.5">
                            <button
                              type="button"
                              onClick={() => adjustStockInline(item.id, item.stock, -1)}
                              className="w-7 h-7 flex items-center justify-center text-xs font-black text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer active:scale-95"
                              title="Restar 1 unidad"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-mono font-black text-slate-900 text-xs">
                              {item.stock}
                            </span>
                            <button
                              type="button"
                              onClick={() => adjustStockInline(item.id, item.stock, 1)}
                              className="w-7 h-7 flex items-center justify-center text-xs font-black text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer active:scale-95"
                              title="Sumar 1 unidad"
                            >
                              +
                            </button>
                          </div>

                          {onSellProduct && (
                            <button
                              type="button"
                              onClick={() => onSellProduct(item)}
                              disabled={item.stock <= 0}
                              className={`px-2.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 cursor-pointer transition-all ${
                                item.stock > 0 
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95' 
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              }`}
                              title={item.stock > 0 ? 'Registrar venta de este producto' : 'Sin stock disponible'}
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Vender</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80 rounded-xl cursor-pointer"
                            title="Editar costo y precio"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- DOCKED BOTTOM QUICK ACTION --- */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onOpenCreateModal}
          className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer border border-amber-300"
        >
          <Plus className="w-5 h-5 text-slate-950" />
          Registrar Producto
        </button>
      </div>

      {/* MODAL: HISTORIAL DE COMPRAS DE MERCANCÍA */}
      {showPurchasesHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                    Historial de Compras de Mercancía
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Consulta o elimina compras para restaurar tu inventario automáticamente
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPurchasesHistoryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Listado de compras */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {purchaseRecords.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">No hay compras de mercancía registradas</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Cuando registres un egreso en la categoría "Compra de productos e insumos", aparecerá aquí.
                    </p>
                  </div>
                  {onOpenExpense && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowPurchasesHistoryModal(false);
                        onOpenExpense();
                      }}
                      className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Registrar una compra ahora</span>
                    </button>
                  )}
                </div>
              ) : (
                purchaseRecords.map(pr => {
                  const disp = formatRecordDisplay(pr, selectedCurrency, rates);
                  const hasPurchasedItems = pr.purchasedItems && pr.purchasedItems.length > 0;

                  return (
                    <div
                      key={pr.id}
                      className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5 transition-all hover:border-slate-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{pr.description}</p>
                          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 mt-0.5 flex-wrap">
                            <span className="font-mono">{pr.date}</span>
                            <span>•</span>
                            <span className="font-semibold uppercase text-slate-600 bg-slate-200/70 px-1.5 py-0.2 rounded text-[9.5px]">
                              {pr.paymentMethod}
                            </span>
                            <span>•</span>
                            <span>{pr.category || 'Compra de productos'}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-black font-sans text-rose-600">
                            {disp.originalText}
                          </span>
                          <span className="block text-[10px] font-mono text-slate-400 font-semibold">
                            {disp.bolivares}
                          </span>
                        </div>
                      </div>

                      {/* Productos añadidos al inventario */}
                      {hasPurchasedItems && (
                        <div className="bg-white rounded-xl p-2.5 border border-slate-200/70 space-y-1.5">
                          <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide block">
                            Productos ingresados a inventario:
                          </span>
                          <div className="space-y-1">
                            {pr.purchasedItems!.map(pi => {
                              const currentProd = inventory.find(i => i.id === pi.productId);
                              const currentStock = currentProd?.stock ?? 0;
                              const finalStock = Math.max(0, currentStock - pi.quantity);

                              return (
                                <div key={pi.productId} className="flex items-center justify-between text-xs text-slate-700">
                                  <span className="font-medium">• {pi.name} (+{pi.quantity} un.)</span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    Stock actual: <strong>{currentStock}</strong> ➔ Si borras: <strong className="text-rose-600">{finalStock}</strong>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Botón de borrar compra */}
                      {onDeleteRecord && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPurchaseToDelete(pr);
                              setRevertStockOnPurchaseDelete(true);
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                            title="Eliminar esta compra y revertir el inventario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Borrar compra {hasPurchasedItems ? '(revertir stock)' : ''}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPurchasesHistoryModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: CONFIRMACIÓN DE BORRADO DE COMPRA CON REVERSIÓN DE INVENTARIO */}
      {purchaseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                    ¿Eliminar esta compra de mercancía?
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Se anulará el gasto contable y se restará el stock añadido
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPurchaseToDelete(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resumen de la compra */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 line-clamp-1">
                  {purchaseToDelete.description}
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                  Compra / Egreso
                </span>
              </div>

              <div className="flex items-baseline justify-between border-t border-slate-200/60 pt-2">
                <span className="text-[11px] text-slate-500 font-medium">Monto del egreso:</span>
                <div className="text-right">
                  <span className="text-base font-black font-sans text-rose-600">
                    {formatRecordDisplay(purchaseToDelete, selectedCurrency, rates).originalText}
                  </span>
                  <span className="block text-[10px] font-mono text-slate-400 font-semibold">
                    {formatRecordDisplay(purchaseToDelete, selectedCurrency, rates).bolivares}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Fecha: <strong>{purchaseToDelete.date}</strong></span>
                <span>Pago: <strong className="uppercase">{purchaseToDelete.paymentMethod}</strong></span>
              </div>
            </div>

            {/* IMPACTO EN INVENTARIO */}
            {purchaseToDelete.purchasedItems && purchaseToDelete.purchasedItems.length > 0 ? (
              <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-3.5 space-y-2 text-left">
                <div className="flex items-center gap-2 text-amber-950 font-black text-xs">
                  <Package className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Reversión automática de inventario</span>
                </div>
                <p className="text-[11px] text-amber-900 leading-snug">
                  Al borrar esta compra, el stock volverá automáticamente a como estaba antes de registrarla:
                </p>
                <div className="space-y-1.5 pt-1 border-t border-amber-200/60">
                  {purchaseToDelete.purchasedItems.map(pi => {
                    const currentProd = inventory.find(p => p.id === pi.productId);
                    const currentStock = currentProd?.stock ?? 0;
                    const finalStock = Math.max(0, currentStock - pi.quantity);
                    return (
                      <div key={pi.productId} className="flex items-center justify-between bg-white/90 px-2.5 py-1.5 rounded-xl text-xs border border-amber-200/60">
                        <span className="font-bold text-slate-800">{pi.name}</span>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-600">
                            {currentStock} en stock ➔ <strong className="text-rose-600 font-black">{finalStock}</strong>
                          </span>
                          <span className="ml-1.5 text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                            -{pi.quantity}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                Esta compra no tenía productos específicos vinculados. Se eliminará el registro del balance y reportes.
              </p>
            )}

            {/* Checkbox opcional de reversión si hay items asociados */}
            {purchaseToDelete.purchasedItems && purchaseToDelete.purchasedItems.length > 0 && (
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={revertStockOnPurchaseDelete}
                  onChange={(e) => setRevertStockOnPurchaseDelete(e.target.checked)}
                  className="w-4 h-4 rounded-md text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                />
                <span>Revertir cantidades en el inventario automáticamente</span>
              </label>
            )}

            {/* Acciones */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPurchaseToDelete(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRecord?.(purchaseToDelete.id, { revertInventory: revertStockOnPurchaseDelete });
                  setPurchaseToDelete(null);
                  setNotification('Compra eliminada y stock revertido.');
                }}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-200 hover:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, borrar compra</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
