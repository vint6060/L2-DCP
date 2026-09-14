export const PAGE_SIZE = 50;

export function getPageCount(items, pageSize = PAGE_SIZE) {
  return Math.max(1, Math.ceil(items.length / pageSize));
}

export function paginate(items, page, pageSize = PAGE_SIZE) {
  const pageCount = getPageCount(items, pageSize);
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), currentPage, pageCount };
}
