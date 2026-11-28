import database from "@/infra/database.js";
import { NotFoundError, ValidationError } from "@/infra/errors.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABLE_NAME_PATTERN = /^[a-z_]+$/;

export const MAX_BULK_DELETE = 500;

export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// Um ID fora do formato UUID nunca existe no banco. Sem esta checagem o
// Postgres devolve erro 22P02 e a API responderia 5xx em vez de 404.
export function assertRecordId(id, { message, action }) {
  if (!isUuid(id)) {
    throw new NotFoundError({ message, action });
  }
}

export async function softDeleteMany(
  table,
  ids,
  { selectionLabel, notFoundMessage, notFoundAction },
) {
  if (!TABLE_NAME_PATTERN.test(table)) {
    throw new Error(`Nome de tabela inválido para exclusão em lote: ${table}`);
  }

  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_BULK_DELETE ||
    !ids.every(isUuid) ||
    new Set(ids).size !== ids.length
  ) {
    throw new ValidationError({
      message: `A exclusão em lote deve conter entre 1 e ${MAX_BULK_DELETE} IDs únicos.`,
      action: `Revise a seleção de ${selectionLabel} e tente novamente.`,
    });
  }

  return database.transaction(async (client) => {
    const results = await client.query({
      text: `
        UPDATE ${table}
        SET deleted_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
        RETURNING *
      ;`,
      values: [ids],
    });

    if (results.rowCount !== ids.length) {
      throw new NotFoundError({
        message: notFoundMessage,
        action: notFoundAction,
      });
    }

    return results.rows;
  });
}
