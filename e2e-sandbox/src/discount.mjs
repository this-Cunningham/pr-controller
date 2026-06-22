// discount helpers
export function applyDiscount(price, pct) {
  const discounted = price - price * (pct / 100);
  return Math.round(discounted);
}
