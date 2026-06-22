// safe parsing
export function safeParseInt(s) {
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}
