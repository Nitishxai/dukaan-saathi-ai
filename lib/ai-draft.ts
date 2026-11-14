import type { AIParseResult, DukaanStoreData } from '../types';
import { normalizeQuantity } from './units.ts';
export function prepareAIDraft(result: AIParseResult, store: DukaanStoreData): AIParseResult {
  const draft = { ...result, shopId: store.profile.id, operationId: crypto.randomUUID() };
  if (!['sale','stock_add'].includes(result.intent) || !result.matchedProduct) return draft;
  const product=store.products.find(p=>p.id===result.matchedProduct?.id);
  const quantity=product ? normalizeQuantity(result.quantity ?? 0,result.unit || product.unit,product.unit) : null;
  if (!product || quantity === null) return {...draft,isAmbiguous:true,errorMessage:'Unit ya quantity sahi nahi hai. Dobara batayein.',matchedProduct:undefined};
  return {...draft,matchedProduct:product,quantity,unit:product.unit,amount:product.sellingPrice===null?undefined:Math.round(product.sellingPrice*quantity*100)/100};
}

export function draftSpeech(result:AIParseResult):string {
  return ['sale','stock_add','udhaar_given','udhaar_received','inventory_add','inventory_update'].includes(result.intent)
    ? 'Yeh abhi draft hai. Details check karke Confirm and Save dabayein.'
    : result.spokenResponse || result.message || 'Details check karein.';
}
