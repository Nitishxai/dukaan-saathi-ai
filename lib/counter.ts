import type { Product } from '../types/index.ts';
import { requiresWholeQuantity, roundPrecision } from './accounting.ts';

export function findCounterProducts(products: Product[], query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/);
  return products.filter(product => {
    const fields = [product.name, product.hindiName, product.brandOrVariant, product.sku, product.barcode]
      .filter(Boolean).join(' ').toLowerCase();
    return terms.every(term => fields.includes(term));
  });
}

export function quantityMessage(product: Product, quantity: number, inCart: number) {
  if (product.sellingPrice === null) return 'Stock register mein pehle daam bharein.';
  if (!Number.isFinite(quantity) || quantity <= 0 || roundPrecision(quantity, 3) !== quantity)
    return 'Matra sahi bharein (adhiktam 3 decimal).';
  if (requiresWholeQuantity(product.unit) && !Number.isInteger(quantity))
    return 'Is saamaan ki matra poore number mein bharein.';
  if (product.currentStock !== null && roundPrecision(quantity + inCart, 3) > product.currentStock)
    return 'Bill mein jodne ke liye stock kam hai.';
  return '';
}
