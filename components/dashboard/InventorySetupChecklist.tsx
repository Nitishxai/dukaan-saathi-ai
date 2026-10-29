'use client';

import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { DukaanStoreData } from '../../types';

interface InventorySetupChecklistProps {
  storeData: DukaanStoreData;
  onNavigate: (tab: 'inventory' | 'sales' | 'udhaar' | 'ai') => void;
}

export const InventorySetupChecklist: React.FC<InventorySetupChecklistProps> = ({
  storeData,
  onNavigate,
}) => {
  const hasProfile = Boolean(storeData.profile?.isOnboarded);
  const productsCount = storeData.products.length;
  const hasProducts = productsCount >= 5;
  const hasStockRecorded = storeData.products.some((p) => p.currentStock !== null && p.currentStock > 0);
  const hasSales = storeData.sales.length > 0;
  const hasCustomers = storeData.customers.length > 0;

  const steps = [
    {
      title: 'Set Up Shop Profile',
      desc: `${storeData.profile.shopName} • ${storeData.profile.ownerName}`,
      isDone: hasProfile,
      actionText: null,
      onAction: null,
    },
    {
      title: 'Add First 5 Products',
      desc: `${productsCount}/5 products added`,
      isDone: hasProducts,
      actionText: '+ Add Products',
      onAction: () => onNavigate('inventory'),
    },
    {
      title: 'Record Opening Stock',
      desc: hasStockRecorded ? 'Stock quantities recorded' : 'Record initial product stock',
      isDone: hasStockRecorded,
      actionText: 'Update Stock',
      onAction: () => onNavigate('inventory'),
    },
    {
      title: 'Record First Sale',
      desc: hasSales ? `${storeData.sales.length} sales recorded` : 'Record cash, UPI, or credit sales',
      isDone: hasSales,
      actionText: '+ New Sale',
      onAction: () => onNavigate('sales'),
    },
    {
      title: 'Add Customer Credit Account',
      desc: hasCustomers ? `${storeData.customers.length} customers registered` : 'Create customer credit ledger',
      isDone: hasCustomers,
      actionText: '+ Add Customer',
      onAction: () => onNavigate('udhaar'),
    },
  ];

  const completedCount = steps.filter((s) => s.isDone).length;
  const percentage = Math.round((completedCount / steps.length) * 100);

  // If all completed, hide or show compact badge
  if (completedCount === steps.length) return null;

  return (
    <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-2 border-emerald-300 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              Store Setup Checklist
            </h3>
            <p className="text-xs text-slate-600">
              Quick steps to set up your store ledger ({completedCount}/{steps.length} completed)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs font-bold text-emerald-800">{percentage}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className={`p-3.5 rounded-2xl border transition-all ${
              step.isDone
                ? 'bg-emerald-50/60 border-emerald-200'
                : 'bg-white border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                {step.isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <h4
                    className={`text-xs font-bold truncate ${
                      step.isDone ? 'text-emerald-950 line-through opacity-75' : 'text-slate-900'
                    }`}
                  >
                    {step.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{step.desc}</p>
                </div>
              </div>

              {!step.isDone && step.actionText && step.onAction && (
                <button
                  type="button"
                  onClick={step.onAction}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors shrink-0 shadow-2xs"
                >
                  {step.actionText}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
