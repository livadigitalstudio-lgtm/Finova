import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InventoryItem, FinancialRecord, DebtItem, ExchangeRates } from '../types';
import { Client } from '../components/SuggestedClients';
import { formatMoney, CurrencyCode } from './currency';

export interface FullExportData {
  companyName?: string;
  userEmail?: string;
  inventory: InventoryItem[];
  records: FinancialRecord[];
  debts: DebtItem[];
  clients: Client[];
  rates: ExchangeRates;
  selectedCurrency?: CurrencyCode;
}

/**
 * Helper to format date strings cleanly
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Calculates earliest and latest dates across all records and debts
 */
export function getAppHistoricalDateRange(records: FinancialRecord[], debts: DebtItem[]): {
  earliestDate: string;
  latestDate: string;
  hasRecords: boolean;
} {
  const dates: string[] = [];

  records.forEach(r => {
    if (r.date) dates.push(r.date.split('T')[0]);
  });

  debts.forEach(d => {
    if (d.dateCreated) dates.push(d.dateCreated.split('T')[0]);
    if (d.dueDate) dates.push(d.dueDate.split('T')[0]);
    if (d.payments) {
      d.payments.forEach(p => {
        if (p.date) dates.push(p.date.split('T')[0]);
      });
    }
  });

  if (dates.length === 0) {
    const today = new Date().toISOString().split('T')[0];
    return {
      earliestDate: today,
      latestDate: today,
      hasRecords: false,
    };
  }

  dates.sort();
  return {
    earliestDate: dates[0],
    latestDate: dates[dates.length - 1],
    hasRecords: true,
  };
}

/**
 * Generates an exhaustive, multi-page professional PDF containing
 * ALL app data from Day 1 to Today.
 */
