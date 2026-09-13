import React, { useState, useMemo } from 'react';
import { 
  BookOpen, Search, Filter, RefreshCw, Send, Check, Sparkles, 
  Tag, ShoppingBag, DollarSign, Eye, EyeOff, Hash 
} from 'lucide-react';
import { InventoryItem, ExchangeRates } from '../types';

interface SuggestedCatalogProps {
  inventory: InventoryItem[];
  rates: ExchangeRates;
  onClose: () => void;
}

export default function SuggestedCatalog({ inventory, rates, onClose }: SuggestedCatalogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Selection / Simple Shopping Cart list for WhatsApp compilation
  const [cartSelections, setCartSelections] = useState<{ [productId: string]: number }>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Extract unique categories dynamically from real inventory list
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return ['all', ...Array.from(cats)];
  }, [inventory]);

  // Filter products based on search inputs
  const filteredProducts = useMemo(() => {
    return inventory.filter(prod => {
      const matchSearch = prod.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (prod.category && prod.category.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory = selectedCategory === 'all' || prod.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [inventory, searchTerm, selectedCategory]);

  const updateCartQty = (productId: string, delta: number) => {
    const current = cartSelections[productId] || 0;
    const nextVal = Math.max(0, current + delta);
    
    // Check stock boundaries
    const prod = inventory.find(i => i.id === productId);
    if (!prod) return;
    
    if (nextVal > prod.stock) {
      flashSuccess(`No puedes agregar más de la disponibilidad física (${prod.stock} disp.)`);
      return;
    }

    setCartSelections({
      ...cartSelections,
      [productId]: nextVal
    });
  };

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2400);
  };

  // Compile cart to whatsapp message body
  const selectedCartItems = useMemo(() => {
    return Object.keys(cartSelections)
      .filter(id => cartSelections[id] > 0)
      .map(id => {
        const prod = inventory.find(i => i.id === id);
        return {
          product: prod!,
          qty: cartSelections[id]
        };
      });
  }, [cartSelections, inventory]);

  const totalCartUsd = selectedCartItems.reduce((acc, curr) => acc + (curr.product.price * curr.qty), 0);

  const handleShareCatalogWhatsApp = () => {
    if (selectedCartItems.length === 0) {
      // General catalog listing WhatsApp text link
      let text = `*Catálogo de Productos*\n`;
      text += `¡Hola! Me gustaría hacerte unas consultas sobre el stock de productos disponibles:\n\n`;
      inventory.slice(0, 5).forEach(p => {
        text += `• *${p.name}* - $${p.price.toFixed(2)} USD\n`;
      });
      text += `\n¿Tienen envíos o entregas disponibles? ¡Gracias!`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      return;
    }

    // Build specific order sheet
    let text = `*PEDIDO DEL CATÁLOGO VIRTUAL*\n`;
    text += `Hola, acabo de armar mi pedido desde la plataforma:\n\n`;
    selectedCartItems.forEach(item => {
      text += `✅ *${item.qty}x ${item.product.name}*\n  Subtotal: $${(item.product.price * item.qty).toFixed(2)} USD\n`;
    });
    text += `------------------------------------\n`;
    text += `*🧾 MONTO ESTIMADO DEL PEDIDO:*\n`;
    text += `💵 *Total USD:* $${totalCartUsd.toFixed(2)} USD\n\n`;
    text += `Suminístrame las cuentas bancarias o método de pago para concretar la transferencia.`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2 text-xs font-bold rounded-xl flex items-center gap-1.5 animate-pulse-subtle">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Real Catalogo parameters */}
      <div className="bg-white rounded-2xl border border-slate-200/85 p-4 shadow-sm space-y-3.5">
        
        {/* Controls block */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
          <BookOpen className="w-4.5 h-4.5 text-blue-600" />
          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Catálogo de Productos</h4>
        </div>

        {/* Search and Filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Search container */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar producto por nombre..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Slicks categories dropdown */}
          <div className="relative">
            <Filter className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 font-bold"
            >
              <option value="all">Todas las Categorías</option>
              {categoriesList.filter(c => c !== 'all').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Product items loop */}
        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs border border-dashed rounded-2xl">
            Ningún producto de tu inventario coincide con los filtros.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
            {filteredProducts.map(prod => {
              const qtyInCart = cartSelections[prod.id] || 0;

              return (
                <div 
                  key={prod.id} 
                  className={`p-3 bg-slate-50/50 rounded-2xl border transition-all flex flex-col justify-between ${
                    qtyInCart > 0 ? 'border-blue-450 border-blue-500 bg-blue-50/10 shadow-[0_4px_12px_rgba(59,130,246,0.03)]' : 'border-slate-200/60 hover:border-slate-350'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="text-[8.5px] uppercase font-black text-slate-400 tracking-wider">
                        {prod.category || 'Categoría General'}
                      </span>
                      <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-full ${
                        prod.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {prod.stock > 0 ? `${prod.stock} en Almacén` : 'Agotado'}
                      </span>
                    </div>

                    <h5 className="font-extrabold text-slate-800 text-xs tracking-tight">{prod.name}</h5>
                    
                    <div className="flex items-baseline gap-1.5 pt-1">
                      <strong className="text-sm font-sans font-black text-slate-900">${prod.price.toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* Quantity selector in catalog */}
                  {prod.stock > 0 ? (
                    <div className="flex items-center justify-between border-t border-slate-200/50 pt-2.5 mt-2.5">
                      <span className="text-[9.5px] text-slate-500 font-bold">Selección:</span>
                      
                      <div className="flex items-center gap-2">
                        {qtyInCart > 0 && (
                          <>
                            <button
                              onClick={() => updateCartQty(prod.id, -1)}
                              className="w-5.5 h-5.5 bg-white border rounded-lg flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                            >
                              -
                            </button>
                            <span className="text-xs font-black font-mono w-5 text-center">{qtyInCart}</span>
                          </>
                        )}
                        <button
                          onClick={() => updateCartQty(prod.id, 1)}
                          className="w-5.5 h-5.5 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-xs hover:bg-blue-700 transition-all cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[9.5px] text-rose-500 font-bold mt-2 pt-2 border-t border-slate-200/40 text-right">
                      Temporalmente no disponible
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Dynamic order compiling button bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {selectedCartItems.length > 0 ? (
            <div className="text-xs font-sans">
              <span className="text-[9.5px] font-bold text-slate-400 block uppercase">Detalle del Pedido Actual ({selectedCartItems.length} productos):</span>
              <strong className="text-slate-800 text-xs font-black block">${totalCartUsd.toFixed(2)} USD</strong>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 font-medium leading-tight">
              Añade cantidades de productos para armar un pedido estructurado de ventas.
            </div>
          )}

          <button
            type="button"
            onClick={handleShareCatalogWhatsApp}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/10 self-end sm:self-auto"
          >
            <Send className="w-3.5 h-3.5" />
            {selectedCartItems.length > 0 ? 'Enviar Pedido (WhatsApp)' : 'Consultar Catalogo (Chat)'}
          </button>
        </div>

      </div>
    </div>
  );
}
