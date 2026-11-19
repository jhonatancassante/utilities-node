// features/txt-to-csv/lib/txt.js
// Leitura e conversão de relatórios TXT com colunas de largura fixa.

const COLUMN_GAP = /\S {2,}\S/;

/**
 * Decodifica o conteúdo do arquivo como UTF-8 ou, se inválido, Windows-1252.
 *
 * @param {ArrayBuffer} buffer
 * @returns {{ text: string, encoding: string }}
 */
export function decodeBuffer(buffer) {
  const bytes = new Uint8Array(buffer);

  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "UTF-8",
    };
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(bytes),
      encoding: "Windows-1252",
    };
  }
}

/**
 * Identifica o início de cada coluna a partir dos espaços do cabeçalho.
 *
 * @param {string} headerLine
 * @returns {number[]}
 */
function findColumnStarts(headerLine) {
  const starts = [];

  for (let index = 0; index < headerLine.length; index += 1) {
    if (headerLine[index] === " ") continue;

    const atStart = index === 0 || headerLine[index - 1] === " ";
    const afterGap =
      index === 0 ||
      (headerLine[index - 1] === " " &&
        (index === 1 || headerLine[index - 2] === " "));

    if (atStart && afterGap) starts.push(index);
  }

  // A primeira coluna começa no início da linha, inclusive quando há recuo.
  if (starts.length) starts[0] = 0;

  return starts;
}

/**
 * Interpreta relatório de largura fixa. O cabeçalho pode estar na primeira
 * linha ou na segunda, precedido por um título.
 *
 * @param {string} text
 * @returns {{ title: string|null, headers: string[], rows: string[][], headerLineNumber: number, misaligned: number }}
 */
export function parseFixedWidth(text) {
  const lines = text.split(/\r\n|\n|\r/);

  while (lines.length && !lines[lines.length - 1].trim()) {
    lines.pop();
  }

  let firstLineIndex = 0;

  while (firstLineIndex < lines.length && !lines[firstLineIndex].trim()) {
    firstLineIndex += 1;
  }

  if (firstLineIndex >= lines.length) {
    throw new Error("O arquivo está vazio.");
  }

  let headerIndex = -1;

  for (
    let index = firstLineIndex;
    index < Math.min(firstLineIndex + 2, lines.length);
    index += 1
  ) {
    if (COLUMN_GAP.test(lines[index].trimEnd())) {
      headerIndex = index;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error(
      "Não encontrei a linha de colunas na 1ª nem na 2ª linha do arquivo.",
    );
  }

  const title =
    headerIndex > firstLineIndex ? lines[firstLineIndex].trim() : null;
  const headerLine = lines[headerIndex];
  const starts = findColumnStarts(headerLine);

  if (starts.length < 2) {
    throw new Error("Não consegui identificar as colunas do cabeçalho.");
  }

  const headers = starts.map((start, index) =>
    headerLine
      .slice(start, index + 1 < starts.length ? starts[index + 1] : undefined)
      .trim(),
  );

  const rows = [];
  let misaligned = 0;

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.trim()) continue;

    let isMisaligned = false;

    const row = starts.map((start, columnIndex) => {
      if (columnIndex > 0 && start <= line.length && line[start - 1] !== " ") {
        isMisaligned = true;
      }

      return line
        .slice(
          start,
          columnIndex + 1 < starts.length ? starts[columnIndex + 1] : undefined,
        )
        .trim();
    });

    if (isMisaligned) misaligned += 1;
    rows.push(row);
  }

  return {
    title,
    headers,
    rows,
    headerLineNumber: headerIndex + 1,
    misaligned,
  };
}

/**
 * Aplica as opções de formatação a um valor.
 *
 * @param {string} value
 * @param {{ dateOnly?: boolean, decimalDot?: boolean }} options
 * @returns {string}
 */
export function formatValue(value, options = {}) {
  let formattedValue = value;

  if (options.dateOnly) {
    formattedValue = formattedValue.replace(
      /^(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}(?::\d{2})?$/,
      "$1",
    );
  }

  if (options.decimalDot) {
    formattedValue = formattedValue.replace(/^(-?\d+),(\d+)$/, "$1.$2");
  }

  return formattedValue;
}

/**
 * Escapa uma célula CSV quando ela contém delimitador, aspas ou quebra de linha.
 *
 * @param {string} value
 * @param {string} separator
 * @returns {string}
 */
function escapeCell(value, separator) {
  if (
    value.includes(separator) ||
    value.includes('"') ||
    /[\r\n]/.test(value)
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/**
 * Gera CSV com CRLF e quebra de linha ao final do arquivo.
 *
 * @param {string[]} headers
 * @param {string[][]} rows
 * @param {{ separator?: string, decimalDot?: boolean, dateOnly?: boolean }} options
 * @returns {string}
 */
export function toCsv(headers, rows, options = {}) {
  const settings = {
    separator: ";",
    decimalDot: false,
    dateOnly: false,
    ...options,
  };

  const format = (value) =>
    formatValue(value, {
      dateOnly: settings.dateOnly,
      decimalDot: settings.decimalDot,
    });

  const output = [
    headers.map((header) => escapeCell(header, settings.separator)),
  ];

  rows.forEach((row) => {
    output.push(
      row.map((cell) => escapeCell(format(cell), settings.separator)),
    );
  });

  return (
    output.map((row) => row.join(settings.separator)).join("\r\n") + "\r\n"
  );
}
