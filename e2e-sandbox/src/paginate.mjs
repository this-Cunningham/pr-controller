export function paginate(items, page, size) {
  return items.slice(page * size, page * size + size);
}
