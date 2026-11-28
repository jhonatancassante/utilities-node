// features/pdf-merger/lib/pdf.js
// Regras de unificação independentes de React. O processamento ocorre no
// navegador: os arquivos não são enviados ao servidor. pdf-lib é carregado
// sob demanda, apenas quando a unificação é solicitada.
import { getFormattedTimestamp } from "@/lib/client/files.js";

const PDF_EXTENSION = ".pdf";

/**
 * Acrescenta arquivos PDF à seleção, sem repetir o mesmo arquivo.
 * Arquivos diferentes podem ter o mesmo nome.
 *
 * @param {{ name: string, size?: number, lastModified?: number }[]} current
 * @param {{ name: string, size?: number, lastModified?: number }[]} incoming
 * @returns {{ ok: true, files: object[] } | { ok: false, error: string }}
 */
export function addPdfFiles(current, incoming) {
  const pdfs = Array.from(incoming).filter((file) =>
    file.name.toLowerCase().endsWith(PDF_EXTENSION),
  );

  if (pdfs.length === 0) {
    return {
      ok: false,
      error: "Por favor, selecione apenas arquivos .pdf.",
    };
  }

  const getFileKey = (file) =>
    [file.name, file.size ?? "", file.lastModified ?? ""].join("::");
  const knownFiles = new Set(current.map(getFileKey));
  const added = pdfs.filter((file) => {
    const key = getFileKey(file);
    if (knownFiles.has(key)) {
      return false;
    }
    knownFiles.add(key);
    return true;
  });

  return { ok: true, files: [...current, ...added] };
}

/**
 * Ordena os arquivos alfabeticamente, considerando sequências numéricas.
 *
 * @param {{ name: string }[]} files
 */
export function sortPdfFiles(files) {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

/**
 * Unifica dois ou mais PDFs. Quando solicitado, acrescenta uma página em
 * branco após cada documento que tenha quantidade ímpar de páginas.
 *
 * @param {{ name: string, arrayBuffer: () => Promise<ArrayBuffer> }[]} files
 * @param {boolean} [addBlankPage=true]
 * @param {Date} [now]
 * @returns {Promise<
 *   { ok: true, bytes: Uint8Array, filename: string, pageCount: number }
 *   | { ok: false, error: string }
 * >}
 */
export async function mergePdfFiles(files, addBlankPage = true, now) {
  if (files.length < 2) {
    return {
      ok: false,
      error: "Selecione pelo menos dois arquivos PDF para unificar.",
    };
  }

  const { PDFDocument } = await import("pdf-lib");
  const mergedPdf = await PDFDocument.create();

  // Processamento sequencial para limitar o consumo de memória com PDFs grandes.
  for (const file of sortPdfFiles(files)) {
    let sourcePdf;

    try {
      sourcePdf = await PDFDocument.load(await file.arrayBuffer());
    } catch {
      return {
        ok: false,
        error: `Não foi possível ler "${file.name}". Verifique se o arquivo é um PDF válido e se não está protegido por senha.`,
      };
    }

    const pageCount = sourcePdf.getPageCount();

    if (pageCount === 0) {
      return {
        ok: false,
        error: `O arquivo "${file.name}" não contém páginas para unificar.`,
      };
    }

    const pageIndices = Array.from({ length: pageCount }, (_, index) => index);
    const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);

    copiedPages.forEach((page) => mergedPdf.addPage(page));

    if (addBlankPage && pageCount % 2 !== 0) {
      const lastPage = copiedPages[copiedPages.length - 1];
      const { width, height } = lastPage.getSize();
      mergedPdf.addPage([width, height]);
    }
  }

  const bytes = await mergedPdf.save();

  return {
    ok: true,
    bytes,
    filename: `${getFormattedTimestamp(now)}.pdf`,
    pageCount: mergedPdf.getPageCount(),
  };
}
