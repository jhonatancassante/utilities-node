import styles from "./index.module.css";

function AdminDataTable({
  records, columns, selectable = false, selectedIds = [],
  allVisibleSelected = false, onToggleRecord, onTogglePage,
  getSelectionLabel, renderActions, showActions = true, onRowClick,
  getRowKey = (record) => record.id, sortState = null, onSort,
  sortAnnouncement = "", caption = "Tabela de dados",
  maxHeight = "min(940px, 70vh)",
}) {
  return (
    <div
      className={styles.tableWrapper + (showActions ? " " + styles.hasActions : "")}
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
                  onChange={(event) => onTogglePage(event.target.checked)}
                />
              </th>
            )}
            {columns.map((column) => {
              const isSorted = sortState?.key === column.key;
              const ariaSort = isSorted
                ? sortState.direction === "asc" ? "ascending" : "descending"
                : undefined;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={column.sortable === false ? undefined : styles.sortableHeader}
                >
                  {column.sortable === false || !onSort ? column.label : (
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={() => onSort(column.key, column.label)}
                    >
                      <span>{column.label}</span>
                      <i
                        className={"fas " + (isSorted
                          ? sortState.direction === "asc" ? "fa-sort-up" : "fa-sort-down"
                          : "fa-sort")}
                        aria-hidden="true"
                      ></i>
                    </button>
                  )}
                </th>
              );
            })}
            {showActions && <th scope="col" className={styles.actionsHeader}>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr
              key={getRowKey(record, index)}
              className={onRowClick ? styles.clickableRow : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(record) : undefined}
              onKeyDown={onRowClick ? (event) => {
                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onRowClick(record);
                }
              } : undefined}
            >
              {selectable && (
                <td onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={getSelectionLabel(record)}
                    checked={selectedIds.includes(record.id)}
                    onChange={() => onToggleRecord(record.id)}
                  />
                </td>
              )}
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(record) : (record[column.key] ?? "—")}
                </td>
              ))}
              {showActions && (
                <td className={styles.actionCell} onClick={(event) => event.stopPropagation()}>
                  {renderActions?.(record, styles.actionLink)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <span className={styles.visuallyHidden} role="status" aria-live="polite">
        {sortAnnouncement}
      </span>
    </div>
  );
}

export default AdminDataTable;
