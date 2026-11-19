// features/json-to-csv/lib/json.js
import Papa from "papaparse";

/**
 * Normaliza o JSON para uma lista de registros que possam ser tabulados.
 * Arrays de objetos representam registros; valores simples e arrays aninhados
 * são colocados na coluna "value". Um objeto com uma única propriedade array
 * utiliza o conteúdo dessa propriedade como origem dos registros.
 *
 * @param {unknown} parsed
 * @returns {object[] | null}
 */
export function normalizeToRows(parsed) {
  if (Array.isArray(parsed)) {
    return parsed.map((item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? item
        : { value: item },
    );
  }

  if (parsed && typeof parsed === "object") {
    const arrayProperties = Object.keys(parsed).filter((key) =>
      Array.isArray(parsed[key]),
    );

    if (arrayProperties.length === 1) {
      return normalizeToRows(parsed[arrayProperties[0]]);
    }

    return [parsed];
  }

  return null;
}

/**
 * Coleta as propriedades na ordem em que aparecem pela primeira vez.
 *
 * @param {object[]} rows
 * @returns {string[]}
 */
export function collectOrderedFields(rows) {
  const fields = [];
  const seen = new Set();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        fields.push(key);
      }
    });
  });

  return fields;
}

/**
 * Converte valores de células para texto. Objetos e arrays são serializados
 * como JSON; valores nulos ou ausentes geram células vazias.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function cellToText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Gera CSV somente com as colunas selecionadas.
 *
 * @param {object[]} rows
 * @param {string[]} fields
 * @param {string} delimiter
 * @returns {string}
 */
export function createCsv(rows, fields, delimiter = ";") {
  if (!rows.length || !fields.length) return "";

  const rowsAsText = rows.map((row) =>
    Object.fromEntries(fields.map((field) => [field, cellToText(row[field])])),
  );

  return Papa.unparse(rowsAsText, {
    delimiter,
    columns: fields,
    header: true,
  });
}

/**
 * Codifica texto em ISO-8859-1, substituindo caracteres não representáveis
 * por "?".
 *
 * @param {string} value
 * @returns {Uint8Array}
 */
export function stringToLatin1Bytes(value) {
  const characters = Array.from(value);
  const bytes = new Uint8Array(characters.length);

  characters.forEach((character, index) => {
    const codePoint = character.codePointAt(0);
    bytes[index] = codePoint <= 0xff ? codePoint : 0x3f;
  });

  return bytes;
}
