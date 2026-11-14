'use client';
import { AccessibleDialog } from '../AccessibleDialog';

import React, { useState } from 'react';
import {
  Store,
  Plus,
  Check,
  RotateCcw,
  Sparkles,
  X,
  ChevronRight,
  Edit2,
  HardDriveDownload,
} from 'lucide-react';
import { ShopProfile } from '../../types';
import {
  getProfilesList,
  switchProfile,
  createShopProfile,
  updateShopProfile,
  loadDemoShop,
  resetCurrentShopToEmpty,
} from '../../lib/storage';
import {
  BUSINESS_TYPES,
  getEffectiveBusinessLabel,
  resolveShopBusinessType,
} from '../../lib/business-config';

interface ProfileSwitcherModalProps {
  currentProfile: ShopProfile;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onOpenBackupRestore?: () => void;
}

export const ProfileSwitcherModal: React.FC<ProfileSwitcherModalProps> = ({
  currentProfile,
  isOpen,
  onClose,
  onRefresh,
  onOpenBackupRestore,
}) => {
  const [profiles, setProfiles] = useState<ShopProfile[]>(() => getProfilesList());
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isEditingCurrent, setIsEditingCurrent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Profile Form State
  const [newShopName, setNewShopName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newBusinessType, setNewBusinessType] = useState('kirana');
  const [newCustomBusinessType, setNewCustomBusinessType] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Edit Active Profile Form State
  const [editShopName, setEditShopName] = useState(currentProfile.shopName);
  const [editOwnerName, setEditOwnerName] = useState(currentProfile.ownerName);
  const [editBusinessType, setEditBusinessType] = useState(resolveShopBusinessType(currentProfile));
  const [editCustomBusinessType, setEditCustomBusinessType] = useState(currentProfile.customBusinessType || '');
  const [editDescription, setEditDescription] = useState(currentProfile.description || '');

  if (!isOpen) return null;

  const handleSelectProfile = (id: string) => {
    try {
      const selected = switchProfile(id);
      if (selected.profile.id !== id) { setErrorMessage('Shop switch failed. Close other counter tabs and retry.'); return; }
      onRefresh(); onClose();
    } catch { setErrorMessage('Shop switch could not be saved. Please retry.'); }
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditShopName(currentProfile.shopName);
    setEditOwnerName(currentProfile.ownerName);
    setEditBusinessType(resolveShopBusinessType(currentProfile));
    setEditCustomBusinessType(currentProfile.customBusinessType || '');
    setEditDescription(currentProfile.description || '');
    setErrorMessage(null);
    setIsEditingCurrent(true);
    setIsCreatingNew(false);
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim()) {
      setErrorMessage('Shop name is required.');
      return;
    }
    if (!newOwnerName.trim()) {
      setErrorMessage('Owner name is required.');
      return;
    }
    if (newBusinessType === 'other' && !newCustomBusinessType.trim()) {
      setErrorMessage('Please specify your custom business type.');
      return;
    }

    const selectedDef = BUSINESS_TYPES.find((b) => b.id === newBusinessType) || BUSINESS_TYPES[0];
    const categoryName =
      newBusinessType === 'other' && newCustomBusinessType.trim()
        ? newCustomBusinessType.trim()
        : selectedDef.title;

    const res = createShopProfile({
      shopName: newShopName.trim(),
      ownerName: newOwnerName.trim(),
      category: categoryName,
      businessType: newBusinessType,
      customBusinessType: newBusinessType === 'other' ? newCustomBusinessType.trim() : undefined,
      description: newDescription.trim() || undefined,
      isOnboarded: true,
    });

    if (res.success) {
      setProfiles(getProfilesList());
      setIsCreatingNew(false);
      setNewShopName('');
      setNewOwnerName('');
      setNewCustomBusinessType('');
      setNewDescription('');
      setErrorMessage(null);
      onRefresh();
      onClose();
    } else {
      setErrorMessage(res.error || 'Could not create store profile');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShopName.trim()) {
      setErrorMessage('Shop name is required.');
      return;
    }
    if (!editOwnerName.trim()) {
      setErrorMessage('Owner name is required.');
      return;
    }
    if (editBusinessType === 'other' && !editCustomBusinessType.trim()) {
      setErrorMessage('Please specify your custom business type.');
      return;
    }

    const selectedDef = BUSINESS_TYPES.find((b) => b.id === editBusinessType) || BUSINESS_TYPES[0];
    const categoryName =
      editBusinessType === 'other' && editCustomBusinessType.trim()
        ? editCustomBusinessType.trim()
        : selectedDef.title;

    const res = updateShopProfile({
      shopName: editShopName.trim(),
      ownerName: editOwnerName.trim(),
      category: categoryName,
      businessType: editBusinessType,
      customBusinessType: editBusinessType === 'other' ? editCustomBusinessType.trim() : undefined,
      description: editDescription.trim() || undefined,
    });

    if (res.success) {
      setProfiles(getProfilesList());
      setIsEditingCurrent(false);
      setErrorMessage(null);
      onRefresh();
    } else {
      setErrorMessage(res.error || 'Could not update store profile');
    }
  };

  const handleLoadDemo = () => {
    try { loadDemoShop(); } catch { setErrorMessage('Demo nahi khula. Storage aur doosre tab ki jaanch karein.'); return; }
    setProfiles(getProfilesList());
    onRefresh();
    onClose();
  };

  const handleResetCurrent = () => {
    if (confirm('Are you sure you want to reset all data for this shop to an empty state?')) {
      resetCurrentShopToEmpty();
      onRefresh();
      onClose();
    }
  };

  return (
    <AccessibleDialog label="Shop profiles" onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                {isCreatingNew
                  ? 'Add Store Profile'
                  : isEditingCurrent
                  ? 'Edit Store Details'
                  : 'Switch Store Profile'}
              </h3>
              <p className="text-xs text-slate-500">
                {isCreatingNew
                  ? 'Set up a new isolated retail business'
                  : isEditingCurrent
                  ? 'Update store name and business type'
                  : 'Each store maintains isolated inventory, sales, and credit ledgers'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
            {errorMessage}
          </div>
        )}

        {/* 1. Main View: Profiles List */}
        {!isCreatingNew && !isEditingCurrent && (
          <div className="space-y-4">
            {/* List of Profiles */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {profiles.map((p) => {
                const isActive = p.id === currentProfile.id;
                const businessLabel = getEffectiveBusinessLabel(p);

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProfile(p.id)}
                    className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isActive
                        ? 'border-emerald-500 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm truncate">
                          {p.shopName}
                        </span>
                        {p.isDemo ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            Demo Store
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {businessLabel}
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {p.ownerName} {p.description ? `• ${p.description}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isActive && (
                        <button
                          type="button"
                          onClick={handleStartEdit}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit shop details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {isActive ? (
                        <Check className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setIsCreatingNew(true);
                  setIsEditingCurrent(false);
                }}
                className="w-full py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add New Store Profile</span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Load sample grocery data into a separate demo profile"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Explore Demo Store</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetCurrent}
                  className="py-2 px-3 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-600 hover:text-red-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Clear all data for current shop"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Shop Data</span>
                </button>
              </div>

              {onOpenBackupRestore && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBackupRestore();
                  }}
                  className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Export or restore backup for current shop"
                >
                  <HardDriveDownload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Backup &amp; Restore Current Shop</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. Create New Profile Form */}
        {isCreatingNew && (
          <form onSubmit={handleCreateNew} className="space-y-3.5 animate-in fade-in">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Shop Name *</label>
              <input
                type="text"
                required
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                placeholder="e.g. Radhe Krishna General Store"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Owner Name *</label>
              <input
                type="text"
                required
                value={newOwnerName}
                onChange={(e) => setNewOwnerName(e.target.value)}
                placeholder="e.g. Suresh Sharma"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Business Type / Category *</label>
              <select
                value={newBusinessType}
                onChange={(e) => setNewBusinessType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {BUSINESS_TYPES.map((bt) => (
                  <option key={bt.id} value={bt.id}>
                    {bt.title} ({bt.hindiTitle})
                  </option>
                ))}
              </select>
            </div>

            {newBusinessType === 'other' && (
              <div className="space-y-1 animate-in fade-in">
                <label className="text-xs font-bold text-emerald-800">Custom Business Type *</label>
                <input
                  type="text"
                  required
                  value={newCustomBusinessType}
                  onChange={(e) => setNewCustomBusinessType(e.target.value)}
                  placeholder="e.g. Tailoring & Boutique, Hardware Retail"
                  className="w-full px-3 py-2 bg-emerald-50/40 border border-emerald-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Business Description (Optional)</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="e.g. Retail groceries, daily essentials, spices"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-normal text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setErrorMessage(null);
                }}
                className="flex-1 py-2 px-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Create Store
              </button>
            </div>
          </form>
        )}

        {/* 3. Edit Current Profile Form */}
        {isEditingCurrent && (
          <form onSubmit={handleSaveEdit} className="space-y-3.5 animate-in fade-in">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Shop Name *</label>
              <input
                type="text"
                required
                value={editShopName}
                onChange={(e) => setEditShopName(e.target.value)}
                placeholder="Shop Name"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Owner Name *</label>
              <input
                type="text"
                required
                value={editOwnerName}
                onChange={(e) => setEditOwnerName(e.target.value)}
                placeholder="Owner Name"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Business Type / Category *</label>
              <select
                value={editBusinessType}
                onChange={(e) => setEditBusinessType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {BUSINESS_TYPES.map((bt) => (
                  <option key={bt.id} value={bt.id}>
                    {bt.title} ({bt.hindiTitle})
                  </option>
                ))}
              </select>
            </div>

            {editBusinessType === 'other' && (
              <div className="space-y-1 animate-in fade-in">
                <label className="text-xs font-bold text-emerald-800">Custom Business Type *</label>
                <input
                  type="text"
                  required
                  value={editCustomBusinessType}
                  onChange={(e) => setEditCustomBusinessType(e.target.value)}
                  placeholder="e.g. Tailoring & Boutique"
                  className="w-full px-3 py-2 bg-emerald-50/40 border border-emerald-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Business Description (Optional)</label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="e.g. Retail groceries and household goods"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-normal text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
              Changing your store business type adapts future product templates and suggestions. All existing products, sales, and customer ledgers are preserved.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditingCurrent(false);
                  setErrorMessage(null);
                }}
                className="flex-1 py-2 px-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>
    </AccessibleDialog>
  );
};
