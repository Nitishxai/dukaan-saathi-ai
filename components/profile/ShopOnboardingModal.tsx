'use client';
import { AccessibleDialog } from '../AccessibleDialog';

import React, { useState, useMemo } from 'react';
import { Store, User, Phone, MapPin, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { ShopProfile } from '../../types';
import { loadDemoShop, updateShopProfile, saveProductsBatch } from '../../lib/storage';
import {
  BUSINESS_TYPES,
  getBusinessTypeConfig,
  resolveShopBusinessType,
} from '../../lib/business-config';

interface ShopOnboardingModalProps {
  profile: ShopProfile;
  isOpen: boolean;
  onComplete: () => void;
}

export const ShopOnboardingModal: React.FC<ShopOnboardingModalProps> = ({
  profile,
  isOpen,
  onComplete,
}) => {
  const initialBusinessType = resolveShopBusinessType(profile);

  const [shopName, setShopName] = useState(
    profile.shopName === 'मेरी किराना दुकान' || profile.shopName === 'My Kirana Store'
      ? ''
      : profile.shopName
  );
  const [ownerName, setOwnerName] = useState(
    profile.ownerName === 'दुकानदार' || profile.ownerName === 'Shopkeeper'
      ? ''
      : profile.ownerName
  );
  const [businessType, setBusinessType] = useState<string>(initialBusinessType);
  const [customBusinessType, setCustomBusinessType] = useState(profile.customBusinessType || '');
  const [description, setDescription] = useState(profile.description || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [address, setAddress] = useState(profile.address || '');
  const [selectedStarters, setSelectedStarters] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const currentConfig = useMemo(() => {
    return getBusinessTypeConfig(businessType, customBusinessType);
  }, [businessType, customBusinessType]);

  if (!isOpen) return null;

  const handleBusinessTypeChange = (newType: string) => {
    setBusinessType(newType);
    setSelectedStarters([]); // Reset starters on category change
    if (newType !== 'other') {
      setCustomBusinessType('');
    }
  };

  const toggleStarterItem = (name: string) => {
    setSelectedStarters((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      setError('Please enter your shop name');
      return;
    }
    if (!ownerName.trim()) {
      setError('Please enter the owner name');
      return;
    }
    if (businessType === 'other' && !customBusinessType.trim()) {
      setError('Please specify your custom business type');
      return;
    }

    const effectiveCategory =
      businessType === 'other' && customBusinessType.trim()
        ? customBusinessType.trim()
        : currentConfig.title;

    // 1. Update Profile with Business Type & Optional Description
    const profileResult = updateShopProfile({
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      category: effectiveCategory,
      businessType,
      customBusinessType: businessType === 'other' ? customBusinessType.trim() : undefined,
      description: description.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      isOnboarded: false,
    });

    if (!profileResult.success) { setError(profileResult.error || 'Profile save nahi hua. Dobara koshish karein.'); return; }
    // 2. Add Selected Starter Products if any
    if (selectedStarters.length > 0) {
      const itemsToAdd = currentConfig.starterItems
        .filter((i) => selectedStarters.includes(i.name))
        .map((i) => ({
          name: i.name,
          unit: i.unit,
          category: i.category,
          openingStock: null, // Stock not yet recorded (accurate inventory tracking)
          sellingPrice: null, // Price not yet set
          minStockAlert: 5,
        }));
      const result = saveProductsBatch(itemsToAdd);
      if (!result.success) { setError(result.error || 'Products save nahi hue. Profile draft safe hai.'); return; }
    }

    const completed = updateShopProfile({ isOnboarded: true });
    if (!completed.success) { setError(completed.error || 'Setup could not finish. Please retry.'); return; }
    onComplete();
  };

  return (
    <AccessibleDialog label="Set up your shop" className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5">
        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
            <Store className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Apna dukaan counter shuru karein
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            Neeche apni dukaan set up karein, ya demo mein aadha kilo cheeni ka cash bill bana kar dekhein.
          </p>
            <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold text-emerald-800 underline" onClick={() => {
              try { loadDemoShop(); } catch { setError('Demo nahi khula. Storage aur doosre tab ki jaanch karein.'); }
            }}>Pehle demo dukaan dekhein</button>
          <p className="text-xs text-slate-600">
            Practice bill alag demo dukaan mein save hoga.
          </p>

        </div>

        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Shop Name & Owner Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-600" />
                <span>Shop Name *</span>
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Gupta Medical &amp; General"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>Owner Name *</span>
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Ram Lal Gupta"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Shop Type / Business Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Business Type *</span>
              <span className="text-[11px] text-slate-500 font-normal">Adapts categories &amp; units</span>
            </label>
            <select
              value={businessType}
              onChange={(e) => handleBusinessTypeChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {BUSINESS_TYPES.map((bt) => (
                <option key={bt.id} value={bt.id}>
                  {bt.title} ({bt.hindiTitle})
                </option>
              ))}
            </select>
          </div>

          {/* If "Other" Business Type is Selected */}
          {businessType === 'other' && (
            <div className="space-y-1.5 p-3 bg-amber-50/70 border border-amber-200 rounded-2xl animate-in fade-in">
              <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Specify Your Business Type *</span>
              </label>
              <input
                type="text"
                required
                value={customBusinessType}
                onChange={(e) => setCustomBusinessType(e.target.value)}
                placeholder="e.g. Tailoring &amp; Boutique, Pet Supplies, Sweet Shop..."
                className="w-full px-3.5 py-2 text-sm font-semibold border border-amber-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
              />
            </div>
          )}

          {/* Optional Business Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Business Description (Optional)</span>
              <span className="text-[11px] text-slate-400 font-normal">e.g. Retail, wholesale, specialization</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Retail pharmacy dispensing branded medicines and supplements"
              className="w-full px-3.5 py-2 text-xs sm:text-sm font-medium bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Phone & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Mobile Number (Optional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98765 43210"
                className="w-full px-3.5 py-2 text-sm font-medium bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Shop Address (Optional)</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Main Market, Shop No. 12"
                className="w-full px-3.5 py-2 text-sm font-medium bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Dynamic Starter Inventory Selection (Adapts to Selected Business Type!) */}
          {currentConfig.starterItems.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Select Starter {currentConfig.shortLabel} Items (Optional):</span>
                </label>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {selectedStarters.length} selected
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Tap items to add them to your inventory with appropriate units. Stock can be recorded later.
              </p>

              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 no-scrollbar">
                {currentConfig.starterItems.map((item) => {
                  const isSelected = selectedStarters.includes(item.name);
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => toggleStarterItem(item.name)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3 h-3" />}
                      <span>{item.name}</span>
                      <span className="text-[10px] opacity-75 font-normal">({item.unit})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Launch {currentConfig.shortLabel} Store</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </AccessibleDialog>
  );
};
