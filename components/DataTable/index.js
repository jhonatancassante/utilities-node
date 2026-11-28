import Pagination from "@/components/Pagination";
import RowAction from "./RowAction.js";
import styles from "./index.module.css";

const NO_SORT = { sortState: null, handleSort: null, sortAnnouncement: "" };

function DataTable({
  records,
  columns,
  selection = null,
  getSelectionLabel,
  renderActions,
  showActions = Boolean(renderActions),
  onRowClick,
  getRowKey = (record) => record.id,
  sort = NO_SORT,
  pagination = null,
  loading = false,
  loadingMessage = "Carregando registros...",
  emptyMessage = "Nenhum registro encontrado.",
  caption = "Tabela de dados",
  monospace = false,
  maxHeight = "min(940px, 70vh)",
}) {
  const { sortState, handleSort: onSort, sortAnnouncement } = sort;
  const selectable = Boolean(selection);
  const allVisibleSelected =
    selectable &&
    records.length > 0 &&
    records.every((record, index) =>
      selection.selectedSet.has(getRowKey(record, index)),
    );

  if (loading || records.length === 0) {
    return (
      <p className={styles.state} role="status">
        {loading ? loadingMessage : emptyMessage}
      </p>
    );
  }

  return (
    <>
      <div
        className={
          styles.tableWrapper +
          (showActions ? " " + styles.hasActions : "") +
          (monospace ? " " + styles.monospace : "")
        }
        style={{ maxHeight, overflowY: "auto" }}
      >
        <table>
          <caption className={styles.visuallyHidden}>{caption}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos desta página"
                    checked={allVisibleSelected}
                    onChange={(event) =>
                      selection.setManySelected(
                        records.map(getRowKey),
                        event.target.checked,
                      )
                    }
                  />
                </th>
              )}
              {columns.map((column) => {
                const isSorted = sortState?.key === column.key;
                const ariaSort = isSorted
                  ? sortState.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : undefined;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={
                      column.sortable === false
                        ? undefined
                        : styles.sortableHeader
                    }
                  >
                    {column.sortable === false || !onSort ? (
                      column.label
                    ) : (
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={() => onSort(column.key, column.label)}
                      >
                        <span>{column.label}</span>
                        <i
                          className={
                            "fas " +
                            (isSorted
                              ? sortState.direction === "asc"
                                ? "fa-sort-up"
                                : "fa-sort-down"
                              : "fa-sort")
                          }
                          aria-hidden="true"
                        ></i>
                      </button>
                    )}
                  </th>
                );
              })}
              {showActions && (
                <th scope="col" className={styles.actionsHeader}>
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => (
              <tr
                key={getRowKey(record, index)}
                className={onRowClick ? styles.clickableRow : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(record) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          onRowClick(record);
                        }
                      }
                    : undefined
                }
              >
                {selectable && (
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={getSelectionLabel(record)}
                      checked={selection.selectedSet.has(
                        getRowKey(record, index),
                      )}
                      onChange={() =>
                        selection.toggleRecord(getRowKey(record, index))
                      }
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render
                      ? column.render(record)
                      : (record[column.key] ?? "—")}
                  </td>
                ))}
                {showActions && (
                  <td
                    className={styles.actionCell}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {renderActions?.(record, styles.actionLink)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <span
          className={styles.visuallyHidden}
          role="status"
          aria-live="polite"
        >
          {sortAnnouncement}
        </span>
      </div>
      {pagination && <Pagination {...pagination} />}
    </>
  );
}

DataTable.RowAction = RowAction;

export default DataTable;
