export function paginate(items, page, size) {
  if (page < 0 || size <= 0) return [];
  return items.slice(page * size, page * size + size);
}
