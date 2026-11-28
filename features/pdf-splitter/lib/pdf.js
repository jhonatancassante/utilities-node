// features/pdf-splitter/lib/pdf.js
// Regras do Divisor de PDF, independentes de React. O processamento ocorre
// no navegador: os arquivos não são enviados ao servidor. `pdf-lib` e `jszip`
// são importados sob demanda, dentro das funções que os utilizam.
import { getFormattedTimestamp } from "@/lib/client/files.js";

const PDF_EXTENSION = ".pdf";

/**
 * Valida os campos numéricos do intervalo de páginas.
 *
 * @param {{ pageInit: string | number, pageCount: string | number }} input
 * @returns {{ ok: true, value: { pageInit: number, pageCount: number } } | { ok: false, error: string }}
 */
export function validateRange({ pageInit, pageCount }) {
  const init = Number(pageInit);
  const count = Number(pageCount);

  if (String(pageInit).trim() === "" || !Number.isInteger(init) || init < 1) {
    return {
      ok: false,
      error:
        "Informe uma página inicial válida (número inteiro a partir de 1).",
    };
  }

  if (
    String(pageCount).trim() === "" ||
    !Number.isInteger(count) ||
    count < 1
  ) {
    return {
      ok: false,
      error:
        "Informe um número de páginas válido (número inteiro a partir de 1).",
    };
  }

  return { ok: true, value: { pageInit: init, pageCount: count } };
}

/**
 * Acrescenta à lista os arquivos .pdf escolhidos, sem repetir nomes já
 * selecionados.
 *
 * @param {{ name: string }[]} current
 * @param {{ name: string }[]} incoming
 * @returns {{ ok: true, files: { name: string }[] } | { ok: false, error: string }}
 */
export function addPdfFiles(current, incoming) {
  const pdfs = Array.from(incoming).filter((file) =>
    file.name.toLowerCase().endsWith(PDF_EXTENSION),
  );

  if (pdfs.length === 0) {
    return { ok: false, error: "Por favor, selecione apenas arquivos .pdf." };
  }

  const knownNames = new Set(current.map((file) => file.name));
  const added = pdfs.filter((file) => {
    if (knownNames.has(file.name)) {
      return false;
    }
    knownNames.add(file.name);
    return true;
  });

  return { ok: true, files: [...current, ...added] };
}

/** Nome do PDF gerado a partir do original. */
export function buildOutputName(fileName, pageInit, pageCount) {
  return `${pageCount}_pages_from_${pageInit}_${fileName}`;
}

const pluralizePages = (count) =>
  `${count} ${count === 1 ? "página" : "páginas"}`;

/**
 * Extrai um intervalo de páginas de um PDF. Se o documento tiver menos
 * páginas que o pedido, extrai da página inicial até a última. Se o documento
 * não chegar à página inicial, não há o que extrair e o arquivo é ignorado.
 *
 * @param {{ name: string, arrayBuffer: () => Promise<ArrayBuffer> }} file
 * @param {number} pageInit Primeira página (começa em 1).
 * @param {number} pageCount Quantidade de páginas pedidas.
 * @returns {Promise<
 *   { ok: true, status: "extracted", bytes: Uint8Array, totalPages: number, extractedCount: number }
 *   | { ok: true, status: "skipped", totalPages: number }
 *   | { ok: false, error: string }
 * >}
 */
export async function extractPages(file, pageInit, pageCount) {
  const { PDFDocument } = await import("pdf-lib");

  let source;
  try {
    source = await PDFDocument.load(await file.arrayBuffer());
  } catch {
    return {
      ok: false,
      error: `Não foi possível ler "${file.name}": o arquivo não é um PDF válido ou está protegido por senha.`,
    };
  }

  const totalPages = source.getPageCount();
  const startIndex = pageInit - 1;

  if (startIndex >= totalPages) {
    return { ok: true, status: "skipped", totalPages };
  }

  const endIndex = Math.min(startIndex + pageCount, totalPages);
  const extractedCount = endIndex - startIndex;
  const pageIndices = Array.from(
    { length: extractedCount },
    (_, offset) => startIndex + offset,
  );

  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, pageIndices);
  pages.forEach((page) => output.addPage(page));

  return {
    ok: true,
    status: "extracted",
    bytes: await output.save(),
    totalPages,
    extractedCount,
  };
}

/**
 * Texto do aviso de um arquivo que não tem páginas suficientes.
 * Retorna `null` quando o arquivo atendeu ao intervalo completo.
 */
function describeShortfall(file, result, pageInit, pageCount) {
  const total = pluralizePages(result.totalPages);

  if (result.status === "skipped") {
    return `"${file.name}" tem apenas ${total} e não chega à página ${pageInit}: foi ignorado.`;
  }

  if (result.extractedCount < pageCount) {
    const lastPage = pageInit + result.extractedCount - 1;
    const extracted =
      result.extractedCount === 1
        ? `foi extraída a página ${pageInit}`
        : `foram extraídas as páginas ${pageInit} a ${lastPage}`;
    return `"${file.name}" tem apenas ${total}: ${extracted}.`;
  }

  return null;
}

/**
 * Extrai o intervalo de cada arquivo. Com um único arquivo o resultado é um
 * PDF; com vários, um ZIP com todos os PDFs extraídos. Arquivos com menos
 * páginas que o pedido são extraídos até o fim (ou ignorados, se não chegam à
 * página inicial) e listados em `warnings`.
 *
 * @param {{ name: string, arrayBuffer: () => Promise<ArrayBuffer> }[]} files
 * @param {{ pageInit: number, pageCount: number }} range
 * @param {Date} [now]
 * @returns {Promise<
 *   { ok: true, blob: Blob, filename: string, warnings: string[] }
 *   | { ok: false, error: string }
 * >}
 */
export async function splitPdfFiles(files, { pageInit, pageCount }, now) {
  const outputs = [];
  const warnings = [];

  // Em sequência (e não em paralelo) para limitar o uso de memória com PDFs grandes.
  for (const file of files) {
    const result = await extractPages(file, pageInit, pageCount);
    if (!result.ok) {
      return result;
    }

    const warning = describeShortfall(file, result, pageInit, pageCount);
    if (warning) {
      warnings.push(warning);
    }

    if (result.status === "extracted") {
      outputs.push({
        name: buildOutputName(file.name, pageInit, result.extractedCount),
        bytes: result.bytes,
      });
    }
  }

  if (outputs.length === 0) {
    return {
      ok: false,
      error: `Nenhum dos arquivos tem a página ${pageInit}. Informe uma página inicial menor.`,
    };
  }

  if (outputs.length === 1) {
    const [{ name, bytes }] = outputs;
    return {
      ok: true,
      blob: new Blob([bytes], { type: "application/pdf" }),
      filename: name,
      warnings,
    };
  }

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  outputs.forEach(({ name, bytes }) => zip.file(name, bytes));

  return {
    ok: true,
    blob: await zip.generateAsync({ type: "blob" }),
    filename: `${getFormattedTimestamp(now)}.zip`,
    warnings,
  };
}
