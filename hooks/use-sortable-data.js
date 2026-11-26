import { useCallback, useMemo, useState } from "react";
import { getNextSortState, sortRecords } from "@/lib/client/sort-records.js";

export default function useSortableData(records) {
  const [sortState, setSortState] = useState(null);
  const [sortAnnouncement, setSortAnnouncement] = useState("");
  const sortedRecords = useMemo(
    () => sortRecords(records, sortState),
    [records, sortState],
  );
  const handleSort = useCallback((key, label) => {
    const nextSortState = getNextSortState(sortState, key);
    setSortState(nextSortState);
    setSortAnnouncement(
      nextSortState
        ? "Ordenado por " + label + ", ordem " +
            (nextSortState.direction === "asc" ? "crescente." : "decrescente.")
        : "Ordenação removida. A ordem original foi restaurada.",
    );
  }, [sortState]);
  return { sortedRecords, sortState, handleSort, sortAnnouncement };
}
