// lib/client/files.js
// Utilitários de arquivo compartilhados pelas ferramentas (executam no navegador).

/**
 * Gera uma string AAAAMMDDHHmmSS para nomear arquivos baixados.
 * @param {Date} [date]
 */
export function getFormattedTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");

  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

/**
 * Inicia o download de um Blob com o nome informado.
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Adia a liberação para não cancelar o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
