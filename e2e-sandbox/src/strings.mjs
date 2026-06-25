// slug helpers
// Small string helpers.

// Turn arbitrary text into a url-safe slug.
export function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Truncate to at most n characters, appending an ellipsis when cut.
export function truncate(s, n) {
  s = String(s);
  if (s.length <= n) return s;
  return s.slice(0, Math.max(0, n - 1)) + '…';
}

// Capitalize the first letter of every word.
export function titleCase(s) {
  return String(s)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toLowerCase());
}
