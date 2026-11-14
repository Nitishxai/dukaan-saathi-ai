'use client';

import React, { useMemo } from 'react';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  BookOpen,
  PlusCircle,
  ShoppingCart,
  Bot,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ChevronRight,
  Store,
} from 'lucide-react';
import { DukaanStoreData, Product } from '../../types';
import {
  formatCurrency,
  formatQuantity,
  formatDate,
  formatRelativeDate,
  useIsMounted,
} from '../../lib/formatters';
import { quickAddStock, calculateDailySales, getStockClassification } from '../../lib/storage';
import { InventorySetupChecklist } from './InventorySetupChecklist';
import { getEffectiveBusinessLabel, getQuickAdjustDeltas } from '../../lib/business-config';

interface DashboardTabProps {
  storeData: DukaanStoreData;
  onNavigate: (tab: 'inventory' | 'sales' | 'udhaar' | 'ai') => void;
  onRefresh: () => void;
  onOpenProfileSwitcher?: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  storeData,
  onNavigate,
  onRefresh,
  onOpenProfileSwitcher,
}) => {
  const isMounted = useIsMounted();

  // 1. Calculate Accurate Daily Sales & Payment Breakdown
  const dailySales = useMemo(() => {
    return calculateDailySales(storeData.sales, storeData.udhaarTransactions);
  }, [storeData.sales, storeData.udhaarTransactions]);

  // 2. Stock Classifications
  const stockBuckets = useMemo(() => {
    const low: Product[] = [];
    const out: Product[] = [];
    const unrecorded: Product[] = [];
    const adequate: Product[] = [];

    storeData.products.forEach((p) => {
      const cls = getStockClassification(p);
      if (cls === 'out_of_stock') out.push(p);
      else if (cls === 'low_stock') low.push(p);
      else if (cls === 'unrecorded') unrecorded.push(p);
      else adequate.push(p);
    });

    return { low, out, unrecorded, adequate };
  }, [storeData.products]);

  // 3. Total Outstanding Customer Credit (Udhaar)
  const totalUdhaarPending = useMemo(() => {
    return storeData.customers.reduce(
      (sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0),
      0
    );
  }, [storeData.customers]);

  const activeUdhaarCustomersCount = useMemo(() => {
    return storeData.customers.filter((c) => c.currentBalance > 0).length;
  }, [storeData.customers]);

  // Handle Quick Restock from Dashboard
  const handleQuickAdd = (product: Product) => {
    const deltas = getQuickAdjustDeltas(product.unit);
    const suggested = Math.max(product.minStockAlert * 2, deltas.deltaLarge);
    const res = quickAddStock(product.id, suggested);
    if (!res.success) {
      alert(res.error || 'स्टॉक अपडेट नहीं हो सका');
      return;
    }
    onRefresh();
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* 1. Shop Profile & Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-5 sm:p-7 text-white shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/20 text-emerald-50 text-xs font-bold backdrop-blur-xs">
                <Store className="w-3.5 h-3.5" />
                <span>{getEffectiveBusinessLabel(storeData.profile)}</span>
              </span>
              {storeData.profile.isDemo && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-xs font-bold">
                  Demo Store Mode (Isolated)
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {storeData.profile.shopName}
            </h2>
            <p className="text-emerald-100 text-xs sm:text-sm mt-1">
              Owner: <strong className="text-white">{storeData.profile.ownerName}</strong> • Today&apos;s Ledger &amp; Stock
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('sales')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <span>+ New Bill</span>
            </button>
            <button
              onClick={() => onNavigate('ai')}
              className="inline-flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-emerald-950/60 hover:bg-emerald-950/80 border border-emerald-400/30 text-white rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              <Bot className="w-4 h-4 text-emerald-200" />
              <span className="hidden sm:inline">Dukaan AI</span>
            </button>
            {onOpenProfileSwitcher && (
              <button
                onClick={onOpenProfileSwitcher}
                className="inline-flex items-center justify-center px-3 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                title="Switch shop profile"
              >
                Switch ⇄
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Onboarding Setup Checklist */}
      <InventorySetupChecklist storeData={storeData} onNavigate={onNavigate} />

      {/* 3. Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Today's Sales with Cash / UPI / Udhaar Breakdown */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Today&apos;s Gross Sales
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {formatCurrency(dailySales.grossSales)}
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
              <span>{dailySales.completedSalesCount} bills</span>
              <span className="text-emerald-700 font-bold">
                Cash {formatCurrency(dailySales.cashSales)} • UPI booked {formatCurrency(dailySales.onlineSales)}
              </span>
            </div>
            <dl className="mt-3 text-xs space-y-1" aria-label="Payment breakdown">
              <div>Recorded collections: {formatCurrency(dailySales.confirmedCollections)}</div>
              <div>UPI manually confirmed: {formatCurrency(dailySales.manuallyConfirmedOnline)}</div>
              <div>UPI pending / unknown: {formatCurrency(dailySales.pendingOnline)}</div>
              <div>UPI failed: {formatCurrency(dailySales.failedOnline)} · Cancelled: {formatCurrency(dailySales.cancelledOnline)}</div>
            </dl>
            {dailySales.udhaarSales > 0 && (
              <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                Credit Sales: {formatCurrency(dailySales.udhaarSales)}
              </div>
            )}
          </div>
        </div>

        {/* Metric 2: Total Products */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Products
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {storeData.products.length} <span className="text-sm font-normal text-slate-500">items</span>
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
              <span>
                {stockBuckets.unrecorded.length > 0
                  ? `${stockBuckets.unrecorded.length} unrecorded stock`
                  : 'All stock recorded'}
              </span>
              <button
                onClick={() => onNavigate('inventory')}
                className="text-blue-600 font-bold hover:underline cursor-pointer"
              >
                View →
              </button>
            </div>
          </div>
        </div>

        {/* Metric 3: Low & Out-of-Stock Alerts */}
        <div
          onClick={() => onNavigate('inventory')}
          className={`cursor-pointer p-4 sm:p-5 rounded-2xl border shadow-xs transition-colors ${
            stockBuckets.low.length > 0 || stockBuckets.out.length > 0
              ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Low Stock Alert
            </span>
            <div
              className={`p-2 rounded-xl ${
                stockBuckets.out.length > 0
                  ? 'bg-red-200 text-red-900'
                  : stockBuckets.low.length > 0
                  ? 'bg-amber-200 text-amber-900'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div
              className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
                stockBuckets.out.length > 0
                  ? 'text-red-600'
                  : stockBuckets.low.length > 0
                  ? 'text-amber-900'
                  : 'text-slate-900'
              }`}
            >
              {stockBuckets.low.length + stockBuckets.out.length}{' '}
              <span className="text-sm font-normal text-slate-600">items low</span>
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px]">
              <span
                className={
                  stockBuckets.out.length > 0
                    ? 'text-red-700 font-bold'
                    : stockBuckets.low.length > 0
                    ? 'text-amber-800 font-semibold'
                    : 'text-slate-500'
                }
              >
                {stockBuckets.out.length > 0
                  ? `${stockBuckets.out.length} out of stock (0)`
                  : stockBuckets.low.length > 0
                  ? `${stockBuckets.low.length} low stock`
                  : 'Adequate stock'}
              </span>
              <span className="text-amber-700 font-bold">Restock →</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Outstanding Customer Credit (Udhaar) */}
        <div
          onClick={() => onNavigate('udhaar')}
          className="cursor-pointer bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-red-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Outstanding Credit
            </span>
            <div className="p-2 rounded-xl bg-red-50 text-red-600">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-2xl font-extrabold text-red-600 tracking-tight">
              {formatCurrency(totalUdhaarPending)}
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
              <span>{activeUdhaarCustomersCount} customers with dues</span>
              <span className="text-red-600 font-bold">Ledger →</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Low-Stock Warning Alert Banner (If Any) */}
      {(stockBuckets.low.length > 0 || stockBuckets.out.length > 0) && (
        <div className="bg-amber-50 rounded-3xl border border-amber-300 p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <h3 className="font-bold text-amber-950 text-sm sm:text-base">
                Low &amp; Out of Stock Alerts ({stockBuckets.low.length + stockBuckets.out.length} items)
              </h3>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs font-bold text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...stockBuckets.out, ...stockBuckets.low].slice(0, 3).map((item) => {
              const isOut = item.currentStock === 0;
              return (
                <div
                  key={item.id}
                  className="bg-white p-3.5 rounded-2xl border border-amber-200 flex items-center justify-between shadow-2xs"
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                      {item.name}
                    </h4>
                    {(() => {
                      const specs = [
                        item.brandOrVariant,
                        item.size ? `Size: ${item.size}` : null,
                        item.color,
                        item.modelNumber ? `Mod: ${item.modelNumber}` : null,
                        item.batchNumber ? `Batch: ${item.batchNumber}` : null,
                        item.expiryDate ? `Exp: ${item.expiryDate}` : null,
                      ].filter(Boolean);
                      if (specs.length === 0) return null;
                      return (
                        <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {specs.join(' • ')}
                        </div>
                      );
                    })()}
                    <div
                      className={`text-xs font-bold mt-1 ${
                        isOut ? 'text-red-600' : 'text-amber-700'
                      }`}
                    >
                      {isOut
                        ? 'Out of Stock (0)'
                        : `Stock: ${formatQuantity(item.currentStock ?? 0, item.unit)}`}
                      <span className="text-slate-400 font-normal ml-1">
                        (Min Alert: {item.minStockAlert})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleQuickAdd(item)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0 shadow-2xs cursor-pointer"
                  >
                    + Add Stock
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Clean Empty State When Shop Has 0 Products */}
      {storeData.products.length === 0 && (
        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-300 p-8 sm:p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg">
              Your store inventory is empty
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
              Add products manually, or tell Dukaan AI in Hindi/Hinglish: <em>&ldquo;Meri dukaan mein aata, chawal aur cheeni save kar lo&rdquo;</em>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('inventory')}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add First Product</span>
            </button>
            <button
              onClick={() => onNavigate('ai')}
              className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Bot className="w-4 h-4 text-purple-600" />
              <span>Add via Voice AI</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Quick Action Shortcuts */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base mb-3.5">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('sales')}
            className="flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-900 transition-colors group text-center cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="font-bold text-xs sm:text-sm">Record Sale</span>
            <span className="text-[11px] text-emerald-700 mt-0.5">Create new bill</span>
          </button>

          <button
            onClick={() => onNavigate('inventory')}
            className="flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200 text-blue-900 transition-colors group text-center cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <PlusCircle className="w-5 h-5" />
            </div>
            <span className="font-bold text-xs sm:text-sm">Add Product</span>
            <span className="text-[11px] text-blue-700 mt-0.5">New item or stock</span>
          </button>

          <button
            onClick={() => onNavigate('udhaar')}
            className="flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200 text-amber-900 transition-colors group text-center cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-amber-600 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-bold text-xs sm:text-sm">Credit / Udhaar</span>
            <span className="text-[11px] text-amber-700 mt-0.5">Ledger or payment</span>
          </button>

          <button
            onClick={() => onNavigate('ai')}
            className="flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl bg-purple-50/70 hover:bg-purple-100/80 border border-purple-200 text-purple-900 transition-colors group text-center cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <Bot className="w-5 h-5" />
            </div>
            <span className="font-bold text-xs sm:text-sm">AI Assistant</span>
            <span className="text-[11px] text-purple-700 mt-0.5">Voice &amp; Hinglish</span>
          </button>
        </div>
      </div>

      {/* 7. Recent Transactions & Activities */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
              Recent Activity
            </h3>
            <p className="text-xs text-slate-500">Latest sales, stock adjustments, and credit records</p>
          </div>
          <button
            onClick={() => onNavigate('sales')}
            className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
          >
            View all →
          </button>
        </div>

        {storeData.activities.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No recent activity recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {storeData.activities.slice(0, 6).map((activity) => {
              const isSale = activity.type === 'sale';
              const isUdhaarGiven = activity.type === 'udhaar_given';
              const isUdhaarRec = activity.type === 'udhaar_received';

              return (
                <div key={activity.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSale
                          ? 'bg-emerald-100 text-emerald-700'
                          : isUdhaarGiven
                          ? 'bg-red-100 text-red-700'
                          : isUdhaarRec
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isSale ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : isUdhaarGiven ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : isUdhaarRec ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <Package className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                        {activity.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {activity.description}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {activity.amount !== undefined && (
                      <div
                        className={`font-bold text-xs sm:text-sm ${
                          isSale
                            ? 'text-emerald-700'
                            : isUdhaarGiven
                            ? 'text-red-600'
                            : isUdhaarRec
                            ? 'text-blue-700'
                            : 'text-slate-800'
                        }`}
                      >
                        {formatCurrency(activity.amount)}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span suppressHydrationWarning>
                        {isMounted
                          ? formatRelativeDate(activity.timestamp)
                          : formatDate(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