export function generateFullAppPDF(data: FullExportData): void {
  const {
    companyName = 'Finova Negocio',
    userEmail = 'Usuario',
    inventory = [],
    records = [],
    debts = [],
    clients = [],
    rates,
    selectedCurrency = 'USD'
  } = data;

  // Create A4 portrait document (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;

  const now = new Date();
  const printTimestamp = `${now.toLocaleDateString('es-VE')} ${now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;
  const dateRange = getAppHistoricalDateRange(records, debts);

  const bcvUsd = rates?.bcvUsd || 832.49;
  const bcvEur = rates?.bcvEur || 968.07;
  const paraleloUsd = rates?.paraleloUsd || bcvUsd;

  // --- Calculations for Consolidated Summary ---
  let totalIncomeUsd = 0;
  let totalIncomeBs = 0;
  let totalExpenseUsd = 0;
  let totalExpenseBs = 0;

  records.forEach(r => {
    const isEur = r.currency === 'EUR';
    const rate = isEur ? bcvEur : bcvUsd;
    const amountBs = r.amountBs || (r.amount * rate);
    const amountUsd = isEur ? (amountBs / bcvUsd) : r.amount;

    if (r.type === 'ingreso') {
      totalIncomeUsd += amountUsd;
      totalIncomeBs += amountBs;
    } else {
      totalExpenseUsd += amountUsd;
      totalExpenseBs += amountBs;
    }
  });

  const netProfitUsd = totalIncomeUsd - totalExpenseUsd;
  const netProfitBs = totalIncomeBs - totalExpenseBs;

  // Inventory valuation
  let totalInventoryCostValuation = 0;
  let totalInventorySaleValuation = 0;
  let totalStockUnits = 0;

  inventory.forEach(item => {
    const cost = item.cost || 0;
    const price = item.price || 0;
    const stock = item.stock || 0;
    totalStockUnits += stock;
    totalInventoryCostValuation += cost * stock;
    totalInventorySaleValuation += price * stock;
  });

  const potentialGrossMarginUsd = totalInventorySaleValuation - totalInventoryCostValuation;

  // Debts valuation
  let totalReceivablesOriginal = 0;
  let totalReceivablesPaid = 0;
  let totalReceivablesPending = 0;

  let totalPayablesOriginal = 0;
  let totalPayablesPaid = 0;
  let totalPayablesPending = 0;

  debts.forEach(d => {
    const orig = d.amount || 0;
    const paid = (d.payments && d.payments.length > 0)
      ? d.payments.reduce((acc, p) => acc + (p.amount || 0), 0)
      : (d.paidAmount || (d.status === 'pagado' ? orig : 0));
    const pending = Math.max(0, orig - paid);

    if (d.type === 'por_cobrar') {
      totalReceivablesOriginal += orig;
      totalReceivablesPaid += paid;
      totalReceivablesPending += pending;
    } else {
      totalPayablesOriginal += orig;
      totalPayablesPaid += paid;
      totalPayablesPending += pending;
    }
  });

  let currentY = 16;

  // ==========================================
  // 1. HEADER SECTION (Brand & Audit Details)
  // ==========================================
  // Top brand bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(marginLeft, currentY, contentWidth, 24, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FINOVA | REPORTE HISTÓRICO INTEGRAL DE DATOS', marginLeft + 6, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Empresa / Comercio: ${companyName}   |   Usuario: ${userEmail}`, marginLeft + 6, currentY + 16);
  doc.text(`Fecha y Hora de Emisión: ${printTimestamp}   |   Moneda Base: ${selectedCurrency}`, marginLeft + 6, currentY + 21);

  currentY += 28;

  // Period and Official Exchange Rates Info Banner
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(marginLeft, currentY, contentWidth, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const periodText = dateRange.hasRecords
    ? `Período Histórico Registrado: ${formatDate(dateRange.earliestDate)} al ${formatDate(dateRange.latestDate)}`
    : `Período Histórico Registrado: Desde el primer día de registro hasta hoy`;
  doc.text(periodText, marginLeft + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Tasas Oficiales BCV: USD = Bs. ${bcvUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}   |   EUR = Bs. ${bcvEur.toLocaleString('es-VE', { minimumFractionDigits: 2 })}   |   Paralelo = Bs. ${paraleloUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
    marginLeft + 4,
    currentY + 11
  );

  currentY += 18;

  // ==========================================
  // 2. EXECUTIVE FINANCIAL CONSOLIDATED SUMMARY
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RESUMEN FINANCIERO Y PATRIMONIAL CONSOLIDADO', marginLeft, currentY);
  currentY += 3;

  autoTable(doc, {
    startY: currentY,
    head: [['Concepto Financiero', 'Monto Histórico ($ USD)', 'Equivalente en Bolívares (Bs. BCV)', 'Estado / Alcance']],
    body: [
      [
        'Ventas e Ingresos Totales Acumulados',
        `$${totalIncomeUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Bs. ${totalIncomeBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${records.filter(r => r.type === 'ingreso').length} transacciones registradas`
      ],
      [
        'Gastos y Compras Totales Acumulados',
        `$${totalExpenseUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Bs. ${totalExpenseBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${records.filter(r => r.type === 'egreso').length} transacciones registradas`
      ],
      [
        'Utilidad Neta / Flujo Neto Histórico',
        `${netProfitUsd >= 0 ? '+' : ''}$${netProfitUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${netProfitBs >= 0 ? '+' : ''}Bs. ${netProfitBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        netProfitUsd >= 0 ? 'Flujo de Caja Superavitario' : 'Déficit acumulado'
      ],
      [
        'Valorización de Inventario (al Costo)',
        `$${totalInventoryCostValuation.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Bs. ${(totalInventoryCostValuation * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${inventory.length} productos (${totalStockUnits} unidades físicas)`
      ],
      [
        'Valorización de Inventario (al PVP Venta)',
        `$${totalInventorySaleValuation.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Bs. ${(totalInventorySaleValuation * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Ganancia potencial: +$${potentialGrossMarginUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ],
      [
        'Cuentas por Cobrar Pendientes (Clientes)',
        `$${totalReceivablesPending.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Bs. ${(totalReceivablesPending * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Cobrado hasta ahora: $${totalReceivablesPaid.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
      ],
      [
        'Cuentas por Pagar Pendientes (Proveedores)',
        `$${totalPayablesPending.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Bs. ${(totalPayablesPending * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Pagado hasta ahora: $${totalPayablesPaid.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: marginLeft, right: marginRight },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // ==========================================
  // 3. COMPLETE INVENTORY CATALOG
  // ==========================================
  if (currentY > pageHeight - 45) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. CATÁLOGO COMPLETO DE INVENTARIO (${inventory.length} PRODUCTOS)`, marginLeft, currentY);
  currentY += 3;

  const inventoryBody = inventory.map((item, index) => {
    const cost = item.cost || 0;
    const price = item.price || 0;
    const stock = item.stock || 0;
    const totalVal = cost * stock;
    const unitMargin = price - cost;
    const marginPct = cost > 0 ? ((unitMargin / cost) * 100).toFixed(1) + '%' : '100%';
    const statusLabel = stock === 0 ? 'AGOTADO' : (stock <= 5 ? 'STOCK BAJO' : 'DISPONIBLE');

    return [
      (index + 1).toString(),
      item.name || 'Sin nombre',
      item.category || 'General',
      stock.toString(),
      `$${cost.toFixed(2)}`,
      `$${price.toFixed(2)}`,
      `$${totalVal.toFixed(2)}`,
      `+$${unitMargin.toFixed(2)} (${marginPct})`,
      statusLabel,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Producto', 'Categoría', 'Stock', 'Costo', 'Precio PVP', 'Valor Inv.', 'Margen Unit.', 'Estado']],
    body: inventoryBody.length > 0 ? inventoryBody : [['-', 'No hay productos registrados en inventario', '-', '-', '-', '-', '-', '-', '-']],
    foot: [
      [
        'Total',
        `${inventory.length} productos`,
        '-',
        `${totalStockUnits} unid.`,
        '-',
        '-',
        `$${totalInventoryCostValuation.toFixed(2)}`,
        `+$${potentialGrossMarginUsd.toFixed(2)}`,
        '-'
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 38 },
      2: { cellWidth: 22 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 28, halign: 'right' },
      8: { cellWidth: 20, halign: 'center' },
    },
    margin: { left: marginLeft, right: marginRight },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // ==========================================
  // 4. HISTORICAL SALES & INCOME LEDGER (Day 1 to Last)
  // ==========================================
  if (currentY > pageHeight - 45) {
    doc.addPage();
    currentY = 20;
  }

  const incomeRecords = [...records]
    .filter(r => r.type === 'ingreso')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`3. LIBRO HISTÓRICO DE VENTAS E INGRESOS (${incomeRecords.length} REGISTROS)`, marginLeft, currentY);
  currentY += 3;

  const incomeBody = incomeRecords.map((r, index) => {
    const isEur = r.currency === 'EUR';
    const rate = isEur ? bcvEur : bcvUsd;
    const amountBs = r.amountBs || (r.amount * rate);
    const amountFormatted = isEur ? `€${r.amount.toFixed(2)}` : `$${r.amount.toFixed(2)}`;
    const bsFormatted = `Bs. ${amountBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    let soldDetail = '';
    if (r.soldItems && r.soldItems.length > 0) {
      soldDetail = r.soldItems.map(s => `${s.quantity}x ${s.name} ($${s.unitPrice})`).join(', ');
    }

    return [
      (index + 1).toString(),
      formatDate(r.date),
      r.description || 'Venta',
      r.category || 'Venta',
      r.paymentMethod || 'Efectivo',
      amountFormatted,
      bsFormatted,
      soldDetail || '-'
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Fecha', 'Descripción', 'Categoría', 'Método Pago', 'Monto Divisa', 'Monto Bs.', 'Detalle Productos']],
    body: incomeBody.length > 0 ? incomeBody : [['-', '-', 'No se han registrado ventas o ingresos aún', '-', '-', '-', '-', '-']],
    foot: [
      [
        'Total',
        '-',
        `${incomeRecords.length} transacciones`,
        '-',
        '-',
        `$${totalIncomeUsd.toFixed(2)}`,
        `Bs. ${totalIncomeBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        '-'
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [16, 75, 50], // emerald-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    footStyles: {
      fillColor: [236, 253, 245],
      textColor: [6, 78, 59],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 18 },
      2: { cellWidth: 32 },
      3: { cellWidth: 18 },
      4: { cellWidth: 20 },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 26, halign: 'right' },
      7: { cellWidth: 40 },
    },
    margin: { left: marginLeft, right: marginRight },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // ==========================================
  // 5. HISTORICAL EXPENSES & PURCHASES LEDGER (Day 1 to Last)
  // ==========================================
  if (currentY > pageHeight - 45) {
    doc.addPage();
    currentY = 20;
  }

  const expenseRecords = [...records]
    .filter(r => r.type === 'egreso')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`4. LIBRO HISTÓRICO DE GASTOS Y COMPRAS (${expenseRecords.length} REGISTROS)`, marginLeft, currentY);
  currentY += 3;

  const expenseBody = expenseRecords.map((r, index) => {
    const isEur = r.currency === 'EUR';
    const rate = isEur ? bcvEur : bcvUsd;
    const amountBs = r.amountBs || (r.amount * rate);
    const amountFormatted = isEur ? `€${r.amount.toFixed(2)}` : `$${r.amount.toFixed(2)}`;
    const bsFormatted = `Bs. ${amountBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    let purchasedDetail = '';
    if (r.purchasedItems && r.purchasedItems.length > 0) {
      purchasedDetail = r.purchasedItems.map(p => `${p.quantity}x ${p.name} ($${p.unitCost})`).join(', ');
    } else if (r.supplier) {
      purchasedDetail = `Proveedor: ${r.supplier}`;
    }

    return [
      (index + 1).toString(),
      formatDate(r.date),
      r.description || 'Gasto / Compra',
      r.category || 'Gasto Operativo',
      r.paymentMethod || 'Efectivo',
      amountFormatted,
      bsFormatted,
      purchasedDetail || '-'
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Fecha', 'Descripción', 'Categoría', 'Método Pago', 'Monto Divisa', 'Monto Bs.', 'Proveedor / Detalle']],
    body: expenseBody.length > 0 ? expenseBody : [['-', '-', 'No se han registrado gastos o compras aún', '-', '-', '-', '-', '-']],
    foot: [
      [
        'Total',
        '-',
        `${expenseRecords.length} transacciones`,
        '-',
        '-',
        `$${totalExpenseUsd.toFixed(2)}`,
        `Bs. ${totalExpenseBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        '-'
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [153, 27, 27], // red-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    footStyles: {
      fillColor: [254, 242, 242],
      textColor: [153, 27, 27],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 18 },
      2: { cellWidth: 32 },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 26, halign: 'right' },
      7: { cellWidth: 38 },
    },
    margin: { left: marginLeft, right: marginRight },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // ==========================================
  // 6. ACCOUNTS RECEIVABLE & PAYABLE (CARTERA DE DEUDAS Y ABONOS)
  // ==========================================
  if (currentY > pageHeight - 45) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`5. CARTERA DE DEUDAS Y COMPROMISOS (${debts.length} REGISTROS)`, marginLeft, currentY);
  currentY += 3;

  const debtsBody = debts.map((d, index) => {
    const orig = d.amount || 0;
    const paid = (d.payments && d.payments.length > 0)
      ? d.payments.reduce((acc, p) => acc + (p.amount || 0), 0)
      : (d.paidAmount || (d.status === 'pagado' ? orig : 0));
    const pending = Math.max(0, orig - paid);

    let abonosSummary = '-';
    if (d.payments && d.payments.length > 0) {
      abonosSummary = d.payments
        .map(p => `${formatDate(p.date)}: $${p.amount.toFixed(2)} (${p.paymentMethod || 'Pago'})`)
        .join('; ');
    }

    const typeLabel = d.type === 'por_cobrar' ? 'POR COBRAR' : 'POR PAGAR';
    const statusLabel = pending <= 0.001 || d.status === 'pagado' ? 'PAGADO' : 'PENDIENTE';

    return [
      (index + 1).toString(),
      typeLabel,
      d.debtorName || 'Sin asignar',
      d.description || 'Deuda',
      `$${orig.toFixed(2)}`,
      `$${paid.toFixed(2)}`,
      `$${pending.toFixed(2)}`,
      formatDate(d.dueDate),
      statusLabel,
      abonosSummary
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Tipo', 'Deudor / Acreedor', 'Concepto', 'Monto Orig.', 'Abonado', 'Pendiente', 'Vencimiento', 'Estado', 'Historial Abonos']],
    body: debtsBody.length > 0 ? debtsBody : [['-', '-', 'No hay deudas registradas', '-', '-', '-', '-', '-', '-', '-']],
    foot: [
      [
        'Total',
        '-',
        `${debts.length} cuentas`,
        '-',
        `$${(totalReceivablesOriginal + totalPayablesOriginal).toFixed(2)}`,
        `$${(totalReceivablesPaid + totalPayablesPaid).toFixed(2)}`,
        `$${(totalReceivablesPending + totalPayablesPending).toFixed(2)}`,
        '-',
        '-',
        '-'
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [67, 56, 202], // indigo-700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    footStyles: {
      fillColor: [238, 242, 255],
      textColor: [67, 56, 202],
      fontStyle: 'bold',
      fontSize: 7,
    },
    styles: {
      fontSize: 6.5,
      cellPadding: 1.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 7 },
      1: { cellWidth: 16 },
      2: { cellWidth: 26 },
      3: { cellWidth: 24 },
      4: { cellWidth: 15, halign: 'right' },
      5: { cellWidth: 15, halign: 'right' },
      6: { cellWidth: 15, halign: 'right' },
      7: { cellWidth: 16, halign: 'center' },
      8: { cellWidth: 16, halign: 'center' },
      9: { cellWidth: 32 },
    },
    margin: { left: marginLeft, right: marginRight },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // ==========================================
  // 7. CLIENT DIRECTORY
  // ==========================================
  if (currentY > pageHeight - 45) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`6. DIRECTORIO DE CLIENTES (${clients.length} CLIENTES)`, marginLeft, currentY);
  currentY += 3;

  const clientsBody = clients.map((c, index) => {
    // calculate if this client has any active pending debt
    const clientPendingDebt = debts
      .filter(d => d.type === 'por_cobrar' && d.debtorName?.toLowerCase().trim() === c.name?.toLowerCase().trim())
      .reduce((sum, d) => {
        const orig = d.amount || 0;
        const paid = (d.payments && d.payments.length > 0)
          ? d.payments.reduce((acc, p) => acc + (p.amount || 0), 0)
          : (d.paidAmount || (d.status === 'pagado' ? orig : 0));
        return sum + Math.max(0, orig - paid);
      }, 0);

    return [
      (index + 1).toString(),
      c.name || 'Sin nombre',
      c.phone || 'No registrado',
      c.location || 'No registrada',
      c.notes || '-',
      clientPendingDebt > 0 ? `$${clientPendingDebt.toFixed(2)}` : '$0.00',
      formatDate(c.createdAt)
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Cliente', 'Teléfono / WhatsApp', 'Dirección / Zona', 'Notas / Observaciones', 'Deuda Pendiente', 'Fecha Registro']],
    body: clientsBody.length > 0 ? clientsBody : [['-', 'No hay clientes registrados en el directorio', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 35 },
      2: { cellWidth: 28 },
      3: { cellWidth: 32 },
      4: { cellWidth: 38 },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 19, halign: 'center' },
    },
    margin: { left: marginLeft, right: marginRight },
  });

  // ==========================================
  // 8. HEADER & FOOTER ON ALL PAGES
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Top small running header
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`FINOVA | Reporte Histórico Exhaustivo de la Aplicación`, marginLeft, 9);
    doc.text(`${companyName} — Emisión: ${printTimestamp}`, pageWidth - marginRight, 9, { align: 'right' });

    // Divider line at top
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.2);
    doc.line(marginLeft, 11, pageWidth - marginRight, 11);

    // Bottom running footer
    doc.line(marginLeft, pageHeight - 12, pageWidth - marginRight, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('Finova Sistema de Gestión Financiera y Control de Existencias — Confidencial', marginLeft, pageHeight - 7);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginRight, pageHeight - 7, { align: 'right' });
  }

  // Generate safe filename with clean date
  const dateFormatted = now.toISOString().split('T')[0];
  const safeCompanyName = (companyName || 'Finova').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Finova_Reporte_Completo_Historico_${safeCompanyName}_${dateFormatted}.pdf`;

  // Trigger download
  doc.save(filename);
}

/**
 * Generates an exhaustive JSON backup of all app data for complete data portability
 */
export function exportFullDataJSON(data: FullExportData): void {
  const {
    companyName = 'Finova Negocio',
    userEmail = 'Usuario',
    inventory = [],
    records = [],
    debts = [],
    clients = [],
    rates,
    selectedCurrency = 'USD'
  } = data;

  const backupObject = {
    metadata: {
      application: 'Finova App',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      companyName,
      userEmail,
      selectedCurrency,
      exchangeRates: rates,
      summary: {
        totalInventoryItems: inventory.length,
        totalFinancialRecords: records.length,
        totalDebts: debts.length,
        totalClients: clients.length,
      }
    },
    data: {
      inventory,
      records,
      debts,
      clients,
    }
  };

  const jsonString = JSON.stringify(backupObject, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateFormatted = new Date().toISOString().split('T')[0];
  link.href = url;
  link.download = `Finova_Respaldo_Completo_${dateFormatted}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
