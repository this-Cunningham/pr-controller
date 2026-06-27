// widget helpers (multi-thread e2e)
export function widgetLabel(widget) {
  return widget.name || 'untitled';
}
export function widgetPrice(widget) {
  return widget.price ?? 0;
}
export function widgetTags(widget, sep = ', ') {
  return (widget.tags || []).join(sep);
}
