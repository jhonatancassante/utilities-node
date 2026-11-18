// lib/api.js
// Cliente HTTP compartilhado para consumir os endpoints da aplicação.

export class APIError extends Error {
  constructor({ name, message, action, statusCode }) {
    super(message || "Não foi possível concluir a solicitação.");

    this.name = name || "APIError";
    this.action = action;
    this.statusCode = statusCode;
  }
}

async function requestAPI(path, options = {}) {
  const { headers = {}, ...requestOptions } = options;
  const response = await fetch(path, {
    ...requestOptions,
    headers: {
      Accept: "application/json",
      ...(requestOptions.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    throw new APIError({
      name: responseBody?.name,
      message: responseBody?.message,
      action: responseBody?.action,
      statusCode: response.status,
    });
  }

  return responseBody;
}

export default requestAPI;
