import { ShopProfile } from '../types';

/**
 * ============================================================================
 * DUKAAN SATHI AI — STATIC UPI & QR CONFIGURATION MODULE
 * ============================================================================
 *
 * CONFIGURATION GUIDE:
 * 1. UPI ID:
 *    - Priority 1: `profile.upiId` (Configured per shop profile in localStorage)
 *    - Priority 2: `process.env.NEXT_PUBLIC_SHOP_UPI_ID` (Set in `.env.local`)
 *    - Priority 3: Fallback placeholder `'dukaan.store@upi'`
 *
 * 2. Static QR Image:
 *    - Save your shop's UPI QR code image at:
 *      `public/shop-upi-qr.png`
 *    - It will be automatically served at `/shop-upi-qr.png`.
 *    - If the image is missing, the POS UI will gracefully show an informative
 *      fallback card with the UPI ID, amount, and deep link button.
 *
 * SECURITY & HONESTY INVARIANT:
 * Static QR codes do not provide automated bank webhooks or payer identity detection.
 * Manual confirmation by the cashier must always be explicitly labeled as unverified.
 */

export const STATIC_QR_IMAGE_PATH = '/shop-upi-qr.png';
export const DEFAULT_FALLBACK_UPI_ID =
  process.env.NEXT_PUBLIC_SHOP_UPI_ID || 'dukaan.store@upi';

/**
 * Resolves the active UPI ID for the shop.
 */
export function getShopUpiId(profile?: Partial<ShopProfile> | null): string {
  if (profile?.upiId && profile.upiId.trim()) {
    return profile.upiId.trim();
  }
  if (process.env.NEXT_PUBLIC_SHOP_UPI_ID && process.env.NEXT_PUBLIC_SHOP_UPI_ID.trim()) {
    return process.env.NEXT_PUBLIC_SHOP_UPI_ID.trim();
  }
  return DEFAULT_FALLBACK_UPI_ID;
}

/**
 * Constructs a standard NPCI / UPI payment URI.
 * Format: upi://pay?pa={upiId}&pn={payeeName}&am={amount}&cu=INR&tn={note}
 *
 * Works with mobile UPI apps (Google Pay, PhonePe, Paytm, BHIM, Navi, etc.)
 */
export function buildUpiPaymentUri(params: {
  upiId: string;
  payeeName: string;
  amount: number;
  transactionNote?: string;
}): string {
  const { upiId, payeeName, amount, transactionNote } = params;
  const cleanUpiId = upiId.trim();
  const cleanPayee = (payeeName || 'Store Merchant').trim();
  const formattedAmount = Math.max(0, amount).toFixed(2);
  const note = (transactionNote || `Bill at ${cleanPayee}`).trim();

  const queryParams = new URLSearchParams({
    pa: cleanUpiId,
    pn: cleanPayee,
    am: formattedAmount,
    cu: 'INR',
    tn: note,
  });

  return `upi://pay?${queryParams.toString()}`;
}
