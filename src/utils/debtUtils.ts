import { DebtItem, ExchangeRates } from '../types';

/**
 * Returns the current remaining unpaid balance of a debt.
 */
export function getDebtRemainingAmount(debt: DebtItem): number {
  if (debt.status === 'pagado') return 0;
  if (typeof debt.remainingAmount === 'number') {
    return Math.max(0, debt.remainingAmount);
  }
  if (debt.payments && debt.payments.length > 0) {
    const totalPaid = debt.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return Math.max(0, Number((debt.amount - totalPaid).toFixed(2)));
  }
  return Number(debt.amount) || 0;
}

/**
 * Returns the total accumulated payments (abonos) applied to a debt.
 */
export function getDebtPaidAmount(debt: DebtItem): number {
  if (typeof debt.paidAmount === 'number') {
    return Math.min(debt.amount, Math.max(0, debt.paidAmount));
  }
  if (debt.payments && debt.payments.length > 0) {
    const totalPaid = debt.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return Math.min(debt.amount, totalPaid);
  }
  if (debt.status === 'pagado') {
    return Number(debt.amount) || 0;
  }
  return 0;
}

/**
 * Returns payment progress percentage from 0 to 100.
 */
export function getDebtProgressPercentage(debt: DebtItem): number {
  if (debt.status === 'pagado') return 100;
  const original = Number(debt.amount) || 0;
  if (original <= 0) return 100;
  const paid = getDebtPaidAmount(debt);
  return Math.min(100, Math.max(0, Math.round((paid / original) * 100)));
}

/**
 * Generates an elegant, high-clarity WhatsApp invoice & debt statement message for clients.
 */
export function formatWhatsAppInvoiceMessage(
  debt: DebtItem,
  companyName: string = 'Finova Comercio',
  rates: ExchangeRates,
  paymentInstructions?: string
): string {
  const currency = debt.currency || 'USD';
  const symbol = currency === 'USD' ? '$' : '€';
  const activeRate = currency === 'USD' ? (rates?.bcvUsd || 832.49) : (rates?.bcvEur || 968.07);
  const remaining = getDebtRemainingAmount(debt);
  const paid = getDebtPaidAmount(debt);
  const totalOriginal = Number(debt.amount) || 0;

  const nf = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalBs = (totalOriginal * activeRate);
  const remainingBs = (remaining * activeRate);
  const paidBs = (paid * activeRate);

  const folio = `FAC-${debt.id.replace(/[^0-9]/g, '').slice(-5) || '1001'}`;
  const isPaid = debt.status === 'pagado' || remaining <= 0;

  let msg = `🧾 *ESTADO DE CUENTA / FACTURA DE COBRO*\n`;
  msg += `🏢 *${companyName.toUpperCase()}*\n`;
  msg += `Nº Recibo: *${folio}*\n`;
  msg += `------------------------------------\n`;
  msg += `👤 *Cliente:* ${debt.debtorName}\n`;
  if (debt.clientIdNumber) {
    msg += `🪪 *C.I / RIF:* ${debt.clientIdNumber}\n`;
  }
  msg += `📋 *Concepto:* ${debt.description || 'Cuenta pendiente'}\n`;
  msg += `📅 *Fecha de emisión:* ${debt.dateCreated || new Date().toISOString().slice(0, 10)}\n`;
  msg += `⏰ *Vencimiento:* ${debt.dueDate || 'Inmediato'}\n`;
  msg += `------------------------------------\n`;
  msg += `💰 *Monto Original:* ${symbol}${nf(totalOriginal)} ${currency} (Bs. ${nf(totalBs)})\n`;

  if (debt.payments && debt.payments.length > 0) {
    msg += `\n📝 *Historial de Abonos Recibidos:*\n`;
    debt.payments.forEach((p, index) => {
      const refStr = p.reference ? ` [Ref: ${p.reference}]` : '';
      msg += `  ${index + 1}. ${p.date}: *${symbol}${nf(p.amount)}* (${p.paymentMethod}${refStr})\n`;
    });
    msg += `✅ *Total Abonado:* ${symbol}${nf(paid)} ${currency} (Bs. ${nf(paidBs)})\n`;
  }

  msg += `------------------------------------\n`;
  if (isPaid) {
    msg += `🎉 *ESTATUS: PAGADA / SOLVENTADA*\n`;
    msg += `Saldo Pendiente: *${symbol}0.00* (Bs. 0.00)\n`;
  } else {
    msg += `🔴 *SALDO PENDIENTE POR PAGAR:*\n`;
    msg += `👉 *${symbol}${nf(remaining)} ${currency}*\n`;
    msg += `🇻🇪 *Equivalente en Bolívares (Tasa BCV Bs. ${nf(activeRate)}):*\n`;
    msg += `👉 *Bs. ${nf(remainingBs)}*\n`;
  }

  if (!isPaid) {
    msg += `\n💳 *Datos para realizar su pago / abono:*\n`;
    if (paymentInstructions && paymentInstructions.trim()) {
      msg += `${paymentInstructions.trim()}\n`;
    } else {
      msg += `• *Pago Móvil / Transferencia:*\n`;
      msg += `  Banco: Consulta por este medio\n`;
      msg += `  Teléfono: Por favor confirma antes de transferir\n`;
      msg += `• *Divisas en efectivo:* En nuestra sede o entrega acordada\n`;
    }
  }

  msg += `\n_Por favor responder con el comprobante de pago una vez realizado. ¡Muchas gracias por su confianza!_ 🙏`;

  return msg;
}
