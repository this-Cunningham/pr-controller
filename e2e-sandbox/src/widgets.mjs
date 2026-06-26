// widget helpers (multi-thread e2e)
export function widgetLabel(w) {
  return w.name || 'untitled';
}
export function widgetPrice(w) {
  return w.price ?? 0;
}
export function widgetTags(w, sep = ', ') {
  return (w.tags || []).join(sep);
}
