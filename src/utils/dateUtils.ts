/**
 * Date Utilities for Finova
 * Guarantees local-time parsing and formatting without UTC timezone drift.
 */

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateSafe(rawDate: string | undefined | null): {
  year: number;
  month: number;
  day: number;
  formatted: string;
} {
  if (!rawDate || typeof rawDate !== 'string') {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      formatted: getLocalDateString(now),
    };
  }

  // Handle YYYY-MM-DD or strings containing date portions
  const clean = rawDate.split('T')[0].replace(/\//g, '-').trim();
  const parts = clean.split('-');
  if (parts.length >= 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const padM = String(m).padStart(2, '0');
      const padD = String(d).padStart(2, '0');
      return {
        year: y,
        month: m,
        day: d,
        formatted: `${y}-${padM}-${padD}`,
      };
    }
  }

  // Fallback: Date constructor
  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    const d = parsed.getDate();
    const padM = String(m).padStart(2, '0');
    const padD = String(d).padStart(2, '0');
    return {
      year: y,
      month: m,
      day: d,
      formatted: `${y}-${padM}-${padD}`,
    };
  }

  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    formatted: getLocalDateString(now),
  };
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const MONTH_SHORT_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export const WEEKDAYS_SHORT_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
