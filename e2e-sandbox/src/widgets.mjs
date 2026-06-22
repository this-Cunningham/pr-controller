// widget helpers (multi-thread e2e)
export function widgetLabel(w) {
  return w.name ? w.name : 'untitled';
}
export function widgetPrice(w) {
  return w.price == null ? 0 : w.price;
}
export function widgetTags(w) {
  return (w.tags || []).join(', ');
}
