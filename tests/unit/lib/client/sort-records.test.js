import { getNextSortState, sortRecords } from "@/lib/client/sort-records.js";

describe("sortRecords", () => {
  test("ordena números como números", () => {
    const records = [{ value: "100" }, { value: "20" }, { value: "3" }];
    expect(sortRecords(records, { key: "value", direction: "asc" })).toEqual([
      { value: "3" },
      { value: "20" },
      { value: "100" },
    ]);
  });

  test("reconhece números no formato brasileiro", () => {
    const records = [
      { value: "1.250,50" },
      { value: "20,00" },
      { value: "300,00" },
    ];
    expect(sortRecords(records, { key: "value", direction: "asc" })).toEqual([
      { value: "20,00" },
      { value: "300,00" },
      { value: "1.250,50" },
    ]);
  });

  test("ordena datas cronologicamente", () => {
    const records = [
      { date: "2026-11-20T10:00:00.000Z" },
      { date: "2025-01-10T10:00:00.000Z" },
      { date: "2026-01-01T10:00:00.000Z" },
    ];
    expect(sortRecords(records, { key: "date", direction: "asc" })).toEqual([
      records[1],
      records[2],
      records[0],
    ]);
  });

  test("ordena textos com comparação numérica natural", () => {
    const records = [{ value: "Cadastro 10" }, { value: "Cadastro 2" }];
    expect(sortRecords(records, { key: "value", direction: "asc" })).toEqual([
      records[1],
      records[0],
    ]);
  });

  test("mantém valores vazios no final em ordem decrescente", () => {
    const records = [{ value: null }, { value: 2 }, { value: 10 }];
    expect(sortRecords(records, { key: "value", direction: "desc" })).toEqual([
      records[2],
      records[1],
      records[0],
    ]);
  });

  test("restaura a ordem original quando não há ordenação", () => {
    const records = [{ value: 3 }, { value: 1 }, { value: 2 }];
    expect(sortRecords(records, null)).toBe(records);
  });
});

describe("getNextSortState", () => {
  test("alterna crescente, decrescente e sem ordenação", () => {
    expect(getNextSortState(null, "year")).toEqual({
      key: "year",
      direction: "asc",
    });
    expect(getNextSortState({ key: "year", direction: "asc" }, "year")).toEqual(
      {
        key: "year",
        direction: "desc",
      },
    );
    expect(
      getNextSortState({ key: "year", direction: "desc" }, "year"),
    ).toBeNull();
  });

  test("inicia outra coluna em ordem crescente", () => {
    expect(
      getNextSortState({ key: "year", direction: "desc" }, "decree"),
    ).toEqual({
      key: "decree",
      direction: "asc",
    });
  });
});
