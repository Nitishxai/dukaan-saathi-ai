'use client';

import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Edit2,
  Trash2,
  X,
  TrendingDown,
  HelpCircle,
  Info,
  Calendar,
  Hash,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import { Product, UnitType, ShopProfile } from '../../types';
import {
  formatCurrency,
  formatQuantity,
  UNIT_LABELS,
} from '../../lib/formatters';
import {
  addProduct,
  updateProduct,
  deleteProduct,
  quickAddStock,
  getStockClassification,
  getActiveProfile,
} from '../../lib/storage';
import {
  resolveShopBusinessType,
  getBusinessTypeConfig,
  getEffectiveBusinessLabel,
  getQuickAdjustDeltas,
  getVariantLabel,
  getBusinessTypeTheme,
} from '../../lib/business-config';

interface InventoryTabProps {
  products: Product[];
  onRefresh: () => void;
  profile?: ShopProfile;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  products,
  onRefresh,
  profile,
}) => {
  const activeProfile = profile || getActiveProfile();
  const businessType = resolveShopBusinessType(activeProfile);
  const config = getBusinessTypeConfig(businessType, activeProfile?.customBusinessType);
  const effectiveBusinessLabel = getEffectiveBusinessLabel(activeProfile);
  const theme = getBusinessTypeTheme(businessType);
  const variantLabel = getVariantLabel(businessType);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low_stock' | 'out_of_stock' | 'unrecorded'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    brandOrVariant: string;
    category: string;
    customCategory: string;
    unit: UnitType;
    customUnit: string;
    currentStock: string;
    sellingPrice: string;
    purchasePrice: string;
    minStockAlert: string;
    supplier: string;
    size: string;
    color: string;
    modelNumber: string;
    warranty: string;
    batchNumber: string;
    expiryDate: string;
  }>({
    name: '',
    brandOrVariant: '',
    category: config.categories[0] || 'General',
    customCategory: '',
    unit: (config.defaultUnit as UnitType) || 'piece',
    customUnit: '',
    currentStock: '',
    sellingPrice: '',
    purchasePrice: '',
    minStockAlert: '5',
    supplier: '',
    size: '',
    color: '',
    modelNumber: '',
    warranty: '',
    batchNumber: '',
    expiryDate: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Extract distinct categories (merging configured categories for this shop type with existing products)
  const categories = useMemo(() => {
    const set = new Set<string>();
    config.categories.forEach((c) => set.add(c));
    products.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [products, config.categories]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search) ||
        (p.brandOrVariant && p.brandOrVariant.toLowerCase().includes(search)) ||
        (p.category && p.category.toLowerCase().includes(search)) ||
        (p.modelNumber && p.modelNumber.toLowerCase().includes(search)) ||
        (p.size && p.size.toLowerCase().includes(search)) ||
        (p.color && p.color.toLowerCase().includes(search)) ||
        (p.batchNumber && p.batchNumber.toLowerCase().includes(search));

      if (!matchesSearch) return false;

      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      const cls = getStockClassification(p);
      if (filterType === 'low_stock') {
        return cls === 'low_stock';
      }
      if (filterType === 'out_of_stock') {
        return cls === 'out_of_stock';
      }
      if (filterType === 'unrecorded') {
        return cls === 'unrecorded';
      }

      return true;
    });
  }, [products, searchTerm, filterType, selectedCategory]);

  // Open Edit Modal
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    const isCustomCat = !config.categories.includes(p.category);
    const standardUnits = Object.keys(UNIT_LABELS);
    const isCustomUnit = !standardUnits.includes(p.unit) && !config.units.includes(p.unit);

    setFormData({
      name: p.name,
      brandOrVariant: p.brandOrVariant || '',
      category: isCustomCat ? '__custom__' : p.category,
      customCategory: isCustomCat ? p.category : '',
      unit: isCustomUnit ? ('__custom__' as UnitType) : p.unit,
      customUnit: isCustomUnit ? p.unit : '',
      currentStock: p.currentStock !== null && p.currentStock !== undefined ? p.currentStock.toString() : '',
      sellingPrice: p.sellingPrice !== null && p.sellingPrice !== undefined ? p.sellingPrice.toString() : '',
      purchasePrice: p.purchasePrice ? p.purchasePrice.toString() : '',
      minStockAlert: p.minStockAlert ? p.minStockAlert.toString() : '5',
      supplier: p.supplier || '',
      size: p.size || '',
      color: p.color || '',
      modelNumber: p.modelNumber || '',
      warranty: p.warranty || '',
      batchNumber: p.batchNumber || '',
      expiryDate: p.expiryDate || '',
    });
    setFormError(null);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      brandOrVariant: '',
      category: config.categories[0] || 'General',
      customCategory: '',
      unit: (config.defaultUnit as UnitType) || 'piece',
      customUnit: '',
      currentStock: '',
      sellingPrice: '',
      purchasePrice: '',
      minStockAlert: '5',
      supplier: '',
      size: '',
      color: '',
      modelNumber: '',
      warranty: '',
      batchNumber: '',
      expiryDate: '',
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Form Submit (Add or Edit)
  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Product Name is required.');
      return;
    }

    const finalCategory =
      formData.category === '__custom__'
        ? formData.customCategory.trim() || 'General'
        : formData.category;

    if (formData.category === '__custom__' && !formData.customCategory.trim()) {
      setFormError('Please enter a custom category name.');
      return;
    }

    const finalUnit = (
      formData.unit === '__custom__'
        ? formData.customUnit.trim() || 'piece'
        : formData.unit
    ) as UnitType;

    if (formData.unit === '__custom__' && !formData.customUnit.trim()) {
      setFormError('Please enter a custom unit name.');
      return;
    }

    // Optional stock quantity: if left blank, store as null (unrecorded)!
    const currentStock =
      formData.currentStock.trim() !== ''
        ? Math.round(parseFloat(formData.currentStock) * 1000) / 1000
        : null;
    if (currentStock !== null && (isNaN(currentStock) || currentStock < 0)) {
      setFormError('Stock quantity must be zero or positive.');
      return;
    }

    // Optional selling price: if left blank, store as null!
    const sellingPrice =
      formData.sellingPrice.trim() !== ''
        ? Number(parseFloat(formData.sellingPrice).toFixed(2))
        : null;
    if (sellingPrice !== null && (isNaN(sellingPrice) || sellingPrice <= 0)) {
      setFormError('Selling price must be greater than zero.');
      return;
    }

    // Optional purchase price: if left blank, store as null!
    const purchasePrice =
      formData.purchasePrice.trim() !== ''
        ? Number(parseFloat(formData.purchasePrice).toFixed(2))
        : null;
    if (purchasePrice !== null && (isNaN(purchasePrice) || purchasePrice < 0)) {
      setFormError('Cost / Purchase price must be zero or positive.');
      return;
    }

    const minStockAlert = formData.minStockAlert ? parseFloat(formData.minStockAlert) : 5;
    if (isNaN(minStockAlert) || minStockAlert < 0) {
      setFormError('Low stock alert limit must be zero or positive.');
      return;
    }

    // Duplicate name check
    const trimmedName = formData.name.trim();
    if (editingProduct) {
      const duplicate = products.find(
        (p) => p.id !== editingProduct.id && p.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        setFormError(`Product with name "${trimmedName}" already exists in inventory.`);
        return;
      }
    } else {
      const duplicate = products.find(
        (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        setFormError(`Product with name "${trimmedName}" already exists in inventory.`);
        return;
      }
    }

    const payload = {
      name: trimmedName,
      brandOrVariant: formData.brandOrVariant.trim() || undefined,
      category: finalCategory,
      unit: finalUnit,
      currentStock,
      sellingPrice,
      purchasePrice,
      minStockAlert,
      supplier: formData.supplier.trim() || undefined,
      size: formData.size.trim() || undefined,
      color: formData.color.trim() || undefined,
      modelNumber: formData.modelNumber.trim() || undefined,
      warranty: formData.warranty.trim() || undefined,
      batchNumber: formData.batchNumber.trim() || undefined,
      expiryDate: formData.expiryDate.trim() || undefined,
    };

    if (editingProduct) {
      const res = updateProduct(editingProduct.id, payload);

      if (!res.success) {
        setFormError(res.error || 'Failed to update product.');
        return;
      }
      setEditingProduct(null);
    } else {
      const res = addProduct(payload);

      if (!res.success) {
        setFormError(res.error || 'Failed to add product.');
        return;
      }
      setIsAddModalOpen(false);
    }

    onRefresh();
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!deletingProduct) return;
    deleteProduct(deletingProduct.id);
    setDeletingProduct(null);
    onRefresh();
  };

  // Quick Adjustment
  const handleQuickAdjust = (productId: string, delta: number) => {
    quickAddStock(productId, delta);
    onRefresh();
  };

  return (
    <div className="space-y-5 pb-20 md:pb-8">
      {/* Top Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Store Inventory &amp; Products
            </h2>
            <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              {effectiveBusinessLabel}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Total {products.length} products • Add, edit, or adjust stock tailored for your store
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>+ Add Product</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search products (e.g. ${config.starterItems.slice(0, 3).map((i) => i.name).join(', ')})...`}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder-slate-400 font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="sm:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 font-medium cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-colors cursor-pointer ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({products.length})
          </button>
          <button
            onClick={() => setFilterType('low_stock')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterType === 'low_stock'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              Low Stock ({products.filter((p) => getStockClassification(p) === 'low_stock').length})
            </span>
          </button>
          <button
            onClick={() => setFilterType('out_of_stock')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterType === 'out_of_stock'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-100 text-red-900 hover:bg-red-200'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>
              Out of Stock ({products.filter((p) => getStockClassification(p) === 'out_of_stock').length})
            </span>
          </button>
          <button
            onClick={() => setFilterType('unrecorded')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterType === 'unrecorded'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>
              Unrecorded Stock ({products.filter((p) => getStockClassification(p) === 'unrecorded').length})
            </span>
          </button>
        </div>
      </div>

      {/* Products Grid / Cards */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-extrabold text-slate-800 text-base">No Products Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No products match the search query or selected filter. Try another keyword or add a new product.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            + Add Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredProducts.map((p) => {
            const cls = getStockClassification(p);
            const isOut = cls === 'out_of_stock';
            const isLow = cls === 'low_stock';
            const isUnrecorded = cls === 'unrecorded';

            return (
              <div
                key={p.id}
                className={`bg-white rounded-3xl border p-4 shadow-xs transition-shadow hover:shadow-md flex flex-col justify-between ${
                  isOut
                    ? 'border-red-300 bg-red-50/20'
                    : isLow
                    ? 'border-amber-300 bg-amber-50/20'
                    : isUnrecorded
                    ? 'border-slate-300 bg-slate-50/30'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Top row: Category Badge & Status Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                    >
                      {p.category || config.shortLabel}
                    </span>
                    {isOut ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                        Out of Stock (0)
                      </span>
                    ) : isLow ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                        Low Stock
                      </span>
                    ) : isUnrecorded ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        Unrecorded Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        In Stock
                      </span>
                    )}
                  </div>

                  {/* Product Title & Brand/Variant */}
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug">
                      {p.name}
                      {p.hindiName && (
                        <span className="text-xs text-slate-500 font-normal ml-1">
                          ({p.hindiName})
                        </span>
                      )}
                    </h3>
                    {p.brandOrVariant && (
                      <div className="text-xs text-slate-500 font-medium mt-0.5">
                        <span className="text-slate-400 font-normal">{variantLabel}: </span>
                        <strong className="text-slate-700">{p.brandOrVariant}</strong>
                      </div>
                    )}

                    {/* Business-Type Tailored Attribute Badges */}
                    {/* Medical / Pharmacy: Batch Number & Expiry Date */}
                    {(p.batchNumber || p.expiryDate) && (
                      <div className="mt-2.5 p-2 bg-purple-50/80 border border-purple-200/80 rounded-2xl flex flex-wrap items-center gap-2 text-xs">
                        {p.batchNumber && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-purple-200 text-purple-900 font-semibold shadow-2xs">
                            <Hash className="w-3.5 h-3.5 text-purple-600" />
                            <span>Batch: <strong className="font-bold">{p.batchNumber}</strong></span>
                          </span>
                        )}
                        {p.expiryDate && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-amber-300 text-amber-950 font-semibold shadow-2xs">
                            <Calendar className="w-3.5 h-3.5 text-amber-600" />
                            <span>Exp: <strong className="font-bold text-amber-900">{p.expiryDate}</strong></span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Clothing / Garments: Size & Color */}
                    {(p.size || p.color) && (
                      <div className="mt-2.5 p-2 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl flex flex-wrap items-center gap-2 text-xs">
                        {p.size && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-indigo-200 text-indigo-950 font-semibold shadow-2xs">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase">Size</span>
                            <strong className="text-sm font-extrabold text-indigo-900">{p.size}</strong>
                          </span>
                        )}
                        {p.color && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-800 font-semibold shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Color</span>
                            <strong className="font-bold text-slate-900">{p.color}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Electronics & Mobile Accessories: Model & Warranty */}
                    {(p.modelNumber || p.warranty) && (
                      <div className="mt-2.5 p-2 bg-sky-50/80 border border-sky-200/80 rounded-2xl flex flex-wrap items-center gap-2 text-xs">
                        {p.modelNumber && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-sky-200 text-sky-950 font-semibold shadow-2xs">
                            <Cpu className="w-3.5 h-3.5 text-sky-600" />
                            <span>Model: <strong className="font-mono font-bold text-sky-900">{p.modelNumber}</strong></span>
                          </span>
                        )}
                        {p.warranty && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-emerald-200 text-emerald-950 font-semibold shadow-2xs">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Warranty: <strong className="font-bold text-emerald-900">{p.warranty}</strong></span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Fruits & Vegetables: Sold By Unit */}
                    {businessType === 'fruits_vegetables' && (
                      <div className="mt-2.5 p-2 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 text-emerald-900 font-semibold">
                          <span className="text-[10px] uppercase tracking-wider text-emerald-700 bg-white border border-emerald-200 px-1.5 py-0.5 rounded font-bold">Sold By</span>
                          <strong className="text-emerald-950 capitalize">{p.unit}</strong>
                        </span>
                        <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-100/60 px-2 py-0.5 rounded-lg">
                          Fresh Daily Produce
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Price & Stock info */}
                  <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">Selling Price</div>
                      <div className="text-base sm:text-lg font-extrabold text-emerald-700">
                        {p.sellingPrice !== null && p.sellingPrice !== undefined ? (
                          <>
                            {formatCurrency(p.sellingPrice)}
                            <span className="text-xs text-slate-500 font-normal"> / {p.unit}</span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 font-normal italic">Not set</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-slate-500 font-medium">
                        {businessType === 'fruits_vegetables' ? 'Available Produce' : 'Current Stock'}
                      </div>
                      <div
                        className={`text-base sm:text-lg font-extrabold ${
                          isOut
                            ? 'text-red-600'
                            : isLow
                            ? 'text-amber-800'
                            : isUnrecorded
                            ? 'text-slate-400 italic text-sm'
                            : 'text-slate-900'
                        }`}
                      >
                        {p.currentStock !== null && p.currentStock !== undefined
                          ? formatQuantity(p.currentStock, p.unit)
                          : 'Not recorded'}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
                    <span>Min Alert: {p.minStockAlert} {p.unit}</span>
                    {p.purchasePrice && (
                      <span>Cost: {formatCurrency(p.purchasePrice)}</span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions: Quick Adjust & Edit/Delete */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Dynamic Quick Stock Adjustment Buttons */}
                  {(() => {
                    const { deltaSmall, labelSmall, deltaLarge, labelLarge } = getQuickAdjustDeltas(p.unit);
                    return (
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleQuickAdjust(p.id, deltaSmall)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title={`Increase stock by ${deltaSmall}`}
                        >
                          {labelSmall}
                        </button>
                        <button
                          onClick={() => handleQuickAdjust(p.id, deltaLarge)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title={`Add bulk stock by ${deltaLarge}`}
                        >
                          {labelLarge}
                        </button>
                      </div>
                    );
                  })()}

                  {/* Edit & Delete Icons */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                      title="Edit Product"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingProduct(p)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {(isAddModalOpen || editingProduct) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  {editingProduct ? 'Edit Product' : 'Add Product'}
                </h3>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                  Tailored for {effectiveBusinessLabel}
                </span>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-1">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={config.placeholders.name}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Brand/Variant & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Brand / Variant (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.brandOrVariant}
                    onChange={(e) => setFormData({ ...formData, brandOrVariant: e.target.value })}
                    placeholder={config.placeholders.brandOrVariant}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white cursor-pointer"
                  >
                    <optgroup label={`${config.shortLabel} Categories`}>
                      {config.categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                    {categories.filter((c) => !config.categories.includes(c)).length > 0 && (
                      <optgroup label="Other Existing Categories">
                        {categories
                          .filter((c) => !config.categories.includes(c))
                          .map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    <option value="__custom__">+ Custom Category...</option>
                  </select>
                </div>
              </div>

              {/* Custom Category Input if selected */}
              {formData.category === '__custom__' && (
                <div className="animate-in fade-in">
                  <label className="block text-xs font-bold text-emerald-800 mb-1">
                    Custom Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customCategory}
                    onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                    placeholder="e.g. Specialty Spices, Organic Produce"
                    className="w-full px-3 py-2 text-sm border border-emerald-300 bg-emerald-50/30 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Dynamic Extra Fields for Pharmacy (Batch & Expiry) */}
              {config.extraFields?.showBatchExpiry && (
                <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-2xl space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Batch Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.batchNumber}
                        onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                        placeholder="e.g. BT-9082"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.expiryDate}
                        onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                        placeholder="e.g. 12/26 or 2026-12"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>
                  {config.extraFields.complianceDisclaimer && (
                    <div className="text-[11px] text-purple-900 bg-purple-100/70 p-2 rounded-xl flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-purple-700 shrink-0 mt-0.5" />
                      <span>{config.extraFields.complianceDisclaimer}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Extra Fields for Clothing / Garments (Size & Color) */}
              {config.extraFields?.showSizeColor && (
                <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Size (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      placeholder="e.g. M, L, XL, 32, Free Size"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Color (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="e.g. Navy Blue, Maroon, Black"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic Extra Fields for Electronics / Mobiles (Model & Warranty) */}
              {config.extraFields?.showModelWarranty && (
                <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-2xl grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Model Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.modelNumber}
                      onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                      placeholder="e.g. SM-A546B, WH-1000XM5"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Warranty (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.warranty}
                      onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                      placeholder="e.g. 1 Year Brand, 6 Months"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Unit & Low Stock Alert */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unit *
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value as UnitType })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white cursor-pointer"
                  >
                    <optgroup label={`Recommended for ${config.shortLabel}`}>
                      {config.units.map((u) => (
                        <option key={u} value={u}>
                          {UNIT_LABELS[u]?.hindi || u}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="All Units">
                      {Object.entries(UNIT_LABELS)
                        .filter(([k]) => !config.units.includes(k))
                        .map(([key, label]) => (
                          <option key={key} value={key}>
                            {label.hindi}
                          </option>
                        ))}
                    </optgroup>
                    <option value="__custom__">+ Custom Unit...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Low Stock Alert Limit
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.minStockAlert}
                    onChange={(e) => setFormData({ ...formData, minStockAlert: e.target.value })}
                    placeholder="5"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Custom Unit Input if selected */}
              {formData.unit === '__custom__' && (
                <div className="animate-in fade-in">
                  <label className="block text-xs font-bold text-emerald-800 mb-1">
                    Custom Unit Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customUnit}
                    onChange={(e) => setFormData({ ...formData, customUnit: e.target.value })}
                    placeholder="e.g. bunch, bundle, roll, quintal"
                    className="w-full px-3 py-2 text-sm border border-emerald-300 bg-emerald-50/30 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Current Stock & Selling Price (Both optional to prevent forcing user!) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Current Stock (Optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                    placeholder="Leave blank if unrecorded"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Selling Price (₹, Optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    placeholder="₹ 0"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Purchase Price & Supplier */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Purchase Cost (₹, Optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    placeholder="₹ 0"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supplier / Wholesaler (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="Wholesaler name"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  {editingProduct ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">Delete Product?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <span className="font-semibold text-slate-800">{deletingProduct.name}</span> from inventory?
              </p>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2.5">
              <button
                onClick={() => setDeletingProduct(null)}
                className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
