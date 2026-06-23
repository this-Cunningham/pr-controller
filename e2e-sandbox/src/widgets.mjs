// widget helpers (multi-thread e2e)
export function widgetLabel(w) {
  return w.name ?? 'untitled';
}
export function widgetPrice(w) {
  return w.price == null ? 0 : w.price;
}
export function widgetTags(w, sep = ', ') {
  return (w.tags || []).join(sep);
}
