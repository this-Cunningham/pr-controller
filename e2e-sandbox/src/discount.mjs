// discount helpers
export function applyDiscount(price, pct) {
  const c = price - price * (pct / 100);
  return Math.round(c);
}
