// features/qr-code/lib/url.js

const ALLOWED_PROTOCOLS = ["http:", "https:"];

/**
 * Normaliza e valida o link digitado pela pessoa.
 * Aceita "exemplo.com" (assume https://) e rejeita texto que não seja um
 * endereço http(s) válido.
 *
 * @param {string} input
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function normalizeUrl(input) {
  const invalid = {
    ok: false,
    error: "Digite um link válido, por exemplo: https://exemplo.com",
  };
  const trimmed = (input ?? "").trim();

  if (!trimmed) {
    return { ok: false, error: "Digite o link que deseja codificar." };
  }

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url;
  try {
    url = new URL(withProtocol);
  } catch {
    return invalid;
  }

  const hasDomain = url.hostname.includes(".") || url.hostname === "localhost";
  if (!ALLOWED_PROTOCOLS.includes(url.protocol) || !hasDomain) {
    return invalid;
  }

  return { ok: true, value: withProtocol };
}
