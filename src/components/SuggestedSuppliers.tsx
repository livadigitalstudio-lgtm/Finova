import React, { useState, useEffect } from 'react';
import { 
  Truck, Plus, Trash2, Search, Phone, MapPin, 
  Send, Check, FileText, ShoppingBag 
} from 'lucide-react';
import { storageService } from '../services/storageService';

interface SuggestedSuppliersProps {
  userEmail: string;
  onClose?: () => void;
}

interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  location: string;
  minOrderDetails: string;
  brands: string;
}

export default function SuggestedSuppliers({ userEmail, onClose }: SuggestedSuppliersProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Register state
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [brands, setBrands] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load suppliers list based on user identity (with IndexedDB fallback)
  useEffect(() => {
    const cached = storageService.getSync<Supplier[]>(`gt_suppliers_${userEmail}`, []);
    const clean = cached.filter(s => !s.id.startsWith('sup-') || (!s.name.includes('FragranceCCS') && !s.name.includes('PerfumeMayoristas')));
    setSuppliers(clean);
    storageService.get<Supplier[]>(`gt_suppliers_${userEmail}`, clean).then((asyncList) => {
      const cleanAsync = asyncList.filter(s => !s.id.startsWith('sup-') || (!s.name.includes('FragranceCCS') && !s.name.includes('PerfumeMayoristas')));
      if (cleanAsync.length > 0) setSuppliers(cleanAsync);
    });
  }, [userEmail]);

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newSupplier: Supplier = {
      id: `sup-${Date.now()}`,
      name: name.trim(),
      contactName: contact.trim(),
      phone: phone.trim(),
      location: location.trim(),
      minOrderDetails: minOrder.trim(),
      brands: brands.trim()
    };

    const updated = [newSupplier, ...suppliers];
    setSuppliers(updated);
    storageService.set(`gt_suppliers_${userEmail}`, updated);

    // Clear and toggle
    setName('');
    setContact('');
    setPhone('');
    setLocation('');
    setMinOrder('');
    setBrands('');
    setIsAdding(false);
    flashSuccess(`¡Distribuidor "${newSupplier.name}" guardado!`);
  };

  const handleDelete = (id: string) => {
    const target = suppliers.find(s => s.id === id);
    if (!target) return;

    if (confirm(`¿Seguro que deseas remover al proveedor "${target.name}"?`)) {
      const updated = suppliers.filter(s => s.id !== id);
      setSuppliers(updated);
      storageService.set(`gt_suppliers_${userEmail}`, updated);
      flashSuccess('Distribuidor removido de la base de datos');
    }
  };

  // WhatsApp requisition compiler
  const getRequisitionTemplate = (sup: Supplier) => {
    let text = `*Mi App de Finanzas (mifinanzas.com) - SOLICITUD DE DESPACHO*\n\n`;
    text += `Estimados *${sup.name}*, espero se encuentren excelente.\n`;
    text += `Le escribimos con el propósito de solicitar la disponibilidad y costos de reposición de lote para las siguientes líneas:\n`;
    if (sup.brands) text += `• _Marcos consultados:_ ${sup.brands}\n`;
    text += `\nFavor confirmarnos el precio al mayor, comisión de flete y tasas de cambio respectivas para el despacho. ¡Quedamos atentos!`;
    return encodeURIComponent(text);
  };

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.brands.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 p-2 text-xs font-bold rounded-xl flex items-center gap-1.5">
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-between items-center bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-black uppercase text-indigo-600 tracking-wider">
          <Truck className="w-4.5 h-4.5 animate-pulse-subtle" />
          <span>Agenda de Distribuidores Mayoristas</span>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
            isAdding ? 'bg-slate-800 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          {isAdding ? 'Cerrar Ficha' : 'Nuevo Distribuidor'}
        </button>
      </div>

      {/* Create form card */}
      {isAdding && (
        <form onSubmit={handleRegister} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wide block border-b pb-1">Ingresar Datos de Distribuidor</span>
          
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Nombre Distribuidor *</label>
              <input 
                type="text" 
                required
                placeholder="Ej. Distribuidora Fragrance"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Contacto / Vendedor</label>
              <input 
                type="text" 
                placeholder="Ej. Carmen Pérez"
                value={contact}
                onChange={e => setContact(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide font-sans">Teléfono</label>
              <input 
                type="text" 
                placeholder="Ej. 0424-1112233"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Ciudad / Ubicación</label>
              <input 
                type="text" 
                placeholder="Ej. Caracas"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Líneas de Marcas que Distribuye</label>
              <input 
                type="text" 
                placeholder="Ej. Versace, Lattafa"
                value={brands}
                onChange={e => setBrands(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide font-sans">Condición de Mínimo Compra</label>
              <input 
                type="text" 
                placeholder="Ej. Bulto de 12 unid."
                value={minOrder}
                onChange={e => setMinOrder(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
          >
            Registrar Proveedor
          </button>
        </form>
      )}

      {/* List results */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar distribuidores, marcas o ubicaciones..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-xs">No se encontraron mayoristas registrados.</p>
        ) : (
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {filtered.map(sup => (
              <div 
                key={sup.id} 
                className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl space-y-2 hover:border-slate-350 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-extrabold text-slate-800 text-xs flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      {sup.name}
                    </h5>
                    <p className="text-[10px] text-slate-450 mt-0.5 font-semibold">
                      Contacto: <span className="text-slate-700 font-bold">{sup.contactName || 'N/A'}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleDelete(sup.id)}
                    className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Remover Proveedor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] bg-white p-2 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 font-bold block">Ubicación y Fono:</span>
                    <span className="font-semibold block">{sup.location || 'Venezuela'}</span>
                    <span className="font-mono block">{sup.phone || 'S/N'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Marcas Disponibles:</span>
                    <span className="font-semibold block truncate" title={sup.brands}>{sup.brands || 'Mercancía General'}</span>
                    <span className="text-blue-600 font-bold block text-[9px]">{sup.minOrderDetails || 'Sin mínimo'}</span>
                  </div>
                </div>

                {/* WhatsApp Requisition row */}
                <div className="flex justify-end pt-1">
                  <a
                    href={`https://wa.me/${sup.phone.replace(/\D/g, '')}?text=${getRequisitionTemplate(sup)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9.5px] font-black inline-flex items-center gap-1 active:scale-95 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3 h-3" />
                    Enviar Consulta de Reposición
                  </a>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
