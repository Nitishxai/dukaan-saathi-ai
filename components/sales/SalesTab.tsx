'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  ShoppingCart,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Search,
  User,
  Banknote,
  Receipt,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Edit2,
  ShieldAlert,
  Smartphone,
  Package,
  X,
  Sparkles,
} from 'lucide-react';
import { Product, SaleItem, PaymentMode, Customer, Sale, ShopProfile } from '../../types';
import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
  useIsMounted,
} from '../../lib/formatters';
import { recordSale, getActiveProfile, updateShopProfile, loadDemoShop, roundPrecision } from '../../lib/storage';
import {
  getShopUpiId,
  buildUpiPaymentUri,
  STATIC_QR_IMAGE_PATH,
} from '../../lib/upi-config';
import {
  resolveShopBusinessType,
  getBusinessTypeConfig,
  getQuickQuantityPresets,
  getVariantLabel,
  getBusinessTypeTheme,
} from '../../lib/business-config';
import { TabType } from '../layout/Navigation';

interface SalesTabProps {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  onRefresh: () => void;
  onOpenAddCustomer?: () => void;
  profile?: ShopProfile;
  onNavigate?: (tab: TabType) => void;
}

export const SalesTab: React.FC<SalesTabProps> = ({
  products,
  customers,
  sales,
  onRefresh,
  profile,
  onNavigate,
}) => {
  const isMounted = useIsMounted();
  // Active Profile (for UPI ID & Shop Name)
  const activeProfile = profile || getActiveProfile();
  const businessType = resolveShopBusinessType(activeProfile);
  const businessConfig = getBusinessTypeConfig(businessType, activeProfile?.customBusinessType);
  const theme = getBusinessTypeTheme(businessType);
  const variantLabel = getVariantLabel(businessType);

  // POS Billing State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<string>('1');
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Static UPI QR & Payment State
  const [upiPaymentStatus, setUpiPaymentStatus] = useState<'pending' | 'manually_confirmed'>('pending');
  const [qrImageError, setQrImageError] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isEditingUpiId, setIsEditingUpiId] = useState<boolean>(false);
  const [customUpiId, setCustomUpiId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  // Configured & Active UPI ID
  const configuredUpiId = getShopUpiId(activeProfile);
  const activeUpiId = customUpiId.trim() || configuredUpiId;

  // Search & Category Filters
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Extract distinct categories from inventory
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set);
  }, [products]);

  // Selected Product Details
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Filtered available products for quick picker and dropdown
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.category?.trim() !== selectedCategory) {
        return false;
      }
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase().trim();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.hindiName && p.hindiName.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        (p.brandOrVariant && p.brandOrVariant.toLowerCase().includes(q)) ||
        (p.modelNumber && p.modelNumber.toLowerCase().includes(q)) ||
        (p.size && p.size.toLowerCase().includes(q)) ||
        (p.color && p.color.toLowerCase().includes(q)) ||
        (p.batchNumber && p.batchNumber.toLowerCase().includes(q)) ||
        (p.warranty && p.warranty.toLowerCase().includes(q))
      );
    });
  }, [products, searchFilter, selectedCategory]);

  // Helper checks
  const isOutOfStock = (p: Product) => p.currentStock !== null && p.currentStock <= 0;
  const isUntracked = (p: Product) => p.currentStock === null;
  const isUnpriced = (p: Product) => p.sellingPrice === null || p.sellingPrice <= 0;

  // Calculate Cart Total
  const cartTotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
  }, [cartItems]);

  // Construct standard NPCI UPI payment deep link URI
  const upiPaymentUri = useMemo(() => {
    if (paymentMode !== 'online' || cartTotal <= 0) return '';
    return buildUpiPaymentUri({
      upiId: activeUpiId,
      payeeName: activeProfile?.shopName || 'Store Merchant',
      amount: cartTotal,
      transactionNote: `Bill at ${activeProfile?.shopName || 'Store'}`,
    });
  }, [paymentMode, cartTotal, activeUpiId, activeProfile?.shopName]);

  const handleSaveUpiId = () => {
    if (customUpiId.trim()) {
      updateShopProfile({ upiId: customUpiId.trim() });
      setIsEditingUpiId(false);
      onRefresh();
    }
  };

  const handleCopyUpiId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(activeUpiId);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleSelectPaymentMode = (mode: PaymentMode) => {
    setPaymentMode(mode);
    setErrorMessage(null);
    if (mode === 'online') {
      setUpiPaymentStatus('pending');
    }
  };

  // Add Item to Bill / Cart
  const handleAddToCart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!selectedProduct) {
      setErrorMessage('Please select a product first.');
      return;
    }

    if (isUnpriced(selectedProduct)) {
      setErrorMessage(`Selling price is not set for "${selectedProduct.name}". Please set a price in the Inventory tab first.`);
      return;
    }

    if (isOutOfStock(selectedProduct)) {
      setErrorMessage(`"${selectedProduct.name}" is out of stock (0 ${selectedProduct.unit} available). Restock in Inventory first.`);
      return;
    }

    const qty = parseFloat(itemQuantity);
    if (isNaN(qty) || qty <= 0) {
      setErrorMessage('Valid product quantity is required.');
      return;
    }

    // Check if already in cart
    const existingIndex = cartItems.findIndex((i) => i.productId === selectedProduct.id);
    const currentCartQty = existingIndex > -1 ? cartItems[existingIndex].quantity : 0;
    const requestedTotalQty = currentCartQty + qty;

    // VALIDATION: Prevent sales that exceed available stock (ONLY for tracked items!)
    if (selectedProduct.currentStock !== null && requestedTotalQty > selectedProduct.currentStock) {
      setErrorMessage(
        `Insufficient stock! Only ${selectedProduct.currentStock} ${selectedProduct.unit} available for ${selectedProduct.name} (already in bill: ${currentCartQty}).`
      );
      return;
    }

    const sellingPrice = selectedProduct.sellingPrice!;
    const cleanQty = roundPrecision(qty, 3);
    const itemTotal = Number((sellingPrice * cleanQty).toFixed(2));

    if (existingIndex > -1) {
      const updated = [...cartItems];
      const cleanRequestedTotal = roundPrecision(requestedTotalQty, 3);
      updated[existingIndex].quantity = cleanRequestedTotal;
      updated[existingIndex].totalPrice = Number(
        (sellingPrice * cleanRequestedTotal).toFixed(2)
      );
      setCartItems(updated);
    } else {
      const newItem: SaleItem = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        unit: selectedProduct.unit,
        quantity: cleanQty,
        unitPrice: sellingPrice,
        totalPrice: itemTotal,
      };
      setCartItems([...cartItems, newItem]);
    }

    // Reset quantity input to default 1
    setItemQuantity('1');
    setErrorMessage(null);
  };

  // Quick 1-tap add from product cards
  const handleDirectAdd = (product: Product, qty: number = 1) => {
    setErrorMessage(null);

    if (isUnpriced(product)) {
      setErrorMessage(`Selling price is not set for "${product.name}". Please set a price in the Inventory tab first.`);
      return;
    }

    if (isOutOfStock(product)) {
      setErrorMessage(`"${product.name}" is out of stock! Restock in Inventory first.`);
      return;
    }

    const existingIndex = cartItems.findIndex((i) => i.productId === product.id);
    const currentCartQty = existingIndex > -1 ? cartItems[existingIndex].quantity : 0;
    const requestedTotalQty = currentCartQty + qty;

    // VALIDATION: Stock check ONLY if stock is tracked (not null)
    if (product.currentStock !== null && requestedTotalQty > product.currentStock) {
      setErrorMessage(
        `Insufficient stock! Only ${product.currentStock} ${product.unit} available for ${product.name}.`
      );
      return;
    }

    const sellingPrice = product.sellingPrice!;
    const cleanQty = roundPrecision(qty, 3);

    if (existingIndex > -1) {
      const updated = [...cartItems];
      const cleanRequestedTotal = roundPrecision(requestedTotalQty, 3);
      updated[existingIndex].quantity = cleanRequestedTotal;
      updated[existingIndex].totalPrice = Number(
        (sellingPrice * cleanRequestedTotal).toFixed(2)
      );
      setCartItems(updated);
    } else {
      const newItem: SaleItem = {
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: cleanQty,
        unitPrice: sellingPrice,
        totalPrice: Number((sellingPrice * cleanQty).toFixed(2)),
      };
      setCartItems([...cartItems, newItem]);
    }
  };

  // Remove from cart
  const handleRemoveFromCart = (productId: string) => {
    setCartItems(cartItems.filter((i) => i.productId !== productId));
  };

  // Finalize Sale
  const handleConfirmSale = () => {
    if (isSubmittingRef.current || isSubmitting) return;
    setErrorMessage(null);

    if (cartItems.length === 0) {
      setErrorMessage('Bill must contain at least 1 item.');
      return;
    }

    if (paymentMode === 'udhaar' && !selectedCustomerId) {
      setErrorMessage('Please select a customer for credit (udhaar) sale.');
      return;
    }

    // CRITICAL STOCK & PAYMENT SAFETY (Requirement 7):
    // Do NOT call recordSale() for a pending UPI payment.
    // Sale is finalized and stock is deducted only after explicit cashier manual confirmation.
    if (paymentMode === 'online' && upiPaymentStatus !== 'manually_confirmed') {
      setErrorMessage(
        'UPI payment is pending. Please verify incoming funds via soundbox or merchant SMS and click "Mark Manually Confirmed" before completing the bill.'
      );
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const upiNotesSuffix =
        paymentMode === 'online'
          ? ` [UPI Static QR - Manual Cashier Confirmation (Unverified)${activeUpiId ? ` • VPA: ${activeUpiId}` : ''}]`
          : '';

      const res = recordSale({
        items: cartItems,
        paymentMode,
        customerId: paymentMode === 'udhaar' ? selectedCustomerId : undefined,
        notes: (notes.trim() + upiNotesSuffix).trim() || undefined,
        upiId: paymentMode === 'online' ? activeUpiId : undefined,
        paymentStatus: paymentMode === 'online' ? 'manually_confirmed' : 'completed',
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to record sale.');
        return;
      }

      // Success! Show receipt and clear cart
      setCompletedSale(res.sale || null);
      setCartItems([]);
      setSelectedProductId('');
      setItemQuantity('1');
      setNotes('');
      setUpiPaymentStatus('pending');
      onRefresh();
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            New Bill & Sales (Point of Sale)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Create store counter bills • Stock is automatically deducted
          </p>
        </div>
      </div>

      {/* POS Billing Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT / TOP SECTION: Item Selection (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {products.length === 0 ? (
            /* Empty Inventory State Card */
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <Package className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                  No Products in Inventory Yet
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  Your store inventory is currently empty. Add your products in the Inventory tab to start billing, or load the sample Kirana store demo products to test the POS checkout.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('inventory')}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Package className="w-4 h-4" />
                    <span>Go to Inventory (Add Products)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    loadDemoShop();
                    onRefresh();
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Load Demo Kirana Store</span>
                </button>
              </div>
            </div>
          ) : (
            /* Item Selector Card */
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-emerald-600" />
                  <span>Select Product</span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}>
                    {businessConfig.shortLabel}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {products.length} {products.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>

              {/* Product Search */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Search by product name, brand, or category
                  </label>
                  {searchFilter && (
                    <button
                      type="button"
                      onClick={() => setSearchFilter('')}
                      className="text-[11px] text-emerald-700 hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear search</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={`Search (e.g. ${businessConfig.starterItems.slice(0, 3).map((i) => i.name).join(', ')})...`}
                    className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800"
                  />
                </div>
              </div>

              {/* Category Filter Chips */}
              {categories.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 cursor-pointer ${
                        selectedCategory === 'all'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All ({products.length})
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Fast-Tap Product Cards */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                  <span>Quick Tap ({filteredProducts.length}):</span>
                  <span className="text-[11px] text-slate-400">Click to add 1 unit directly</span>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500 space-y-1.5">
                    <p>No products found matching &quot;{searchFilter}&quot;.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchFilter('');
                        setSelectedCategory('all');
                      }}
                      className="text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Reset Search &amp; Category Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                    {filteredProducts.slice(0, 18).map((p) => {
                      const isOut = isOutOfStock(p);
                      const isUnrec = isUntracked(p);
                      const isNoPrice = isUnpriced(p);
                      const isSelected = selectedProductId === p.id;

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProductId(p.id);
                            if (isNoPrice) {
                              setErrorMessage(`Selling price is not set for "${p.name}". Please set a price in the Inventory tab first.`);
                              return;
                            }
                            if (isOut) {
                              setErrorMessage(`"${p.name}" is out of stock (0 ${p.unit} available). Restock in Inventory tab first.`);
                              return;
                            }
                            handleDirectAdd(p, 1);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all relative cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-500 shadow-2xs ring-1 ring-emerald-500'
                              : isOut
                              ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                              : isNoPrice
                              ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                              : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/50 shadow-2xs'
                          }`}
                        >
                          <div className="font-semibold text-slate-900 text-xs truncate">
                            {p.name}
                          </div>
                          {(() => {
                            const hasPharmacy = p.batchNumber || p.expiryDate;
                            const hasClothing = p.size || p.color;
                            const hasElectronics = p.modelNumber || p.warranty;

                            if (!p.brandOrVariant && !hasPharmacy && !hasClothing && !hasElectronics) {
                              return null;
                            }

                            return (
                              <div className="flex flex-wrap items-center gap-1 my-0.5">
                                {p.brandOrVariant && (
                                  <span className="text-[10px] text-slate-600 font-medium truncate max-w-full">
                                    <span className="text-slate-400 font-normal">{variantLabel}: </span>
                                    {p.brandOrVariant}
                                  </span>
                                )}
                                {hasPharmacy && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {p.batchNumber && (
                                      <span className="text-[9px] font-mono px-1 py-0.2 bg-purple-50 text-purple-800 border border-purple-200 rounded">
                                        B:{p.batchNumber}
                                      </span>
                                    )}
                                    {p.expiryDate && (
                                      <span className="text-[9px] font-medium px-1 py-0.2 bg-amber-50 text-amber-900 border border-amber-200 rounded">
                                        Exp:{p.expiryDate}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {hasClothing && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {p.size && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded uppercase">
                                        {p.size}
                                      </span>
                                    )}
                                    {p.color && (
                                      <span className="text-[9px] font-medium px-1 py-0.2 bg-slate-100 text-slate-700 border border-slate-200 rounded">
                                        {p.color}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {hasElectronics && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {p.modelNumber && (
                                      <span className="text-[9px] font-mono px-1 py-0.2 bg-sky-50 text-sky-900 border border-sky-200 rounded">
                                        {p.modelNumber}
                                      </span>
                                    )}
                                    {p.warranty && (
                                      <span className="text-[9px] font-medium px-1 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                                        {p.warranty}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <div className="flex items-center justify-between mt-1 text-[11px]">
                            <span className={`font-bold ${isNoPrice ? 'text-amber-700 text-[10px]' : 'text-emerald-700'}`}>
                              {p.sellingPrice !== null ? formatCurrency(p.sellingPrice) : 'No price set'}
                            </span>
                            <span
                              className={`font-medium text-[10px] px-1.5 py-0.5 rounded-md ${
                                isOut
                                  ? 'bg-red-50 text-red-700 font-bold'
                                  : isUnrec
                                  ? 'bg-slate-100 text-slate-600'
                                  : p.currentStock !== null && p.currentStock <= p.minStockAlert
                                  ? 'bg-amber-100 text-amber-800 font-bold'
                                  : 'text-slate-500'
                              }`}
                            >
                              {isOut
                                ? 'Out of Stock'
                                : isUnrec
                                ? 'Untracked'
                                : `${p.currentStock} ${p.unit}`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Item Custom Quantity Form */}
              <div className="pt-3 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Selected Product
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        setErrorMessage(null);
                      }}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800"
                    >
                      <option value="">-- Select Product ({filteredProducts.length} available) --</option>
                      {filteredProducts.map((p) => {
                        const isOut = isOutOfStock(p);
                        const isUnrec = isUntracked(p);
                        const isNoPrice = isUnpriced(p);

                        let statusTag = '';
                        if (isNoPrice) {
                          statusTag = ' [⚠️ Price Not Set]';
                        } else if (isOut) {
                          statusTag = ' [Out of Stock]';
                        } else if (isUnrec) {
                          statusTag = ' [Stock: Untracked]';
                        } else {
                          statusTag = ` (${p.currentStock} ${p.unit} in stock)`;
                        }

                        const variantDetails = [
                          p.brandOrVariant,
                          p.size ? `Size: ${p.size}` : null,
                          p.color,
                          p.modelNumber ? `Mod: ${p.modelNumber}` : null,
                          p.batchNumber ? `Batch: ${p.batchNumber}` : null,
                          p.expiryDate ? `Exp: ${p.expiryDate}` : null,
                        ]
                          .filter(Boolean)
                          .join(', ');

                        const variantText = variantDetails ? ` (${variantDetails})` : '';
                        const priceText = p.sellingPrice !== null ? `${formatCurrency(p.sellingPrice)}/${p.unit}` : 'Price not set';

                        return (
                          <option key={p.id} value={p.id}>
                            {p.name}{variantText} — {priceText}{statusTag}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Quantity ({selectedProduct ? `in ${selectedProduct.unit}` : 'Qty'})
                    </label>
                    <input
                      type="number"
                      step={
                        selectedProduct &&
                        ['kg', 'litre', 'gm', 'g', 'ml', 'meter', 'metre'].includes(
                          selectedProduct.unit.toLowerCase()
                        )
                          ? 'any'
                          : '1'
                      }
                      min={
                        selectedProduct &&
                        ['kg', 'litre', 'gm', 'g', 'ml', 'meter', 'metre'].includes(
                          selectedProduct.unit.toLowerCase()
                        )
                          ? '0.1'
                          : '1'
                      }
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-slate-800"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    {(() => {
                      const isAddDisabled =
                        !selectedProduct ||
                        isUnpriced(selectedProduct) ||
                        isOutOfStock(selectedProduct);

                      const btnLabel = !selectedProduct
                        ? '+ Add to Bill'
                        : isUnpriced(selectedProduct)
                        ? 'Price Not Set'
                        : isOutOfStock(selectedProduct)
                        ? 'Out of Stock'
                        : '+ Add to Bill';

                      return (
                        <button
                          type="button"
                          disabled={isAddDisabled}
                          onClick={() => handleAddToCart()}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition-colors shadow-xs ${
                            isAddDisabled
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                          }`}
                          title={!selectedProduct ? 'Please select a product first' : btnLabel}
                        >
                          {btnLabel}
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {/* Status feedback & inventory hints for selected product */}
                {selectedProduct && isUnpriced(selectedProduct) && (
                  <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      Selling price is not set for &quot;{selectedProduct.name}&quot;.
                    </span>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('inventory')}
                        className="text-emerald-700 font-bold hover:underline shrink-0 cursor-pointer"
                      >
                        Set Price in Inventory →
                      </button>
                    )}
                  </div>
                )}

                {selectedProduct && isOutOfStock(selectedProduct) && (
                  <div className="mt-2.5 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      &quot;{selectedProduct.name}&quot; is currently out of stock (0 {selectedProduct.unit}).
                    </span>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('inventory')}
                        className="text-red-800 font-bold hover:underline shrink-0 cursor-pointer"
                      >
                        Restock in Inventory →
                      </button>
                    )}
                  </div>
                )}

                {selectedProduct && isUntracked(selectedProduct) && !isUnpriced(selectedProduct) && (
                  <div className="mt-2.5 p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Stock tracking:</span>
                    <span>Untracked / unrecorded (can sell any quantity)</span>
                  </div>
                )}

                {/* Quantity Preset Chips */}
                {selectedProduct && !isUnpriced(selectedProduct) && !isOutOfStock(selectedProduct) && (
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    <span className="text-[11px] text-slate-400">Quick Qty:</span>
                    {getQuickQuantityPresets(selectedProduct.unit).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setItemQuantity(preset.toString())}
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
                      >
                        {preset} {selectedProduct.unit}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SECTION: Cart / Active Bill & Checkout (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Active Bill
                  </h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Error banner if any */}
              {errorMessage && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Cart Items List */}
              <div className="mt-3 divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {cartItems.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">
                      {products.length === 0
                        ? 'Inventory is empty. Add products to begin billing.'
                        : 'Bill is empty. Select products from the left to add.'}
                    </p>
                  </div>
                ) : (
                  cartItems.map((item) => {
                    const prod = products.find((p) => p.id === item.productId);
                    const variantParts = [
                      prod?.brandOrVariant,
                      prod?.size ? `Size: ${prod.size}` : null,
                      prod?.color,
                      prod?.modelNumber ? `Mod: ${prod.modelNumber}` : null,
                      prod?.batchNumber ? `Batch: ${prod.batchNumber}` : null,
                    ].filter(Boolean);

                    return (
                      <div key={item.productId} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 text-xs sm:text-sm truncate">
                            {item.productName}
                          </div>
                          {variantParts.length > 0 && (
                            <div className="text-[10px] text-slate-500 truncate">
                              {variantParts.join(' • ')}
                            </div>
                          )}
                          <div className="text-xs text-slate-500">
                            {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}
                          </div>
                        </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          {formatCurrency(item.totalPrice)}
                        </span>
                        <button
                          onClick={() => handleRemoveFromCart(item.productId)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              </div>

              {/* Grand Total Bar */}
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-700 text-sm">Total Amount</span>
                <span className="font-extrabold text-xl sm:text-2xl text-emerald-700">
                  {formatCurrency(cartTotal)}
                </span>
              </div>

              {/* Payment Mode Selector */}
              <div className="mt-4 space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMode('cash')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMode === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMode('online')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMode === 'online'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>UPI / QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMode('udhaar')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMode === 'udhaar'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>Credit / Udhaar</span>
                  </button>
                </div>
              </div>

              {/* UPI Static QR Code & Verification Panel */}
              {paymentMode === 'online' && (
                <div className="mt-3 p-3.5 sm:p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-3 animate-in fade-in">
                  {/* Panel Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-blue-200/60">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-600 text-white rounded-lg shrink-0">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Static UPI QR Payment</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                            Scan &amp; Pay
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Customer scans shop QR or pays via UPI app
                        </p>
                      </div>
                    </div>
                    {/* Bill Amount Pill */}
                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Bill Total
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-blue-800">
                        {formatCurrency(cartTotal)}
                      </span>
                    </div>
                  </div>

                  {/* QR Image & Details Box */}
                  <div className="flex flex-col sm:flex-row items-center gap-3.5 bg-white p-3 rounded-xl border border-blue-100">
                    {/* QR Code Container */}
                    <div className="relative w-36 h-36 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {!qrImageError ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={STATIC_QR_IMAGE_PATH}
                          alt="Shop UPI QR Code"
                          className="w-full h-full object-contain p-1"
                          onError={() => setQrImageError(true)}
                        />
                      ) : (
                        <div className="p-2 text-center flex flex-col items-center justify-center text-slate-400 h-full">
                          <QrCode className="w-8 h-8 text-slate-300 mb-1" />
                          <p className="text-[10px] font-semibold text-slate-600 leading-tight">
                            QR Image Not Found
                          </p>
                          <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">
                            Place your file at<br />
                            <code className="text-[9px] bg-slate-100 px-1 py-0.5 rounded text-slate-600">
                              public/shop-upi-qr.png
                            </code>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* UPI ID & Intent Actions */}
                    <div className="flex-1 w-full space-y-2.5 text-left">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                          Shop UPI ID (Payee VPA)
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {!isEditingUpiId ? (
                            <>
                              <code className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md break-all">
                                {activeUpiId}
                              </code>
                              <button
                                type="button"
                                onClick={handleCopyUpiId}
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="Copy UPI ID"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomUpiId(activeUpiId);
                                  setIsEditingUpiId(true);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                                title="Edit shop UPI ID"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1 w-full mt-1">
                              <input
                                type="text"
                                value={customUpiId}
                                onChange={(e) => setCustomUpiId(e.target.value)}
                                placeholder="e.g. shopkeeper@upi"
                                className="px-2 py-1 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-full font-mono"
                              />
                              <button
                                type="button"
                                onClick={handleSaveUpiId}
                                className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold shrink-0"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsEditingUpiId(false)}
                                className="px-2 py-1 text-slate-500 text-xs shrink-0"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Deep Link to Open UPI Apps */}
                      <div>
                        <a
                          href={upiPaymentUri || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (!upiPaymentUri || cartTotal <= 0) {
                              e.preventDefault();
                              setErrorMessage('Bill total must be greater than zero to open UPI payment.');
                            }
                          }}
                          className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs cursor-pointer text-center"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Open in UPI App ({formatCurrency(cartTotal)})</span>
                          <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                        </a>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Compatible with Google Pay, PhonePe, Paytm, BHIM on mobile.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Explicit Honesty & Static QR Notice (Requirements 5 & 6) */}
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">Static QR Notice:</strong> Static QR codes cannot automatically verify incoming bank payments or detect payer identity. The cashier must verify the incoming credit alert on their soundbox, SMS, or merchant app before finalizing the sale.
                    </div>
                  </div>

                  {/* Cashier Payment Status & Manual Confirmation Control */}
                  <div className="pt-2 border-t border-blue-200/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Payment Verification Status
                        </span>
                        <span
                          className={`text-xs font-bold inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mt-0.5 ${
                            upiPaymentStatus === 'manually_confirmed'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {upiPaymentStatus === 'manually_confirmed' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />
                              <span>Manually Confirmed (Unverified)</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              <span>Pending Cashier Verification</span>
                            </>
                          )}
                        </span>
                      </div>

                      {upiPaymentStatus === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setUpiPaymentStatus('manually_confirmed');
                            setErrorMessage(null);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Manually Confirmed</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setUpiPaymentStatus('pending')}
                          className="px-2.5 py-1 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                        >
                          Revert to Pending
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Selector if Udhaar is selected */}
              {paymentMode === 'udhaar' && (
                <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-200 animate-in fade-in">
                  <label className="block text-xs font-bold text-red-900 mb-1">
                    Select Customer for Credit Account *
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none font-semibold text-slate-800"
                  >
                    <option value="">-- Select Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Balance: {formatCurrency(c.currentBalance)})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-red-700 mt-1">
                    This amount will be added to the customer&apos;s credit ledger.
                  </p>
                </div>
              )}

              {/* Optional Notes */}
              <div className="mt-3">
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes / comments (optional, e.g. PhonePe transaction reference)"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Confirm Sale Button & Critical Stock Safety Guard (Requirement 7) */}
            <div className="mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={
                  cartItems.length === 0 ||
                  isSubmitting ||
                  (paymentMode === 'online' && upiPaymentStatus !== 'manually_confirmed')
                }
                onClick={handleConfirmSale}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center space-x-2 ${
                  cartItems.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : paymentMode === 'online' && upiPaymentStatus !== 'manually_confirmed'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed opacity-90'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Recording Sale...</span>
                  </>
                ) : paymentMode === 'online' && upiPaymentStatus !== 'manually_confirmed' ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>Payment Pending — Verify &amp; Confirm Above</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Sale ({formatCurrency(cartTotal)})</span>
                  </>
                )}
              </button>

              {paymentMode === 'online' && upiPaymentStatus !== 'manually_confirmed' && cartItems.length > 0 && (
                <p className="text-[11px] text-amber-700 text-center mt-1.5 font-medium">
                  Stock will only be deducted after you manually confirm receipt of payment.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bill Success / Receipt Modal */}
      {completedSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Sale Recorded Successfully!</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Invoice No: <span className="font-bold text-slate-800">{completedSale.invoiceNo}</span>
            </p>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1.5">
              <div className="flex justify-between font-bold text-slate-800 text-sm pb-1 border-b border-slate-200">
                <span>Total Amount</span>
                <span className="text-emerald-700">{formatCurrency(completedSale.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Payment:</span>
                <span className="font-semibold capitalize">
                  {completedSale.paymentMode === 'cash'
                    ? 'Cash'
                    : completedSale.paymentMode === 'online'
                    ? 'UPI / Online'
                    : `Credit (${completedSale.customerName})`}
                </span>
              </div>

              {completedSale.paymentMode === 'online' && (
                <>
                  {completedSale.upiId && (
                    <div className="flex justify-between text-slate-600">
                      <span>UPI ID:</span>
                      <span className="font-mono text-[11px] text-slate-800">{completedSale.upiId}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-slate-100">
                    <span>Verification:</span>
                    <span className="text-amber-800 font-medium text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Manual Confirmation (Unverified)
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Items:</span>
                <span>{completedSale.items.length} items</span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setCompletedSale(null)}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                Create Next Bill (Done)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales History List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-3">
          Recent Sales History
        </h3>

        <div className="divide-y divide-slate-100">
          {sales.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No sales recorded yet.</p>
          ) : (
            sales.slice(0, 10).map((sale) => (
              <div key={sale.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-800 text-xs sm:text-sm">
                      {sale.invoiceNo}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sale.paymentMode === 'cash'
                          ? 'bg-emerald-100 text-emerald-800'
                          : sale.paymentMode === 'online'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {sale.paymentMode === 'cash'
                        ? 'Cash'
                        : sale.paymentMode === 'online'
                        ? 'UPI (Manual)'
                        : `Credit: ${sale.customerName}`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    {sale.items
                      .map((i) => `${i.productName} (${i.quantity} ${i.unit})`)
                      .join(', ')}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold text-slate-900 text-xs sm:text-sm">
                    {formatCurrency(sale.totalAmount)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5" suppressHydrationWarning>
                    {isMounted ? formatRelativeDate(sale.createdAt) : formatDate(sale.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
