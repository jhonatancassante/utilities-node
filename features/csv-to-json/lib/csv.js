// features/csv-to-json/lib/csv.js
import Papa from "papaparse";

/**
 * Interpreta o conteúdo CSV usando o delimitador informado ou a detecção
 * automática do Papa Parse.
 *
 * @param {string} content
 * @param {string} delimiter
 * @returns {{ data: object[], fields: string[], error: string }}
 */
export function parseCsv(content, delimiter = "auto") {
  const headerOccurrences = new Map();
  const usedHeaders = new Set();

  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    delimiter: delimiter === "auto" ? "" : delimiter,
    transformHeader(header) {
      const occurrence = (headerOccurrences.get(header) ?? 0) + 1;
      headerOccurrences.set(header, occurrence);

      if (occurrence === 1 && !usedHeaders.has(header)) {
        usedHeaders.add(header);
        return header;
      }

      let suffix = Math.max(occurrence, 2);
      let uniqueHeader = `${header} (${suffix})`;

      while (usedHeaders.has(uniqueHeader)) {
        suffix += 1;
        uniqueHeader = `${header} (${suffix})`;
      }

      usedHeaders.add(uniqueHeader);
      return uniqueHeader;
    },
  });

  const fields = result.meta?.fields ?? [];
  const fatalError = result.errors?.find(
    (error) => error.type !== "FieldMismatch",
  );

  return {
    data: result.data ?? [],
    fields,
    error: fatalError?.message ?? "",
  };
}

/**
 * Converte os registros mantendo somente as colunas selecionadas.
 *
 * @param {object[]} data
 * @param {string[]} fields
 * @returns {string}
 */
export function createJson(data, fields) {
  if (!data.length || !fields.length) return "";

  const filteredData = data.map((row) => {
    const filteredRow = {};

    fields.forEach((field) => {
      const value = row[field];
      filteredRow[field] =
        typeof value === "string" ? value.trim() : (value ?? "");
    });

    return filteredRow;
  });

  return JSON.stringify(filteredData, null, 4);
}
