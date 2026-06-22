// Small numeric helpers.

// Sum an array of numbers.
export function sum(xs) {
  let total = 0;
  for (const x of xs) total += x;
  return total;
}

// Arithmetic mean (0 for an empty array).
export function mean(xs) {
  return xs.length ? sum(xs) / xs.length : 0;
}

// Constrain x to the inclusive [lo, hi] range.
export function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

// Greatest common divisor (Euclid).
export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}
