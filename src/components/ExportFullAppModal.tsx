import React, { useState } from 'react';
import { 
  FileDown, X, CheckCircle2, ShieldCheck, Calendar, Database, 
  Package, Receipt, Users, CreditCard, Sparkles, AlertCircle, 
  Download, FileText, ArrowRight, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem, FinancialRecord, DebtItem, ExchangeRates } from '../types';
import { Client } from './SuggestedClients';
import { CurrencyCode } from '../utils/currency';
import { generateFullAppPDF, exportFullDataJSON, getAppHistoricalDateRange } from '../utils/fullExportPDF';

interface ExportFullAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  records?: FinancialRecord[];
  debts?: DebtItem[];
  clients?: Client[];
  rates: ExchangeRates;
  selectedCurrency?: CurrencyCode;
  companyName?: string;
  userEmail?: string;
  onNotify?: (msg: string) => void;
}

export default function ExportFullAppModal({
  isOpen,
  onClose,
  inventory,
  records = [],
  debts = [],
  clients = [],
  rates,
  selectedCurrency = 'USD',
  companyName = 'Finova Negocio',
  userEmail,
  onNotify
}: ExportFullAppModalProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const dateRange = getAppHistoricalDateRange(records, debts);

  const formatDateLabel = (dStr?: string) => {
    if (!dStr) return 'N/A';
    try {
      const parts = dStr.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dStr;
    } catch {
      return dStr;
    }
  };

  // Calculations for quick preview
  const totalStockUnits = inventory.reduce((sum, item) => sum + (item.stock || 0), 0);
  const totalInventoryCost = inventory.reduce((sum, item) => sum + ((item.cost || 0) * (item.stock || 0)), 0);
  const totalIncomeRecords = records.filter(r => r.type === 'ingreso').length;
  const totalExpenseRecords = records.filter(r => r.type === 'egreso').length;
  const totalDebtsCount = debts.length;
  const totalAbonosCount = debts.reduce((sum, d) => sum + (d.payments?.length || 0), 0);

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPdf(true);
      // Allow UI to render the loading state
      await new Promise(resolve => setTimeout(resolve, 150));

      generateFullAppPDF({
        companyName,
        userEmail,
        inventory,
        records,
        debts,
        clients,
        rates,
        selectedCurrency,
      });

      const msg = '¡Reporte PDF descargado con éxito!';
      setSuccessMessage(msg);
      if (onNotify) onNotify(msg);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Error generating PDF:', err);
      if (onNotify) onNotify('Error al generar el documento PDF. Intenta de nuevo.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadJSON = async () => {
    try {
      setIsExportingJson(true);
      await new Promise(resolve => setTimeout(resolve, 100));

      exportFullDataJSON({
        companyName,
        userEmail,
        inventory,
        records,
        debts,
        clients,
        rates,
        selectedCurrency,
      });

      const msg = '¡Copia de seguridad JSON descargada!';
      setSuccessMessage(msg);
      if (onNotify) onNotify(msg);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Error exporting JSON:', err);
    } finally {
      setIsExportingJson(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center">
                <FileDown className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                  Descargar Datos de la App
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                    Histórico 100%
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Exportación integral desde el primer día registrado hasta hoy
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-4">
            {/* Success alert */}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-3 text-xs flex items-center gap-2 font-medium"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </motion.div>
            )}

            {/* Date Range Badge */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Período Histórico Cubierto</div>
                  <div className="text-xs font-bold text-slate-800">
                    {dateRange.hasRecords 
                      ? `${formatDateLabel(dateRange.earliestDate)}  —  ${formatDateLabel(dateRange.latestDate)}`
                      : 'Desde el primer registro hasta hoy'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-medium">Empresa</div>
                <div className="text-xs font-bold text-slate-700 truncate max-w-[140px]">{companyName}</div>
              </div>
            </div>

            {/* Content summary grid */}
            <div>
              <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>Información que se incluirá en el PDF:</span>
                <span className="text-[11px] font-normal text-indigo-600">Sin omisión de datos</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. Inventario */}
                <div className="p-3 rounded-2xl border border-slate-200/70 bg-amber-50/40 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
                    <Package className="w-3.5 h-3.5 text-amber-600" />
                    <span>Inventario Total</span>
                  </div>
                  <div className="text-lg font-black text-slate-900">{inventory.length} <span className="text-xs font-normal text-slate-500">productos</span></div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {totalStockUnits} unidades físicas | ${totalInventoryCost.toFixed(2)} al costo
                  </div>
                </div>

                {/* 2. Transacciones */}
                <div className="p-3 rounded-2xl border border-slate-200/70 bg-emerald-50/40 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Libro Financiero</span>
                  </div>
                  <div className="text-lg font-black text-slate-900">{records.length} <span className="text-xs font-normal text-slate-500">movimientos</span></div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {totalIncomeRecords} ventas e ingresos | {totalExpenseRecords} egresos
                  </div>
                </div>

                {/* 3. Deudas y Abonos */}
                <div className="p-3 rounded-2xl border border-slate-200/70 bg-indigo-50/40 space-y-1">
                  <div className="flex items-center gap-1.5 text-indigo-800 text-xs font-bold">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Cartera y Deudas</span>
                  </div>
                  <div className="text-lg font-black text-slate-900">{totalDebtsCount} <span className="text-xs font-normal text-slate-500">cuentas</span></div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {totalAbonosCount} abonos registrados con comprobante
                  </div>
                </div>

                {/* 4. Clientes */}
                <div className="p-3 rounded-2xl border border-slate-200/70 bg-blue-50/40 space-y-1">
                  <div className="flex items-center gap-1.5 text-blue-800 text-xs font-bold">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Directorio Clientes</span>
                  </div>
                  <div className="text-lg font-black text-slate-900">{clients.length} <span className="text-xs font-normal text-slate-500">registrados</span></div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Contactos, dirección, notas y saldos
                  </div>
                </div>
              </div>
            </div>

            {/* Quality badge explanation */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11px] text-slate-600 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800">Formato del Reporte PDF:</span>
                <p>
                  Documento formal paginado con encabezados de auditoría, resumen patrimonial consolidado, 
                  conversiones a Bolívares oficiales BCV y desglose ordenado cronológicamente desde el primer registro.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center gap-2.5 justify-between">
            <button
              type="button"
              onClick={handleDownloadJSON}
              disabled={isExportingJson}
              className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              title="Descargar copia de seguridad en formato JSON estructurado"
            >
              {isExportingJson ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              ) : (
                <Database className="w-4 h-4 text-slate-600" />
              )}
              <span>Copia de Seguridad JSON</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Generando Documento PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 text-white" />
                  <span>Descargar Reporte PDF Completo</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
