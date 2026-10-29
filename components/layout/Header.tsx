'use client';

import React from 'react';
import { Store, RotateCcw, Database, Sparkles, User, HardDriveDownload } from 'lucide-react';
import { DukaanStoreData } from '../../types';
import { getEffectiveBusinessLabel } from '../../lib/business-config';

interface HeaderProps {
  storeData: DukaanStoreData;
  onOpenProfileSwitcher: () => void;
  onResetDemo: () => void;
  onOpenStorageModal: () => void;
  onOpenBackupRestore: () => void;
  onOpenAI: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  storeData,
  onOpenProfileSwitcher,
  onResetDemo,
  onOpenStorageModal,
  onOpenBackupRestore,
  onOpenAI,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Shop Info */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenProfileSwitcher}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center text-white shadow-sm shadow-emerald-200 transition-transform active:scale-95 cursor-pointer"
              title="Switch shop profile"
            >
              <Store className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-extrabold text-slate-900 text-base sm:text-xl tracking-tight leading-tight">
                  {storeData.profile.shopName || storeData.shopName || 'Dukaan Sathi AI'}
                </h1>
                {storeData.profile.isDemo ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    Demo Store
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    {getEffectiveBusinessLabel(storeData.profile)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                <User className="w-3 h-3 text-slate-400" />
                <span className="text-slate-700 font-bold">{storeData.profile.ownerName || storeData.shopkeeperName}</span>
                <span className="text-slate-400">•</span>
                <button
                  onClick={onOpenProfileSwitcher}
                  className="text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Switch Shop ⇄
                </button>
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Quick AI Trigger */}
            <button
              onClick={onOpenAI}
              className="flex items-center space-x-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              title="Voice & chat assistant"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span className="hidden xs:inline">Dukaan AI</span>
            </button>

            {/* Profile Switcher Trigger */}
            <button
              onClick={onOpenProfileSwitcher}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
              title="Switch or create shop profile"
            >
              <Store className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Profiles</span>
            </button>

            {/* Backup & Restore Trigger */}
            <button
              onClick={onOpenBackupRestore}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 text-slate-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
              title="Backup & Restore shop data"
            >
              <HardDriveDownload className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Backup</span>
            </button>

            {/* Storage Info Pill */}
            <button
              onClick={onOpenStorageModal}
              className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
              title="Local storage architecture details"
            >
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span>Architecture</span>
            </button>

            {/* Reset / Demo Clear */}
            <button
              onClick={onResetDemo}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-200 hover:border-red-200 text-xs font-bold transition-colors cursor-pointer"
              title="Reset data or demo options"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
