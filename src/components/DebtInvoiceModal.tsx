import React, { useState, useMemo } from 'react';
import { 
  X, Printer, Share2, Copy, Check, MessageSquare, Phone, 
  Calendar, DollarSign, Clock, AlertTriangle, ShieldCheck, 
  Building2, Hash, Plus, FileText, CheckCircle2, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DebtItem, ExchangeRates } from '../types';
import { getDebtRemainingAmount, getDebtPaidAmount, formatWhatsAppInvoiceMessage } from '../utils/debtUtils';
import appLogo from '../assets/images/finova_app_logo_1789320550545.jpg';

export interface DebtInvoiceModalProps {
  isOpen: boolean;
  debt: DebtItem | null;
  onClose: () => void;
  rates: ExchangeRates;
  companyName?: string;
  onOpenAddPayment?: (debt: DebtItem) => void;
  onUpdateDebt?: (debtId: string, updates: Partial<DebtItem>) => void;
}

export default function DebtInvoiceModal({
  isOpen,
  debt,
  onClose,
  rates,
  companyName = 'Finova Comercio',
  onOpenAddPayment,
  onUpdateDebt
}: DebtInvoiceModalProps) {
  if (!isOpen || !debt) return null;

  const debtCurrency = debt.currency || 'USD';
  const symbol = debtCurrency === 'USD' ? '$' : '€';
  const activeRate = debtCurrency === 'USD' ? (rates?.bcvUsd || 832.49) : (rates?.bcvEur || 968.07);

  const remaining = useMemo(() => getDebtRemainingAmount(debt), [debt]);
  const totalPaid = useMemo(() => getDebtPaidAmount(debt), [debt]);
  const totalOriginal = Number(debt.amount) || 0;
  const isPaid = debt.status === 'pagado' || remaining <= 0;

  // Client editable contact fields
  const [phone, setPhone] = useState(debt.clientPhone || '');
  const [clientIdNumber, setClientIdNumber] = useState(debt.clientIdNumber || '');
  const [isCopied, setIsCopied] = useState(false);
  const [isEditingPaymentInfo, setIsEditingPaymentInfo] = useState(false);

  // Bank instructions loaded from local store or default
  const [paymentInstructions, setPaymentInstructions] = useState<string>(() => {
    return localStorage.getItem('gt_merchant_payment_instructions') || 
      '• Pago Móvil: Banco Banesco | 0414-0000000 | V-00000000\n• Divisas en efectivo o Zelle: Consulta los datos con nosotros.';
  });

  const handleSavePaymentInstructions = (val: string) => {
    setPaymentInstructions(val);
    localStorage.setItem('gt_merchant_payment_instructions', val);
  };

  // Save phone or ID to debt if changed
  const handlePhoneBlur = () => {
    if (onUpdateDebt && (phone !== debt.clientPhone || clientIdNumber !== debt.clientIdNumber)) {
      onUpdateDebt(debt.id, {
        clientPhone: phone.trim() || undefined,
        clientIdNumber: clientIdNumber.trim() || undefined
      });
    }
  };

  const folio = `FAC-${debt.id.replace(/[^0-9]/g, '').slice(-5) || '1001'}`;
  const nf = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Format WhatsApp message
  const generatedMessage = useMemo(() => {
    return formatWhatsAppInvoiceMessage(
      {
        ...debt,
        clientPhone: phone,
        clientIdNumber: clientIdNumber
      },
      companyName,
      rates,
      paymentInstructions
    );
  }, [debt, phone, clientIdNumber, companyName, rates, paymentInstructions]);

  // WhatsApp sender link
  const handleSendWhatsApp = () => {
    handlePhoneBlur();
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    // If Venezuelan number starting with 0, convert 0414... -> 58414...
    if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
      cleanPhone = '58' + cleanPhone.slice(1);
    } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('58')) {
      cleanPhone = '58' + cleanPhone;
    }

    const textEncoded = encodeURIComponent(generatedMessage);
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${textEncoded}` : `https://wa.me/?text=${textEncoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Copy to clipboard
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard write error', e);
    }
  };

  // Print invoice
  const handlePrint = () => {
    window.print();
  };

  // Due date status
  const isOverdue = useMemo(() => {
    if (isPaid) return false;
    if (!debt.dueDate) return false;
    const due = new Date(debt.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }, [debt.dueDate, isPaid]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:max-h-none print:overflow-visible"
      >
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80 print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                Factura / Estado de Cuenta
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {folio} • {debt.debtorName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              title="Imprimir Factura o Guardar PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Invoice Document Canvas */}
        <div className="p-4 sm:p-8 overflow-y-auto space-y-6 print:p-4 print:overflow-visible" id="printable-debt-invoice">
          {/* Printable Invoice Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-5 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <img 
                  src={appLogo} 
                  alt="Finova" 
                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-xs"
                />
                <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {companyName.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Comprobante Oficial de Cobro y Estado de Deuda
              </p>
              <p className="text-[11px] font-mono text-slate-400">
                Fecha Emisión: {debt.dateCreated} • Tasa BCV Ref: Bs. {nf(activeRate)}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs font-black font-mono px-2.5 py-1 bg-slate-900 text-white rounded-lg">
                {folio}
              </span>
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1 text-[11px] font-black uppercase px-2 py-0.5 rounded-md ${
                  isPaid 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : isOverdue 
                    ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                    : totalPaid > 0 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {isPaid ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      PAGADO
                    </>
                  ) : isOverdue ? (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      VENCIDA
                    </>
                  ) : totalPaid > 0 ? (
                    'ABONADO (PARCIAL)'
                  ) : (
                    'PENDIENTE'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Client Details Section with live phone edit (for quick WhatsApp sending) */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Datos del Cliente / Deudor</span>
              <span className="text-slate-500 font-mono">Tipo: {debt.type === 'por_cobrar' ? 'Cuenta por Cobrar' : 'Cuenta por Pagar'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Nombre / Razón Social:</span>
                <p className="text-sm font-black text-slate-900">
                  {debt.debtorName}
                </p>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium block">WhatsApp / Teléfono:</span>
                <div className="relative mt-0.5">
                  <Phone className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={handlePhoneBlur}
                    placeholder="Ej: 0414-1234567"
                    className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:border-emerald-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium block">C.I. / RIF (Opcional):</span>
                <input
                  type="text"
                  value={clientIdNumber}
                  onChange={(e) => setClientIdNumber(e.target.value)}
                  onBlur={handlePhoneBlur}
                  placeholder="Ej: V-12345678"
                  className="w-full px-2.5 py-1 mt-0.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:border-emerald-500 outline-hidden"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs flex-wrap gap-2">
              <span className="text-slate-600">
                <strong>Concepto:</strong> {debt.description || 'Venta o crédito acordado'}
              </span>
              <span className="text-slate-500 font-mono">
                <strong>Vencimiento:</strong> {debt.dueDate || 'Sin fecha fija'}
              </span>
            </div>
          </div>

          {/* Debt Summary Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Detalle del Monto Facturado
            </h4>
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Descripción</th>
                    <th className="p-3 text-right">Moneda</th>
                    <th className="p-3 text-right">Monto Original</th>
                    <th className="p-3 text-right">Equivalente Bs.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 font-medium text-slate-800">
                      {debt.description || `Deuda / Cuenta de ${debt.debtorName}`}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-600">
                      {debtCurrency}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-slate-900">
                      {symbol}{nf(totalOriginal)}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      Bs. {nf(totalOriginal * activeRate)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Abonos History Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Historial de Abonos y Pagos Parciales
              </h4>
              <span className="text-xs font-bold text-emerald-600 font-mono">
                Total Abonado: {symbol}{nf(totalPaid)}
              </span>
            </div>

            {(!debt.payments || debt.payments.length === 0) ? (
              <div className="p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center text-xs text-slate-400">
                Aún no se han registrado abonos para esta cuenta.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Fecha</th>
                      <th className="p-2.5">Método</th>
                      <th className="p-2.5">Referencia</th>
                      <th className="p-2.5 text-right">Abono ({symbol})</th>
                      <th className="p-2.5 text-right">Monto en Bs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {debt.payments.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-sans font-medium text-slate-700">{p.date}</td>
                        <td className="p-2.5 font-sans text-slate-600">{p.paymentMethod}</td>
                        <td className="p-2.5 text-slate-500">{p.reference || '-'}</td>
                        <td className="p-2.5 text-right font-black text-emerald-700">
                          +{symbol}{nf(p.amount)}
                        </td>
                        <td className="p-2.5 text-right text-slate-600">
                          Bs. {nf(p.amountBs || (p.amount * (p.exchangeRateUsed || activeRate)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Financial Grand Summary Card */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Total Deuda Facturada:</span>
              <span className="font-mono font-bold">{symbol}{nf(totalOriginal)} {debtCurrency}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-emerald-400">
              <span>Total Pagado / Abonado:</span>
              <span className="font-mono font-bold">-{symbol}{nf(totalPaid)} {debtCurrency}</span>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-end justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  SALDO RESTANTE PENDIENTE
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold block mt-0.5">
                  Bs. {nf(remaining * activeRate)} (a tasa oficial)
                </span>
              </div>
              <div className="text-right">
                <span className={`text-2xl sm:text-3xl font-black font-mono ${
                  isPaid ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {symbol}{nf(remaining)}
                </span>
                <span className="text-[11px] font-bold text-slate-400 ml-1">
                  {debtCurrency}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Instructions / Bank Info for Customer */}
          {!isPaid && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  Cuentas para realizar su pago / abono
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingPaymentInfo(!isEditingPaymentInfo)}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer print:hidden"
                >
                  {isEditingPaymentInfo ? 'Guardar datos' : 'Editar datos de cobro'}
                </button>
              </div>

              {isEditingPaymentInfo ? (
                <div className="space-y-1.5">
                  <textarea
                    rows={3}
                    value={paymentInstructions}
                    onChange={(e) => handleSavePaymentInstructions(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:border-emerald-500 outline-hidden"
                    placeholder="Escribe aquí tu cuenta bancaria, pago móvil o Zelle..."
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Estos datos se incluirán automáticamente en el mensaje de WhatsApp al cliente.
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-600 font-mono whitespace-pre-line leading-relaxed">
                  {paymentInstructions}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Footer (WhatsApp send, Copy, Add Payment) */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onOpenAddPayment && !isPaid && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddPayment(debt);
                }}
                className="py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>+ Abonar a Deuda</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyMessage}
              className="py-2.5 px-3.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
              title="Copiar texto para enviar"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-black">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Copiar Mensaje</span>
                </>
              )}
            </button>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 sm:flex-none py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <MessageSquare className="w-4 h-4 fill-white" />
              <span>Enviar por WhatsApp</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
