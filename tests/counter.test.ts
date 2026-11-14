import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findCounterProducts, quantityMessage } from '../lib/counter.ts';
import type { Product } from '../types/index.ts';

const item: Product = { id:'p', name:'Sugar', hindiName:'चीनी', sku:'S-10', barcode:'00991', category:'Kirana', unit:'kg', currentStock:0.3, sellingPrice:45, minStockAlert:1, updatedAt:'2026-01-01' };

test('counter finds Hindi, SKU and leading-zero barcode matches', () => {
  for (const query of ['चीनी','s-10 sugar','00991']) assert.deepEqual(findCounterProducts([item],query),[item]);
  assert.deepEqual(findCounterProducts([item],'salt'),[]);
});

test('counter respects weighed stock, whole units and unset prices', () => {
  assert.equal(quantityMessage(item,0.1,0.2),'');
  for (const [quantity,inCart] of [[0.11,0.2],[0.0001,0],[NaN,0]]) assert.ok(quantityMessage(item,quantity,inCart));
  assert.ok(quantityMessage({...item,unit:'piece'},0.1,0));
  assert.ok(quantityMessage({...item,sellingPrice:null},0.1,0));
});
