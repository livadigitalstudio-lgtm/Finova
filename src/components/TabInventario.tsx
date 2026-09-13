import React, { useState, useMemo } from 'react';
import { 
  Download, Plus, Search, Tag, Eye, Info, Trash2, Edit2, 
  Check, ChevronDown, Sliders, Box, AlertTriangle, Crown, Sparkles, 
  TrendingUp, ArrowRight, Package, DollarSign, RefreshCw, X, ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem, ExchangeRates } from '../types';
import { formatMoney, CurrencyCode } from '../utils/currency';
import { isForbiddenCategory } from '../utils/categoryUtils';

interface TabInventarioProps {
  inventory: InventoryItem[];
  onAddProduct: (item: Omit<InventoryItem, 'id'>) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateProductStock: (id: string, newStock: number) => void;
  onUpdateProductDetails: (id: string, updatedFields: Partial<InventoryItem>) => void;
  onOpenCreateModal: () => void;
  onSellProduct?: (item: InventoryItem) => void;
  rates: ExchangeRates;
  selectedCurrency?: CurrencyCode;
  userEmail?: string;
}

export default function TabInventario({
  inventory,
  onAddProduct,
  onDeleteProduct,
  onUpdateProductStock,
  onUpdateProductDetails,
  onOpenCreateModal,
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
  
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

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

  // Calculate totals
  const totalCostValue = useMemo(() => inventory.reduce((sum, item) => sum + (item.cost * (item.stock || 0)), 0), [inventory]);
  const totalRetailPriceValue = useMemo(() => inventory.reduce((sum, item) => sum + (item.price * (item.stock || 0)), 0), [inventory]);
  const totalUnitsInStock = useMemo(() => inventory.reduce((sum, item) => sum + (item.stock || 0), 0), [inventory]);
  const totalProfitPotential = totalRetailPriceValue - totalCostValue;

  const retailMoney = useMemo(() => formatMoney(totalRetailPriceValue, selectedCurrency, rates), [totalRetailPriceValue, selectedCurrency, rates]);
  const costMoney = useMemo(() => formatMoney(totalCostValue, selectedCurrency, rates), [totalCostValue, selectedCurrency, rates]);
  const profitMoney = useMemo(() => formatMoney(totalProfitPotential, selectedCurrency, rates), [totalProfitPotential, selectedCurrency, rates]);

  const startEditing = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setEditStock(item.stock);
    setEditCost(item.cost);
    setEditPrice(item.price);
  };

  const saveProductEdits = (itemId: string) => {
    const calculatedStatus = editStock > 0 ? 'disponible' : 'no_disponible';
    onUpdateProductDetails(itemId, {
      stock: editStock,
      cost: editCost,
      price: editPrice,
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerPDFDownload}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Descargar reporte en CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreateModal}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
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
              const profitValue = item.price - item.cost;
              const profitPct = item.cost > 0 ? (profitValue / item.cost) * 100 : 0;
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
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] uppercase tracking-wide bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                              {item.category || 'General'}
                            </span>
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

                      {/* Header controls: Info, Delete */}
                      <div className="flex items-center gap-1 shrink-0">
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
                          className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 mt-3 text-[11px] text-slate-600 space-y-1 font-mono"
                        >
                          <p className="font-bold text-[9px] uppercase text-slate-400 tracking-wider">Métricas del Producto:</p>
                          <p>• Inversión total: <strong className="text-slate-900">${(item.cost * item.stock).toFixed(2)} USD</strong> (Bs. {(item.cost * item.stock * rates.bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })})</p>
                          <p>• Retorno estimado: <strong className="text-emerald-700">${(item.price * item.stock).toFixed(2)} USD</strong></p>
                          <p>• Utilidad unitaria: <strong className="text-emerald-700">+${profitValue.toFixed(2)} USD ({profitPct.toFixed(0)}%)</strong></p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Margin summary pill */}
                    <div className="mt-3 bg-slate-50 border border-slate-200/60 p-2 rounded-2xl flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold text-[10px] uppercase">Margen:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-800">+${profitValue.toFixed(2)} USD</span>
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">
                          {profitPct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card bottom: Prices and stock controls */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100">
                    {isEditing ? (
                      /* Inline editor */
                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <label className="block text-[8px] text-slate-400 uppercase font-black mb-1">Existencia</label>
                            <input
                              type="number"
                              min="0"
                              value={editStock}
                              onChange={(e) => setEditStock(parseInt(e.target.value) || 0)}
                              className="w-full text-center py-1 font-mono font-bold bg-slate-50 rounded-xl border border-slate-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[8px] text-slate-400 uppercase font-black mb-1">Costo ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editCost}
                              onChange={(e) => setEditCost(parseFloat(e.target.value) || 0)}
                              className="w-full text-center py-1 font-mono font-bold bg-slate-50 rounded-xl border border-slate-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[8px] text-slate-400 uppercase font-black mb-1">Precio ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editPrice}
                              onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                              className="w-full text-center py-1 font-mono font-bold bg-slate-50 rounded-xl border border-slate-200 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex gap-1.5 justify-end mt-2">
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] cursor-pointer"
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
                      /* Display prices and fast + / - stepper */
                      <div className="flex items-center justify-between">
                        <div>
                          {(() => {
                            const pMoney = formatMoney(item.price, selectedCurrency, rates);
                            return (
                              <>
                                <div className="text-base font-black text-slate-900 font-mono">
                                  {pMoney.primary} <span className="text-[10px] text-slate-400 font-bold">{selectedCurrency}</span>
                                </div>
                                <div className="text-[10.5px] font-bold text-slate-500 font-mono">
                                  {pMoney.bolivares}
                                </div>
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
    </div>
  );
}
