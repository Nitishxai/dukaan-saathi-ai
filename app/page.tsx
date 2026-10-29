'use client';

import React, { useState, useSyncExternalStore, useCallback, Suspense } from 'react';
import {
  getStoreData,
  subscribeStoreData,
  resetToDemoData,
  resetCurrentShopToEmpty,
  getStockClassification,
  INITIAL_EMPTY_DATA,
} from '../lib/storage';
import { Header } from '../components/layout/Header';
import { Navigation, TabType } from '../components/layout/Navigation';
import { StorageDisclaimerModal } from '../components/layout/StorageDisclaimerModal';
import { DashboardTab } from '../components/dashboard/DashboardTab';
import { InventoryTab } from '../components/inventory/InventoryTab';
import { SalesTab } from '../components/sales/SalesTab';
import { UdhaarTab } from '../components/udhaar/UdhaarTab';
import { AIAssistantTab } from '../components/ai/AIAssistantTab';
import { ShopOnboardingModal } from '../components/profile/ShopOnboardingModal';
import { ProfileSwitcherModal } from '../components/profile/ProfileSwitcherModal';
import { BackupRestoreModal } from '../components/backup/BackupRestoreModal';
import { RotateCcw } from 'lucide-react';

export default function Home() {
  const storeData = useSyncExternalStore(
    subscribeStoreData,
    getStoreData,
    () => INITIAL_EMPTY_DATA
  );

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isProfileSwitcherOpen, setIsProfileSwitcherOpen] = useState(false);
  const [isBackupRestoreOpen, setIsBackupRestoreOpen] = useState(false);
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(false);

  const [, setRefreshTicker] = useState(0);

  // Trigger re-render callback for child components if needed
  const handleRefresh = useCallback(() => {
    setRefreshTicker((t) => t + 1);
  }, []);

  // Reset logic respects whether active store is demo or real
  const handleConfirmReset = () => {
    if (storeData.profile?.isDemo) {
      resetToDemoData();
    } else {
      resetCurrentShopToEmpty();
    }
    setIsResetConfirmOpen(false);
  };

  // Calculate low-stock count accurately (excludes unrecorded stock items)
  const lowStockCount = storeData.products.filter((p) => {
    const cls = getStockClassification(p);
    return cls === 'low_stock' || cls === 'out_of_stock';
  }).length;

  const showOnboarding = Boolean(
    storeData.profile && !storeData.profile.isOnboarded && !isOnboardingDismissed
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Header */}
      <Header
        storeData={storeData}
        onOpenProfileSwitcher={() => setIsProfileSwitcherOpen(true)}
        onResetDemo={() => setIsResetConfirmOpen(true)}
        onOpenStorageModal={() => setIsStorageModalOpen(true)}
        onOpenBackupRestore={() => setIsBackupRestoreOpen(true)}
        onOpenAI={() => setActiveTab('ai')}
      />

      {/* Navigation (Desktop Tab Bar + Mobile Bottom Bar) */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lowStockCount={lowStockCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        <Suspense
          fallback={
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-3" />
              <p className="text-sm font-semibold text-slate-600">Loading...</p>
            </div>
          }
        >
          {activeTab === 'dashboard' && (
            <DashboardTab
              storeData={storeData}
              onNavigate={(tab) => setActiveTab(tab)}
              onRefresh={handleRefresh}
              onOpenProfileSwitcher={() => setIsProfileSwitcherOpen(true)}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryTab
              products={storeData.products}
              onRefresh={handleRefresh}
              profile={storeData.profile}
            />
          )}

          {activeTab === 'sales' && (
            <SalesTab
              products={storeData.products}
              customers={storeData.customers}
              sales={storeData.sales}
              onRefresh={handleRefresh}
              profile={storeData.profile}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'udhaar' && (
            <UdhaarTab
              customers={storeData.customers}
              transactions={storeData.udhaarTransactions}
              shopName={storeData.profile?.shopName || storeData.shopName}
              onRefresh={handleRefresh}
            />
          )}

          {activeTab === 'ai' && (
            <AIAssistantTab
              products={storeData.products}
              customers={storeData.customers}
              sales={storeData.sales}
              udhaarTransactions={storeData.udhaarTransactions}
              shopName={storeData.profile?.shopName || storeData.shopName}
              ownerName={storeData.profile?.ownerName || storeData.shopkeeperName}
              onRefresh={handleRefresh}
              onNavigateToTab={(tab) => setActiveTab(tab)}
            />
          )}
        </Suspense>
      </main>

      {/* First-time Shop Onboarding Flow */}
      {storeData.profile && (
        <ShopOnboardingModal
          profile={storeData.profile}
          isOpen={showOnboarding}
          onComplete={() => {
            setIsOnboardingDismissed(true);
            handleRefresh();
          }}
        />
      )}

      {/* Shop Profile Switcher & Multi-Profile Manager */}
      {storeData.profile && (
        <ProfileSwitcherModal
          currentProfile={storeData.profile}
          isOpen={isProfileSwitcherOpen}
          onClose={() => setIsProfileSwitcherOpen(false)}
          onRefresh={handleRefresh}
          onOpenBackupRestore={() => setIsBackupRestoreOpen(true)}
        />
      )}

      {/* Storage Architecture & Limitations Modal */}
      <StorageDisclaimerModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        lastResetAt={storeData.lastResetAt}
        onOpenBackupRestore={() => setIsBackupRestoreOpen(true)}
      />

      {/* Backup & Restore Modal */}
      <BackupRestoreModal
        isOpen={isBackupRestoreOpen}
        onClose={() => setIsBackupRestoreOpen(false)}
        currentStoreData={storeData}
        onRefresh={handleRefresh}
      />

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              {storeData.profile?.isDemo ? 'Reset Demo Store?' : 'Clear Shop Data?'}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {storeData.profile?.isDemo
                ? 'Do you want to reset demo inventory, sales, and credit ledger to default state?'
                : 'Do you want to clear all inventory, sales, and credit records for this shop? The shop profile will be preserved.'}
            </p>

            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 py-2 px-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                Yes, Clear Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
