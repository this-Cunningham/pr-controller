// case helpers
export function kebabToCamel(s) {
  return String(s).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
