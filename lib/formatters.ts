import { useSyncExternalStore } from 'react';
import { UnitType } from '../types';

export const UNIT_LABELS: Record<string, { hindi: string; en: string }> = {
  kg: { hindi: 'kg (Kilogram)', en: 'kg' },
  gm: { hindi: 'gm (Gram)', en: 'gm' },
  g: { hindi: 'g (Gram)', en: 'g' },
  litre: { hindi: 'litre (L)', en: 'litre' },
  ml: { hindi: 'ml (Millilitre)', en: 'ml' },
  packet: { hindi: 'packet (pkt)', en: 'packet' },
  piece: { hindi: 'piece (pc)', en: 'piece' },
  strip: { hindi: 'strip (पत्ता)', en: 'strip' },
  tablet: { hindi: 'tablet (गोली)', en: 'tablet' },
  bottle: { hindi: 'bottle (शीशी)', en: 'bottle' },
  box: { hindi: 'box (डिब्बा)', en: 'box' },
  pack: { hindi: 'pack (पैक)', en: 'pack' },
  pair: { hindi: 'pair (जोड़ी)', en: 'pair' },
  set: { hindi: 'set (सेट)', en: 'set' },
  crate: { hindi: 'crate (क्रेट)', en: 'crate' },
  bori: { hindi: 'sack / bori (बोरी)', en: 'sack' },
  bag: { hindi: 'bag (थैला / बैग)', en: 'bag' },
  dozen: { hindi: 'dozen (दर्जन)', en: 'dozen' },
  metre: { hindi: 'metre (मीटर)', en: 'metre' },
  can: { hindi: 'can (केन)', en: 'can' },
  tube: { hindi: 'tube (ट्यूब)', en: 'tube' },
  bunch: { hindi: 'bunch (गुच्छी)', en: 'bunch' },
};

export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  // Indian number format (e.g., 1,50,000)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('en-IN').format(val);
}

export function formatQuantity(qty: number, unit: UnitType): string {
  if (qty === null || qty === undefined || isNaN(qty)) return `0 ${unit}`;
  const formattedVal = Number.isInteger(qty)
    ? qty.toString()
    : parseFloat(qty.toFixed(3)).toString();
  const unitLabel = UNIT_LABELS[unit]?.en || unit;
  return `${formattedVal} ${unitLabel}`;
}

export function formatQuantityWithHindi(qty: number, unit: UnitType): string {
  if (qty === null || qty === undefined || isNaN(qty)) return `0 ${unit}`;
  const formattedVal = Number.isInteger(qty)
    ? qty.toString()
    : parseFloat(qty.toFixed(3)).toString();
  const unitLabel = UNIT_LABELS[unit]?.en || unit;
  return `${formattedVal} ${unitLabel}`;
}

/**
 * Deterministic date formatting with explicit locale and Asia/Kolkata timezone
 */
export function formatDate(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Deterministic time formatting with explicit locale and Asia/Kolkata timezone
 */
export function formatTime(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Relative date formatter (Today / Yesterday / Date)
 */
export function formatRelativeDate(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    const timeStr = formatTime(isoString);

    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;

    return formatDate(isoString);
  } catch {
    return isoString;
  }
}

const emptySubscribe = () => () => {};

/**
 * Client hydration detection hook.
 * Returns false during SSR and initial hydration, and true after mounting.
 * Used to defer relative date rendering until after hydration is complete.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
