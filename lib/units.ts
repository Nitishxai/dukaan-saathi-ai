/** Convert an explicit AI quantity into the inventory's canonical unit. */
export function normalizeQuantity(quantity: number, from: string, to: string): number | null {
  const aliases: Record<string,string> = { g: 'gm', gram: 'gm', grams: 'gm', kilogram: 'kg', kilo: 'kg', liter: 'litre', l: 'litre', pcs: 'piece', pieces: 'piece' };
  const source = aliases[from.toLowerCase()] || from.toLowerCase();
  const target = aliases[to.toLowerCase()] || to.toLowerCase();
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const units: Record<string,[string,number]> = { kg:['mass',1000],gm:['mass',1],litre:['volume',1000],ml:['volume',1] };
  let converted = quantity;
  if (source !== target) {
    if (!units[source] || !units[target] || units[source][0] !== units[target][0]) return null;
    converted = quantity * units[source][1] / units[target][1];
  }
  const rounded = Math.round(converted * 1000) / 1000;
  return rounded > 0 && Math.abs(rounded - converted) < 1e-9 ? rounded : null;
}
