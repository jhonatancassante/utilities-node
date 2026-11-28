import { useState } from "react";

export const DEFAULT_PAGE_SIZE = 10;

export default function usePagination(
  records,
  initialPageSize = DEFAULT_PAGE_SIZE,
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRecords = records.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return {
    visibleRecords,
    currentPage,
    pageCount,
    pageSize,
    setPage,
    setPageSize,
    resetPage: () => setPage(1),
  };
}
