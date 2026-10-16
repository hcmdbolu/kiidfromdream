/**
 * Robust Date Utilities for KIID FROM DREAM POS
 * Standardizes date extraction, local formatting, and range matching across
 * sales, refunds, drawers, transfers, and executive reports.
 */

export const getLocalDateString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const extractDateKey = (dateStr?: string | null): string => {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  // 1. ISO format: "YYYY-MM-DD"
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Slash format: "MM/DD/YYYY" or "DD/MM/YYYY" (from toLocaleString)
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const part1 = parseInt(slashMatch[1], 10);
    const part2 = parseInt(slashMatch[2], 10);
    const y = slashMatch[3];
    // If first part > 12, it must be DD/MM/YYYY
    if (part1 > 12) {
      const m = String(part2).padStart(2, '0');
      const d = String(part1).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // Standard US MM/DD/YYYY
    const m = String(part1).padStart(2, '0');
    const d = String(part2).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 3. Fallback: Parse via Date object
  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch {}

  const cleanFirst = trimmed.split(/[\s,T]+/)[0];
  return cleanFirst || '';
};

export type StandardDateRange = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export const matchesDateRange = (
  dateStr?: string | null,
  dateRange: string = 'all',
  customStartDate?: string,
  customEndDate?: string
): boolean => {
  if (dateRange === 'all') return true;
  if (!dateStr) return false;
  const dateKey = extractDateKey(dateStr);
  if (!dateKey) return false;

  const todayDate = new Date();
  const todayKey = getLocalDateString(todayDate);

  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = getLocalDateString(yesterdayDate);

  if (dateRange === 'today') {
    return dateKey === todayKey;
  }
  if (dateRange === 'yesterday') {
    return dateKey === yesterdayKey;
  }
  if (dateRange === 'week') {
    const weekStartDate = new Date(todayDate);
    weekStartDate.setDate(weekStartDate.getDate() - 6);
    const weekStartKey = getLocalDateString(weekStartDate);
    return dateKey >= weekStartKey && dateKey <= todayKey;
  }
  if (dateRange === 'month') {
    const currentMonthPrefix = todayKey.slice(0, 7);
    return dateKey.startsWith(currentMonthPrefix);
  }
  if (dateRange === 'custom') {
    if (!customStartDate && !customEndDate) return true;
    if (customStartDate && dateKey < customStartDate) return false;
    if (customEndDate && dateKey > customEndDate) return false;
    return true;
  }
  return true;
};
