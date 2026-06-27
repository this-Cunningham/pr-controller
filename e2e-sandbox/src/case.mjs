// case helpers
export function kebabToCamel(s) {
  if (s == null) return '';
  return String(s).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
