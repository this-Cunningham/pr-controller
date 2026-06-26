// safe parsing
export function safeParseInt(s) {
  const parsed = parseInt(s, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
