// features/qr-code/lib/download.js

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
 * Captura um elemento do DOM como PNG com fundo transparente e inicia o
 * download. O html2canvas só roda no navegador, por isso é importado sob
 * demanda (não entra no bundle inicial nem quebra a renderização no servidor).
 *
 * @param {HTMLElement} element
 * @param {string} [filename]
 */
export async function downloadElementAsPng(
  element,
  filename = `qrcode_${getFormattedTimestamp()}.png`,
) {
  const { default: html2canvas } = await import("html2canvas");

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: null,
    logging: false,
    useCORS: true,
  });

  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
