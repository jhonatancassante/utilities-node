export function getNextSortState(currentSort, key) {
  if (currentSort?.key !== key) return { key, direction: "asc" };
  if (currentSort.direction === "asc") return { key, direction: "desc" };
  return null;
}

function parseNumericValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim().replace(/\s/g, "");
  let numericValue = normalized;
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalized)) {
    numericValue = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
    numericValue = normalized.replace(/,/g, "");
  } else if (/^[-+]?\d+(,\d+)?$/.test(normalized)) {
    numericValue = normalized.replace(",", ".");
  } else if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const parsed = Number(numericValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDateValue(value) {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/.test(value.trim()) &&
    !Number.isNaN(new Date(value).getTime());
}

function getColumnType(records, key) {
  const values = records.map((record) => record[key]).filter(
    (value) => value !== null && value !== undefined && value !== "",
  );
  if (!values.length) return "text";
  if (values.every((value) => parseNumericValue(value) !== null)) return "number";
  if (values.every(isDateValue)) return "date";
  return "text";
}

function compareValues(first, second, type) {
  const firstEmpty = first === null || first === undefined || first === "";
  const secondEmpty = second === null || second === undefined || second === "";
  if (firstEmpty || secondEmpty) return firstEmpty === secondEmpty ? 0 : firstEmpty ? 1 : -1;
  if (type === "number") return parseNumericValue(first) - parseNumericValue(second);
  if (type === "date") return new Date(first).getTime() - new Date(second).getTime();
  return String(first).localeCompare(String(second), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortRecords(records, sortState) {
  if (!sortState) return records;
  const type = getColumnType(records, sortState.key);
  const direction = sortState.direction === "desc" ? -1 : 1;
  return records
    .map((record, index) => ({ record, index }))
    .sort((first, second) => {
      const firstValue = first.record[sortState.key];
      const secondValue = second.record[sortState.key];
      const comparison = compareValues(firstValue, secondValue, type);
      if (comparison === 0) return first.index - second.index;
      const firstEmpty = firstValue === null || firstValue === undefined || firstValue === "";
      const secondEmpty = secondValue === null || secondValue === undefined || secondValue === "";
      if (firstEmpty || secondEmpty) return comparison;
      return comparison * direction;
    })
    .map(({ record }) => record);
}
