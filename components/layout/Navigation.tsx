'use client';

import React from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BookOpen,
  Bot,
} from 'lucide-react';

export type TabType = 'dashboard' | 'inventory' | 'sales' | 'udhaar' | 'ai';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  lowStockCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  lowStockCount,
}) => {
  const navItems: {
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Package,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    {
      id: 'sales',
      label: 'Sales & POS',
      icon: ShoppingCart,
    },
    {
      id: 'udhaar',
      label: 'Credit / Udhaar',
      icon: BookOpen,
    },
    {
      id: 'ai',
      label: 'AI Assistant',
      icon: Bot,
    },
  ];

  return (
    <>
      {/* Desktop / Tablet Sub-Header Tab Bar */}
      <nav aria-label="Desktop Navigation" className="hidden md:block bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-2 lg:space-x-4 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center space-x-2.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all relative ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>

                  {item.badge !== undefined && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-red-500 text-white'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Fixed Bottom Navigation Bar (Android Phone Optimized) */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg safe-bottom">
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center py-1 rounded-lg transition-colors relative ${
                  isActive ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600 stroke-[2.4]' : 'text-slate-500'}`} />
                  {item.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-1 leading-none text-center">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
