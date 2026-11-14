'use client';

import { useState } from 'react';
import type { Product, SaleItem } from '../../types';
import { findCounterProducts, quantityMessage } from '../../lib/counter';
import { requiresWholeQuantity } from '../../lib/accounting';

type Props = {
  products: Product[];
  cart: SaleItem[];
  busy: boolean;
  onAdd: (id: string, quantity: number) => void;
};

export default function ProductPicker({ products, cart, busy, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const matches = findCounterProducts(products, query);
  const selected = matches.find(p => p.id === selectedId) ?? matches[0];
  const inCart = cart.find(item => item.productId === selected?.id)?.quantity ?? 0;
  const message = selected ? quantityMessage(selected, Number(quantity), inCart) : '';

  if (!products.length) return <p>Stock register mein pehla saamaan jodein.</p>;
  return <form className="counter-picker" onSubmit={event => {
    event.preventDefault();
    if (!selected || message || busy) return;
    onAdd(selected.id, Number(quantity));
    setQuantity('1');
  }}>
    <label>Saamaan dhoondhein
      <input type="search" value={query} placeholder="Naam, brand, SKU ya barcode" onChange={event => {
        setQuery(event.target.value);
        setSelectedId('');
        setQuantity('1');
      }}/>
    </label>
    {selected ? <>
      <label>Saamaan chunein
        <select value={selected.id} onChange={event => { setSelectedId(event.target.value); setQuantity('1'); }}>
          {matches.map(product => <option key={product.id} value={product.id}>
            {[product.name, product.brandOrVariant, product.sku].filter(Boolean).join(' · ')}
          </option>)}
        </select>
      </label>
      <div className="counter-product">
        <strong>{selected.sellingPrice === null ? 'Daam darj karein' : '₹' + selected.sellingPrice.toLocaleString('en-IN') + ' / ' + selected.unit}</strong>
        <span>{selected.currentStock === null ? 'Stock ki ginti darj nahi hai' : 'Stock mein ' + selected.currentStock + ' ' + selected.unit}</span>
        {inCart > 0 && <span>Is bill mein {inCart} {selected.unit}</span>}
      </div>
      <label>Matra ({selected.unit})
        <input type="number" inputMode="decimal" min={requiresWholeQuantity(selected.unit) ? 1 : 0.001}
          step={requiresWholeQuantity(selected.unit) ? 1 : 0.001} value={quantity} required
          aria-describedby={message ? 'counter-quantity-help' : undefined} onChange={event => setQuantity(event.target.value)}/>
      </label>
      {message && <p role="status" id="counter-quantity-help">{message}</p>}
      <button disabled={busy || Boolean(message)}>Bill mein jodein</button>
    </> : <p role="status">Koi saamaan nahi mila. Naam ya barcode dobara dekhein.</p>}
  </form>;
}
