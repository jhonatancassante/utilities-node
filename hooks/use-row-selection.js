import { useCallback, useMemo, useState } from "react";

export default function useRowSelection() {
  const [selectedIds, setSelectedIds] = useState([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleRecord = useCallback((id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }, []);

  const setManySelected = useCallback((ids, checked) => {
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, ...ids]))
        : current.filter((id) => !ids.includes(id)),
    );
  }, []);

  const clear = useCallback(() => setSelectedIds([]), []);

  return { selectedIds, selectedSet, toggleRecord, setManySelected, clear };
}
