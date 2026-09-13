import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Trash2, Copy, Share2, Save, ShoppingBag, 
  ChevronRight, Calendar, User, Phone, Check, AlertCircle 
} from 'lucide-react';
import { InventoryItem, ExchangeRates } from '../types';
import { storageService } from '../services/storageService';
import { getLocalDateString } from '../utils/dateUtils';

interface SuggestedQuotesProps {
  inventory: InventoryItem[];
  rates: ExchangeRates;
  userEmail: string;
  onClose?: () => void;
}

interface QuoteItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface SavedQuote {
  id: string;
  clientName: string;
  clientPhone: string;
  date: string;
  items: QuoteItem[];
  rateUsed: number;
  rateType: string;
  totalUsd: number;
  totalBs: number;
}

export default function SuggestedQuotes({ inventory, rates, userEmail, onClose }: SuggestedQuotesProps) {
  // Saved Quotes in localStorage
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedRateType, setSelectedRateType] = useState<'bcv' | 'euro' | 'usdt'>('bcv');
  
  // Current items in progress
  const [currentQuoteItems, setCurrentQuoteItems] = useState<QuoteItem[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load saved quotes
  useEffect(() => {
    const cached = storageService.getSync<SavedQuote[]>(`gt_quotes_${userEmail}`, []);
    setSavedQuotes(cached);
    storageService.get<SavedQuote[]>(`gt_quotes_${userEmail}`, cached).then((q) => {
      if (q && q.length > 0) setSavedQuotes(q);
    });
  }, [userEmail]);

  // Select first product if available
  useEffect(() => {
    if (inventory && inventory.length > 0 && !selectedProductId) {
      setSelectedProductId(inventory[0].id);
    }
  }, [inventory, selectedProductId]);

  const activeRate = selectedRateType === 'bcv' 
    ? rates.bcvUsd 
    : (selectedRateType === 'euro' ? rates.bcvEur : (rates.usdtUsd ?? 735.37));

  const handleAddItem = () => {
    if (!selectedProductId) return;
    const prod = inventory.find(i => i.id === selectedProductId);
    if (!prod) return;

    // Check if copy already in quote
    const existsIndex = currentQuoteItems.findIndex(qi => qi.productId === selectedProductId);
    if (existsIndex > -1) {
      const updated = [...currentQuoteItems];
      updated[existsIndex].quantity += quantity;
      setCurrentQuoteItems(updated);
    } else {
      setCurrentQuoteItems([
        ...currentQuoteItems,
        {
          productId: prod.id,
          name: prod.name,
          price: prod.price,
          quantity: quantity
        }
      ]);
    }
    setQuantity(1);
    flashSuccess('Producto añadido a la cotización');
  };

  const handleRemoveItem = (index: number) => {
    setCurrentQuoteItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalUsd = currentQuoteItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalBs = totalUsd * activeRate;

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleSaveQuote = () => {
    if (!clientName.trim()) {
      flashSuccess('Por favor ingresa el nombre del cliente');
      return;
    }
    if (currentQuoteItems.length === 0) {
      flashSuccess('Por favor añade al menos un producto a la cotización');
      return;
    }

    const newQuote: SavedQuote = {
      id: `quote-${Date.now()}`,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      date: getLocalDateString(),
      items: [...currentQuoteItems],
      rateUsed: activeRate,
      rateType: selectedRateType.toUpperCase(),
      totalUsd,
      totalBs
    };

    const updated = [newQuote, ...savedQuotes];
    setSavedQuotes(updated);
    storageService.set(`gt_quotes_${userEmail}`, updated);

    // Clear state
    setClientName('');
    setClientPhone('');
    setCurrentQuoteItems([]);
    flashSuccess('¡Cotización guardada con éxito en el historial!');
  };

  const handleDeleteSavedQuote = (id: string) => {
    const updated = savedQuotes.filter(q => q.id !== id);
    setSavedQuotes(updated);
    storageService.set(`gt_quotes_${userEmail}`, updated);
    flashSuccess('Cotización eliminada del historial');
  };

  const getWhatsAppMessageText = (quote: { clientName: string, clientPhone?: string, date: string, items: QuoteItem[], totalUsd: number }) => {
    let text = `*Mi App de Finanzas (mifinanzas.com) - COTIZACIÓN*\n\n`;
    text += `*Cliente:* ${quote.clientName}\n`;
    if (quote.clientPhone) text += `*Teléfono:* ${quote.clientPhone}\n`;
    text += `*Fecha:* ${quote.date}\n`;
    text += `------------------------------------\n`;
    quote.items.forEach(item => {
      text += `• *${item.quantity}x ${item.name}*\n  Precio: $${item.price.toFixed(2)} USD\n`;
    });
    text += `------------------------------------\n`;
    text += `*TOTAL A PAGAR:*\n`;
    text += `💰 *USD: $${quote.totalUsd.toFixed(2)} USD*\n\n`;
    text += `¡Gracias por preferirnos! Contáctanos para concretar tu pedido.`;
    return encodeURIComponent(text);
  };

  const handleCopyClipboard = (quote: { clientName: string, clientPhone?: string, date: string, items: QuoteItem[], totalUsd: number }) => {
    const rawText = decodeURIComponent(getWhatsAppMessageText(quote));
    navigator.clipboard.writeText(rawText);
    flashSuccess('Texto copiado al portapapeles. ¡Listo para pegar en WhatsApp!');
  };

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 p-2 text-xs font-bold rounded-xl flex items-center gap-1.5 animate-bounce-subtle">
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Quoter card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-[11px] font-black uppercase text-indigo-600 tracking-wider flex items-center gap-1">
            <FileText className="w-4 h-4" />
            <span>Generar Nuevo Presupuesto</span>
          </span>
        </div>

        {/* Client Fields */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Nombre del Cliente *</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Ej. María Ramos"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Teléfono (WhatsApp)</label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Ej. 0412-1234567"
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 font-medium font-mono"
              />
            </div>
          </div>
        </div>


        {/* Add Products Area */}
        <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-2">
          <span className="text-[9.5px] font-black uppercase text-slate-500 tracking-wide block">Añadir Producto al Detalle</span>
          
          <div className="flex gap-2 items-end">
            <div className="flex-grow space-y-1">
              <select
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="w-full p-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                {inventory.length === 0 ? (
                  <option value="">No hay productos disponibles</option>
                ) : (
                  inventory.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${p.price.toFixed(2)})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="w-20 space-y-1">
              <input 
                type="number" 
                min="1"
                value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-1.5 text-xs bg-white border border-slate-200 rounded-xl font-bold text-center"
              />
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              disabled={!selectedProductId}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Current Items Table Preview */}
        {currentQuoteItems.length > 0 ? (
          <div className="space-y-3.5">
            <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">Artículos de la Cotización</span>
            <div className="border border-slate-200/60 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-slate-50/30">
              {currentQuoteItems.map((item, idx) => (
                <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-extrabold text-slate-800 block">{item.name}</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {item.quantity} x ${item.price.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong className="text-slate-800 font-mono font-bold">
                      ${(item.price * item.quantity).toFixed(2)}
                    </strong>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveItem(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Subtotals & Main Outputs */}
            <div className="bg-slate-900 text-white p-3.5 rounded-2xl font-mono text-xs space-y-1.5 border border-slate-950">
              <div className="flex justify-between items-center text-emerald-400 font-black text-sm">
                <span>Total Estimado USD:</span>
                <span>${totalUsd.toFixed(2)} USD</span>
              </div>
            </div>

            {/* Action Group */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleCopyClipboard({ clientName, clientPhone, date: getLocalDateString(), items: currentQuoteItems, totalUsd })}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar WhatsApp
              </button>
              
              <button
                type="button"
                onClick={handleSaveQuote}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar Presupuesto
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1">
            <ShoppingBag className="w-5 h-5 text-slate-300 animate-pulse" />
            <p className="text-[10.5px] font-semibold">No has añadido productos a esta cotización.</p>
          </div>
        )}
      </div>

      {/* Quote History list */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3.5">
        <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider block">Historial de Cotizaciones Guardadas ({savedQuotes.length})</span>
        
        {savedQuotes.length === 0 ? (
          <p className="text-center py-6 text-[10px] text-slate-400 font-medium font-sans">
            Aún no has guardado cotizaciones en esta cuenta.
          </p>
        ) : (
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
            {savedQuotes.map(q => (
              <div key={q.id} className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl space-y-1.5">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-extrabold text-slate-800 text-xs">{q.clientName}</h5>
                    <p className="text-[9.5px] text-slate-400 font-bold">
                      {q.date} {q.clientPhone ? `• Cel: ${q.clientPhone}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyClipboard(q)}
                      title="Copiar Detalles"
                      className="p-1 px-1.5 bg-white text-slate-600 hover:text-emerald-600 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedQuote(q.id)}
                      title="Eliminar de Historial"
                      className="p-1 px-1.5 bg-white text-rose-500 hover:bg-rose-50 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Micro Product rows */}
                <div className="text-[10px] text-slate-500 divide-y divide-slate-200/40">
                  {q.items.map((it, idx) => (
                    <div key={idx} className="py-1 flex justify-between">
                      <span>{it.quantity}x {it.name}</span>
                      <strong className="font-mono">${(it.price * it.quantity).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end items-center pt-1.5 border-t border-slate-200/50 text-xs font-mono">
                  <div className="text-right font-black">
                    <span className="text-slate-800 block">${q.totalUsd.toFixed(2)} USD</span>
                  </div>
                </div>

                {/* Instantly send to Whatsapp if Phone exists */}
                {q.clientPhone && (
                  <a
                    href={`https://wa.me/${q.clientPhone.replace(/\D/g, '')}?text=${getWhatsAppMessageText(q)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 w-full py-1 bg-emerald-50 text-emerald-800 border border-emerald-150 text-[9.5px] font-black rounded-lg inline-flex items-center justify-center gap-1 hover:bg-emerald-100 transition-all cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" />
                    Enviar directamente por WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
