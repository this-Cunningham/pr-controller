// Medium module: a tiny in-memory inventory / cart model.
import { MAX_ITEMS, DEFAULT_CURRENCY } from './version.mjs';

export class Inventory {
  constructor() {
    this.items = {};
  }

  // Add `qty` of `sku` at `price` (price in cents). Throws when the distinct-SKU
  // cap is reached.
  add(sku, qty = 1, price = 0) {
    if (!(sku in this.items) && Object.keys(this.items).length >= MAX_ITEMS) {
      throw new Error('inventory full');
    }
    const cur = this.items[sku] || { qty: 0, price };
    this.items[sku] = { qty: cur.qty + qty, price };
    return this.items[sku];
  }

  // Remove `qty` of `sku`; drops the line when it hits zero. Returns remaining qty.
  remove(sku, qty = 1) {
    const cur = this.items[sku];
    if (!cur) return 0;
    cur.qty -= qty;
    if (cur.qty <= 0) {
      delete this.items[sku];
      return 0;
    }
    return cur.qty;
  }

  count(sku) {
    return this.items[sku]?.qty || 0;
  }

  total() {
    let amount = 0;
    for (const { qty, price } of Object.values(this.items)) {
      amount += qty * price;
    }
    return { amount, currency: DEFAULT_CURRENCY };
  }
}
