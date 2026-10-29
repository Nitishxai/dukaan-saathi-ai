'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldAlert,
  HardDriveDownload,
  Calendar,
  Store,
  RefreshCw,
} from 'lucide-react';
import { DukaanStoreData, BackupValidationResult } from '../../types';
import { createShopBackup, downloadBackupFile, validateShopBackup, restoreBackupToStore } from '../../lib/backup';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { getEffectiveBusinessLabel } from '../../lib/business-config';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStoreData: DukaanStoreData;
  onRefresh: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  currentStoreData,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'restore'>('export');
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Restore state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreSuccess, setRestoreSuccess] = useState<boolean>(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const currentProfile = currentStoreData.profile;
  const currentShopName = currentProfile.shopName || currentStoreData.shopName || 'Current Shop';

  // Handle Export
  const handleExportBackup = () => {
    try {
      const backup = createShopBackup(currentStoreData);
      downloadBackupFile(backup);
      setExportSuccessMessage(`Backup file downloaded successfully (${backup.data.products.length} products, ${backup.data.sales.length} sales).`);
      setTimeout(() => {
        setExportSuccessMessage(null);
      }, 6000);
    } catch (err) {
      console.error('Failed to export backup:', err);
    }
  };

  // Handle File Selection for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    setRestoreSuccess(false);
    setIsConfirmed(false);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setValidationResult(null);
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const res = validateShopBackup(parsed);
        setValidationResult(res);
        if (!res.isValid) {
          setRestoreError(res.error || 'The selected file is not a valid Dukaan Sathi AI backup.');
        }
      } catch (err) {
        setValidationResult({
          isValid: false,
          error: `Could not parse JSON file: ${err instanceof Error ? err.message : 'Invalid JSON format'}.`,
        });
        setRestoreError('The selected file is not a valid JSON document.');
      }
    };
    reader.onerror = () => {
      setRestoreError('Failed to read the selected file from disk.');
    };
    reader.readAsText(file);
  };

  // Handle Restore Execution
  const handleExecuteRestore = () => {
    if (!validationResult || !validationResult.isValid || !validationResult.backup) {
      setRestoreError('Please select a valid backup file first.');
      return;
    }
    if (!isConfirmed) {
      setRestoreError('Please confirm the replacement checkbox to proceed.');
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);
    try {
      const res = restoreBackupToStore(validationResult.backup, currentProfile.id);
      if (!res.success) {
        setRestoreError(res.error || 'Failed to restore backup.');
        setIsRestoring(false);
        return;
      }

      setRestoreSuccess(true);
      setIsRestoring(false);
      onRefresh();
    } catch (err) {
      setIsRestoring(false);
      setRestoreError(err instanceof Error ? err.message : 'An unexpected error occurred during restore.');
    }
  };

  const handleResetRestoreForm = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setIsConfirmed(false);
    setRestoreSuccess(false);
    setRestoreError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200">
              <HardDriveDownload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Backup &amp; Restore Shop Data
              </h2>
              <p className="text-xs text-slate-500">
                Safe JSON exports • Isolated per shop profile • No secrets or cloud dependencies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 rounded-2xl mt-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export Backup</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'restore'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Restore Backup</span>
          </button>
        </div>

        {/* Tab Body (Scrollable) */}
        <div className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1 text-sm text-slate-600">
          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Current Shop Info Card */}
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-slate-900 text-sm">{currentShopName}</span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {getEffectiveBusinessLabel(currentProfile)}
                  </span>
                </div>

                {/* 4 Stats Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Products</span>
                    <span className="text-base font-extrabold text-slate-800">
                      {currentStoreData.products.length}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Sales Bills</span>
                    <span className="text-base font-extrabold text-slate-800">
                      {currentStoreData.sales.length}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Customers</span>
                    <span className="text-base font-extrabold text-slate-800">
                      {currentStoreData.customers.length}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Udhaar Tx</span>
                    <span className="text-base font-extrabold text-slate-800">
                      {currentStoreData.udhaarTransactions.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* What is Included Notice */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs leading-relaxed text-slate-600">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>What is included in this backup:</span>
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Complete inventory list with custom business attributes (sizes, batches, warranties, etc.)</li>
                  <li>Sales transactions, invoice records, and timestamps</li>
                  <li>Customer accounts, contact numbers, and active udhaar balances</li>
                  <li>Udhaar payment and credit ledger history</li>
                  <li>Shop settings, business type category, and configured UPI ID</li>
                </ul>
                <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/80">
                  🔒 <strong>Privacy Guarantee:</strong> No secrets or API keys are included. Backups are strictly isolated to <em>{currentShopName}</em> and never expose other shop profiles.
                </p>
              </div>

              {exportSuccessMessage && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{exportSuccessMessage}</span>
                </div>
              )}

              {/* Export CTA Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Backup File (.json)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: RESTORE */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              {/* Success Screen after Restore */}
              {restoreSuccess ? (
                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Shop Data Restored Successfully!
                  </h3>
                  <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                    All inventory, sales records, customers, and udhaar balances from the backup file have been applied to <strong>{currentShopName}</strong>.
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleResetRestoreForm();
                        onClose();
                      }}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
                    >
                      Close &amp; View Dashboard
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* File Upload Selector */}
                  <div className="p-4 sm:p-5 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl text-center space-y-2 bg-slate-50/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-slate-800 cursor-pointer hover:underline block">
                        Select a Dukaan Sathi AI Backup (.json)
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json,application/json"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {selectedFile ? selectedFile.name : 'Click to browse files on your device'}
                      </p>
                    </div>
                  </div>

                  {/* Error Notification */}
                  {restoreError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-medium flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">File Rejected:</strong> {restoreError}
                      </div>
                    </div>
                  )}

                  {/* Valid Backup Preview & Summary Card */}
                  {validationResult && validationResult.isValid && validationResult.summary && (
                    <div className="space-y-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                            Backup Ready for Restore
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                            {validationResult.summary.shopName}
                          </h4>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Exported: {formatDate(validationResult.summary.exportedAt)}</span>
                          </p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300">
                          Schema v1.0
                        </span>
                      </div>

                      {/* Record Counts */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-white p-2 rounded-xl border border-emerald-100 text-center">
                          <span className="text-[10px] text-slate-400 block font-bold">Products</span>
                          <span className="font-extrabold text-slate-800 text-sm">
                            {validationResult.summary.productCount}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-emerald-100 text-center">
                          <span className="text-[10px] text-slate-400 block font-bold">Sales</span>
                          <span className="font-extrabold text-slate-800 text-sm">
                            {validationResult.summary.salesCount}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-emerald-100 text-center">
                          <span className="text-[10px] text-slate-400 block font-bold">Customers</span>
                          <span className="font-extrabold text-slate-800 text-sm">
                            {validationResult.summary.customerCount}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-emerald-100 text-center">
                          <span className="text-[10px] text-slate-400 block font-bold">Udhaar Dues</span>
                          <span className="font-extrabold text-red-600 text-sm">
                            {formatCurrency(validationResult.summary.totalOutstandingCredit)}
                          </span>
                        </div>
                      </div>

                      {/* Safety & Replacement Warning Notice */}
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-xs space-y-2">
                        <div className="flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-bold">Explicit Replacement Notice:</strong> Restoring this backup will replace all current inventory, sales, and customer credit records in <strong>{currentShopName}</strong>. Other shop profiles will NOT be modified.
                          </div>
                        </div>

                        {/* Safety Snapshot Button */}
                        <div className="pt-1.5 flex items-center justify-between border-t border-amber-200">
                          <span className="text-[11px] text-amber-800">
                            Want to keep a copy of your current store before replacing?
                          </span>
                          <button
                            type="button"
                            onClick={handleExportBackup}
                            className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold cursor-pointer transition-colors shrink-0"
                          >
                            Backup Current First
                          </button>
                        </div>
                      </div>

                      {/* Explicit Confirmation Checkbox */}
                      <label className="flex items-start gap-2 pt-1 text-xs text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isConfirmed}
                          onChange={(e) => setIsConfirmed(e.target.checked)}
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                        />
                        <span>
                          I understand that this action will replace the current data for <strong>{currentShopName}</strong> with the backup records.
                        </span>
                      </label>

                      {/* Execute Restore Button */}
                      <div className="pt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleResetRestoreForm}
                          className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!isConfirmed || isRestoring}
                          onClick={handleExecuteRestore}
                          className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer ${
                            !isConfirmed || isRestoring
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white'
                          }`}
                        >
                          {isRestoring ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Restoring Shop...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Confirm &amp; Restore Shop Data</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Dukaan Sathi AI • Local Data Engine</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-slate-600 hover:text-slate-800 font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
