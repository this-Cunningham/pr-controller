// naive deep clone
export function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}
