'use client';

import React from 'react';
import { X, Database, ShieldAlert, Cpu, CheckCircle2, HardDriveDownload } from 'lucide-react';

interface StorageDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastResetAt?: string;
  onOpenBackupRestore?: () => void;
}

export const StorageDisclaimerModal: React.FC<StorageDisclaimerModalProps> = ({
  isOpen,
  onClose,
  lastResetAt,
  onOpenBackupRestore,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Prototype & Architecture Notice</h2>
              <p className="text-xs text-slate-500">Local Storage & Cloud Database Roadmap</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm text-slate-600">
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-start space-x-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-900 text-sm">
                  Data is currently stored in browser (Local Storage)
                </h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  This prototype stores all your inventory, sales, and credit records locally on this device. Switching devices or browsers will not sync data automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Future Supabase Cloud Sync Plan:
            </h4>
            <p className="text-xs leading-relaxed text-slate-600 pl-6">
              The application uses a modular repository layer. In production, it connects seamlessly to <span className="font-semibold text-slate-800">Supabase PostgreSQL</span> to synchronize inventory and credit across multiple shop phones and computers in real time.
            </p>

            <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-600" />
              Smart Offline & Hybrid AI Engine:
            </h4>
            <p className="text-xs leading-relaxed text-slate-600 pl-6">
              The assistant features an offline-capable in-browser smart rule engine along with secure server-side Gemini AI integration. Transactions always require an explicit confirmation preview before saving.
            </p>
          </div>

          {/* Offline Backup & Restore Quick Action */}
          {onOpenBackupRestore && (
            <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-2.5">
                <HardDriveDownload className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-emerald-950 text-sm">
                    Offline Backup &amp; Restore
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                    Download full JSON backups of your shop or restore from a previous file.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBackupRestore();
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <HardDriveDownload className="w-3.5 h-3.5" />
                <span>Open Backup Tool</span>
              </button>
            </div>
          )}

          {lastResetAt && (
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
              Demo store initialized: {new Date(lastResetAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-colors shadow-xs"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
