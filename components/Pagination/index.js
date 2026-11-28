import Button from "@/components/Button";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

const PAGE_SIZES = [10, 20, 50, 100, 200, 500];
const PAGINATION_BUTTON_STYLE = {
  width: 32,
  minWidth: 32,
  height: 32,
  minHeight: 32,
  padding: 6,
  fontSize: 12,
  flexShrink: 0,
};

function Pagination({
  setPage,
  pageSize,
  setPageSize,
  pageCount,
  currentPage,
}) {
  const paginationStart = Math.max(1, Math.min(currentPage - 2, pageCount - 3));
  const paginationEnd = Math.min(pageCount, paginationStart + 3);
  const paginationPages = Array.from(
    { length: paginationEnd - paginationStart + 1 },
    (_, index) => paginationStart + index,
  );

  return (
    <div className={styles.pagination}>
      <label>
        Registros por página{" "}
        <select
          className={shared.input}
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(1);
          }}
        >
          {PAGE_SIZES.map((size) => (
            <option value={size} key={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span>
          Página {currentPage} de {pageCount}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "6px",
          }}
          aria-label="Navegação de páginas"
        >
          <Button
            type="button"
            variant="outline"
            icon="fa-angle-double-left"
            title="Primeira página"
            aria-label="Primeira página"
            onClick={() => setPage(1)}
            disabled={currentPage === 1}
            style={PAGINATION_BUTTON_STYLE}
          />
          <Button
            type="button"
            variant="outline"
            icon="fa-chevron-left"
            title="Página anterior"
            aria-label="Página anterior"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
            style={PAGINATION_BUTTON_STYLE}
          />
          {paginationStart > 1 && <span aria-hidden="true">…</span>}
          {paginationPages.map((pageNumber) => (
            <Button
              key={pageNumber}
              type="button"
              variant={pageNumber === currentPage ? "primary" : "outline"}
              onClick={() => setPage(pageNumber)}
              aria-label={"Página " + pageNumber}
              aria-current={pageNumber === currentPage ? "page" : undefined}
              style={PAGINATION_BUTTON_STYLE}
            >
              {pageNumber}
            </Button>
          ))}
          {paginationEnd < pageCount && <span aria-hidden="true">…</span>}
          <Button
            type="button"
            variant="outline"
            icon="fa-chevron-right"
            title="Próxima página"
            aria-label="Próxima página"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === pageCount}
            style={PAGINATION_BUTTON_STYLE}
          />
          <Button
            type="button"
            variant="outline"
            icon="fa-angle-double-right"
            title="Última página"
            aria-label="Última página"
            onClick={() => setPage(pageCount)}
            disabled={currentPage === pageCount}
            style={PAGINATION_BUTTON_STYLE}
          />
        </div>
      </div>
    </div>
  );
}

export default Pagination;
