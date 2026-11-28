const EMPTY_VALUE = "—";

function toValidDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

// Ex.: 28/11/2026 08:14:00 (fuso do navegador). Vazio ou inválido vira "—".
export function formatDateTime(value) {
  const date = toValidDate(value);

  if (!date) {
    return EMPTY_VALUE;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

// Ex.: 28/11/2026. Vazio ou inválido vira "—".
export function formatDate(value) {
  const date = toValidDate(value);

  return date ? date.toLocaleDateString("pt-BR") : EMPTY_VALUE;
}
