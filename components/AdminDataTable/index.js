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
            <tr key={record.id}>
              {selectable && (
                <td>
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
              <td className={styles.actionCell}>
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
