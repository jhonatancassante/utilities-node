import styles from "./index.module.css";

function AdminDataTable({
  records,
  columns,
  selectable = false,
  selectedIds = [],
  allVisibleSelected = false,
  onToggleRecord,
  onTogglePage,
  getSelectionLabel,
  renderActions,
  onRowClick,
  maxHeight = "min(940px, 70vh)",
}) {
  return (
    <div
      className={styles.tableWrapper}
      style={{ maxHeight, overflowY: "auto" }}
    >
      <table>
        <thead>
          <tr>
            {selectable && (
              <th>
                <input
                  type="checkbox"
                  aria-label="Selecionar todos desta página"
                  checked={allVisibleSelected}
                  onChange={(event) => onTogglePage(event.target.checked)}
                />
              </th>
            )}
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.id}
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
                    checked={selectedIds.includes(record.id)}
                    onChange={() => onToggleRecord(record.id)}
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
              <td
                className={styles.actionCell}
                onClick={(event) => event.stopPropagation()}
              >
                {renderActions(record, styles.actionLink)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminDataTable;
