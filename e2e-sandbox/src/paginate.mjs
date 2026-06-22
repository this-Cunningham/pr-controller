// pagination helper
export function paginate(items, page, size) {
  const pages = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages[page] || [];
}
