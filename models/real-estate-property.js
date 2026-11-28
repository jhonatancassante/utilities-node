import database from "@/infra/database.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/infra/errors.js";
import { assertRecordId, softDeleteMany } from "@/lib/server/record-helpers.js";

const FIELD_RULES = {
  year: { type: "integer", min: 1, max: 9999 },
  physical_property_id: { type: "integer", min: 1, required: true },
  physical_registration: { type: "string", maxLength: null, required: true },
  ctm: { type: "string", maxLength: null, required: true },
  ctm_count: { type: "integer", min: 0, required: true },
  grouping: { type: "string", maxLength: 1, required: true },
  property_block: { type: "string", maxLength: 20, nullable: true },
  property_lots: { type: "string", maxLength: 20, nullable: true },
  land_area: { type: "number", min: 0, max: 9999999999.99, required: true },
  built_area: { type: "number", min: 0, max: 9999999999.99 },
  property_neighborhood: { type: "string", maxLength: 70, required: true },
  owner_name: { type: "string", maxLength: 150, required: true },
  promissory_buyer: { type: "string", maxLength: 150, nullable: true },
  land_sector: { type: "string", maxLength: 4, required: true },
  property_street: { type: "string", maxLength: 150, required: true },
  property_number: { type: "number", min: 0, nullable: true },
  property_complement: { type: "string", maxLength: 150, nullable: true },
  construction_type: { type: "integer", min: 0, nullable: true },
  ideal_fraction: {
    type: "number",
    min: 0,
    max: 9999999999.99,
    nullable: true,
  },
  points: { type: "integer", min: 0, nullable: true },
  annual: { type: "boolean" },
};
const WRITABLE_FIELDS = Object.keys(FIELD_RULES);
const MAX_BULK_RECORDS = 100000;
const INSERT_BATCH_SIZE = 500;

function formatCtm(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return (
    digits.slice(0, 2) + "." + digits.slice(2, 7) + "." + digits.slice(7, 11)
  );
}

function validateInput(inputValues, { requiredFields = [] } = {}) {
  if (
    !inputValues ||
    typeof inputValues !== "object" ||
    Array.isArray(inputValues)
  ) {
    throw new ValidationError({
      message: "Os dados do imóvel devem ser enviados em um objeto.",
      action: "Envie um objeto com os campos cadastrais do imóvel.",
    });
  }

  const unknownFields = Object.keys(inputValues).filter(
    (field) => !WRITABLE_FIELDS.includes(field),
  );
  if (unknownFields.length) {
    throw new ValidationError({
      message: `Os campos a seguir não podem ser alterados: ${unknownFields.join(", ")}.`,
      action: `Envie apenas os campos: ${WRITABLE_FIELDS.join(", ")}.`,
    });
  }

  const missingFields = requiredFields.filter(
    (field) => !Object.hasOwn(inputValues, field),
  );
  if (missingFields.length) {
    throw new ValidationError({
      message: `Os campos obrigatórios não foram informados: ${missingFields.join(", ")}.`,
      action: "Preencha os dados cadastrais obrigatórios do imóvel.",
    });
  }

  const property = {};
  for (const [field, rule] of Object.entries(FIELD_RULES)) {
    if (!Object.hasOwn(inputValues, field)) continue;
    const value = inputValues[field];

    if (value === null || value === "") {
      if (rule.required || !rule.nullable) {
        throw new ValidationError({
          message: `O campo ${field} não pode ficar vazio.`,
          action: "Preencha o campo obrigatório e tente novamente.",
        });
      }
      property[field] = value === "" ? null : value;
      continue;
    }

    if (rule.type === "string") {
      if (
        typeof value !== "string" ||
        !value.trim() ||
        (rule.maxLength && value.trim().length > rule.maxLength)
      ) {
        throw new ValidationError({
          message: `O campo ${field} deve ser um texto válido${rule.maxLength ? ` de até ${rule.maxLength} caracteres` : ""}.`,
          action: "Revise o texto informado.",
        });
      }
      property[field] =
        field === "ctm" ? formatCtm(value.trim()) : value.trim();
      continue;
    }

    if (rule.type === "boolean") {
      if (typeof value !== "boolean") {
        throw new ValidationError({
          message: `O campo ${field} deve ser verdadeiro ou falso.`,
          action: "Informe um valor booleano.",
        });
      }
      property[field] = value;
      continue;
    }

    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (rule.type === "integer" && !Number.isInteger(value)) ||
      (rule.min !== undefined && value < rule.min) ||
      (rule.max !== undefined && value > rule.max) ||
      (rule.type === "number" && Math.round(value * 100) / 100 !== value)
    ) {
      throw new ValidationError({
        message: `O campo ${field} contém um valor numérico inválido.`,
        action: "Revise o número informado e respeite os limites do campo.",
      });
    }
    property[field] = value;
  }
  return property;
}

function applyIdealFractionDefault(property) {
  if (property.ideal_fraction == null && Object.hasOwn(property, "land_area")) {
    property.ideal_fraction = property.land_area;
  }
  return property;
}

function getColumns(property) {
  return WRITABLE_FIELDS.filter((field) => Object.hasOwn(property, field));
}

async function insertRecord(client, property) {
  const columns = getColumns(property);
  const values = columns.map((field) => property[field]);
  const placeholders = columns.map((field, index) => `$${index + 1}`);
  const results = await client.query({
    text: `
      INSERT INTO real_estate_properties (${columns.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *
    ;`,
    values,
  });
  return results.rows[0];
}

async function insertManyRecords(
  client,
  properties,
  { annual, returnRecords = true },
) {
  const records = returnRecords ? new Array(properties.length) : null;
  let start = 0;

  while (start < properties.length) {
    const columns = getColumns(properties[start]);
    let end = start + 1;

    while (
      end < properties.length &&
      end - start < INSERT_BATCH_SIZE &&
      JSON.stringify(getColumns(properties[end])) === JSON.stringify(columns)
    ) {
      end += 1;
    }

    const batch = properties.slice(start, end);
    const values = batch.flatMap((property) =>
      columns.map((field) => property[field]),
    );
    const valueGroups = batch.map((_, rowIndex) => {
      const placeholders = columns.map(
        (_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`,
      );
      return `(${placeholders.join(", ")})`;
    });
    const updateFields = columns.filter((field) =>
      annual
        ? !["year", "physical_property_id"].includes(field)
        : field !== "physical_property_id",
    );
    const updates = updateFields.map((field) => `${field} = EXCLUDED.${field}`);
    updates.push("updated_at = timezone('utc', now())");
    const conflictTarget = annual
      ? "(year, physical_property_id) WHERE annual = true AND deleted_at IS NULL"
      : "(physical_property_id) WHERE annual = false AND deleted_at IS NULL";
    const result = await client.query({
      text: `
        INSERT INTO real_estate_properties (${columns.join(", ")})
        VALUES ${valueGroups.join(", ")}
        ON CONFLICT ${conflictTarget}
        DO UPDATE SET ${updates.join(", ")}
        RETURNING ${returnRecords ? "*" : "id"}
      ;`,
      values,
    });

    if (returnRecords) {
      result.rows.forEach((record, index) => {
        records[start + index] = record;
      });
    }
    start = end;
  }

  return returnRecords ? records : properties.length;
}

async function create(inputValues) {
  const property = applyIdealFractionDefault(
    validateInput(inputValues, {
      requiredFields: Object.entries(FIELD_RULES)
        .filter(([, rule]) => rule.required)
        .map(([field]) => field),
    }),
  );
  if (!Object.hasOwn(property, "annual")) property.annual = false;

  return database.transaction(async (client) => {
    await client.query(
      "LOCK TABLE real_estate_properties IN SHARE ROW EXCLUSIVE MODE;",
    );

    if (property.annual) {
      const existing = await client.query({
        text: `
          SELECT id
          FROM real_estate_properties
          WHERE physical_property_id = $1
            AND year = $2
            AND annual = true
            AND deleted_at IS NULL
          LIMIT 1
        ;`,
        values: [property.physical_property_id, property.year],
      });
      if (existing.rowCount) {
        throw new ConflictError({
          message:
            "Já existe um cadastro para este código de imóvel. Para alterá-lo, pesquise o registro e utilize a opção Alterar.",
          action:
            "Cancele o cadastro e localize o imóvel existente na listagem.",
        });
      }
      return insertRecord(client, property);
    }

    const columns = getColumns(property);
    const values = columns.map((field) => property[field]);
    const placeholders = columns.map((field, index) => `$${index + 1}`);
    const updateFields = columns.filter(
      (field) => field !== "physical_property_id",
    );
    const updates = updateFields.map((field) => `${field} = EXCLUDED.${field}`);
    updates.push("updated_at = timezone('utc', now())");
    const results = await client.query({
      text: `
        INSERT INTO real_estate_properties (${columns.join(", ")})
        VALUES (${placeholders.join(", ")})
        ON CONFLICT (physical_property_id)
          WHERE annual = false AND deleted_at IS NULL
        DO UPDATE SET ${updates.join(", ")}
        RETURNING *
      ;`,
      values,
    });
    return results.rows[0];
  });
}

async function findAll() {
  const results = await database.query({
    text: `
      SELECT *
      FROM real_estate_properties
      WHERE deleted_at IS NULL
      ORDER BY year DESC, physical_registration, ctm
    ;`,
  });
  return results.rows;
}

async function findOneById(id) {
  assertRecordId(id, {
    message: "O imóvel informado não foi encontrado.",
    action: "Verifique o ID e tente novamente.",
  });

  const results = await database.query({
    text: `
      SELECT *
      FROM real_estate_properties
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1
    ;`,
    values: [id],
  });
  if (!results.rowCount) {
    throw new NotFoundError({
      message: "O imóvel informado não foi encontrado.",
      action: "Verifique o ID e tente novamente.",
    });
  }
  return results.rows[0];
}

async function update(id, inputValues) {
  assertRecordId(id, {
    message: "O imóvel informado não foi encontrado.",
    action: "Verifique o ID e tente novamente.",
  });

  const property = validateInput(inputValues);
  if (
    property.ideal_fraction === null &&
    !Object.hasOwn(property, "land_area")
  ) {
    property.ideal_fraction = undefined;
  } else {
    applyIdealFractionDefault(property);
  }
  const columns = getColumns(property);
  if (!columns.length) {
    throw new ValidationError({
      message: "Nenhum dado foi informado para atualização.",
      action: "Informe ao menos um campo que deseja alterar.",
    });
  }
  const values = columns
    .filter(
      (field) =>
        field !== "ideal_fraction" || property.ideal_fraction !== undefined,
    )
    .map((field) => property[field]);
  let parameterIndex = 2;
  const setClauses = columns.map((field) => {
    if (field === "ideal_fraction" && property.ideal_fraction === undefined) {
      return "ideal_fraction = land_area";
    }
    return field + " = $" + parameterIndex++;
  });
  const results = await database.query({
    text: `
      UPDATE real_estate_properties
      SET ${setClauses.join(", ")}, updated_at = timezone('utc', now())
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    ;`,
    values: [id, ...values],
  });
  if (!results.rowCount) {
    throw new NotFoundError({
      message: "O imóvel informado não foi encontrado.",
      action: "Atualize a lista e tente novamente.",
    });
  }
  return results.rows[0];
}

async function deleteProperty(id, client = database) {
  assertRecordId(id, {
    message: "O imóvel informado não foi encontrado.",
    action: "Verifique o ID e tente novamente.",
  });

  const results = await client.query({
    text: `
      UPDATE real_estate_properties
      SET deleted_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    ;`,
    values: [id],
  });
  if (!results.rowCount) {
    throw new NotFoundError({
      message: "O imóvel informado não foi encontrado.",
      action: "Atualize a lista e tente novamente.",
    });
  }
  return results.rows[0];
}

async function deleteMany(ids) {
  return softDeleteMany("real_estate_properties", ids, {
    selectionLabel: "imóveis",
    notFoundMessage:
      "Um ou mais imóveis selecionados não foram encontrados ou já foram excluídos.",
    notFoundAction: "Atualize a listagem e confira os registros selecionados.",
  });
}

function prepareBulkRecords(inputValues) {
  if (
    !Array.isArray(inputValues) ||
    inputValues.length === 0 ||
    inputValues.length > MAX_BULK_RECORDS
  ) {
    throw new ValidationError({
      message: "O cadastro em lote deve conter entre 1 e 100.000 imóveis.",
      action: "Revise os dados enviados e tente novamente.",
    });
  }
  const properties = inputValues.map((input) => {
    const property = applyIdealFractionDefault(
      validateInput(input, {
        requiredFields: [
          "year",
          ...Object.entries(FIELD_RULES)
            .filter(([, rule]) => rule.required)
            .map(([field]) => field),
        ],
      }),
    );
    if (!Object.hasOwn(property, "annual")) property.annual = false;
    return property;
  });
  const annual = properties[0].annual;
  if (properties.some((property) => property.annual !== annual)) {
    throw new ValidationError({
      message:
        "Todos os imóveis da importação devem ter a mesma situação de atualização.",
      action:
        "Confira o campo Atualizado e gere novamente a prévia do arquivo.",
    });
  }
  const identifiers = properties.map((property) =>
    annual
      ? property.year + ":" + property.physical_property_id
      : String(property.physical_property_id),
  );
  if (new Set(identifiers).size !== identifiers.length) {
    throw new ValidationError({
      message: annual
        ? "O arquivo contém códigos de imóvel repetidos para o mesmo ano."
        : "O arquivo contém códigos de imóvel repetidos.",
      action: "Corrija os registros duplicados no arquivo e tente novamente.",
    });
  }
  return properties;
}

async function persistBulkRecords(
  client,
  properties,
  overwriteExisting,
  returnRecords = true,
) {
  const annual = properties[0].annual;
  await client.query(
    "LOCK TABLE real_estate_properties IN SHARE ROW EXCLUSIVE MODE;",
  );
  if (!annual) {
    await client.query(
      "DELETE FROM real_estate_properties WHERE annual = false;",
    );
    return insertManyRecords(client, properties, {
      annual: false,
      returnRecords,
    });
  }
  const existing = await client.query({
    text: "SELECT year, physical_property_id FROM real_estate_properties WHERE annual = true AND deleted_at IS NULL AND (year, physical_property_id) IN (SELECT * FROM unnest($1::integer[], $2::integer[])) ORDER BY year, physical_property_id;",
    values: [
      properties.map((property) => property.year),
      properties.map((property) => property.physical_property_id),
    ],
  });
  if (existing.rowCount && !overwriteExisting) {
    throw new ConflictError({
      message:
        "Foram encontrados " +
        existing.rowCount +
        " imóvel(is) já cadastrado(s) para o mesmo ano e código físico. Se continuar, os registros existentes serão atualizados e os novos serão inseridos.",
      action:
        "Escolha Continuar para atualizar os existentes ou Cancelar para interromper a importação.",
    });
  }
  return insertManyRecords(client, properties, { annual: true, returnRecords });
}

async function createMany(inputValues, { overwriteExisting = false } = {}) {
  const properties = prepareBulkRecords(inputValues);
  return database.transaction((client) =>
    persistBulkRecords(client, properties, overwriteExisting),
  );
}

const MAX_IMPORT_CHUNKS = 1000;
const MAX_IMPORT_CHUNK_BYTES = 1024 * 1024;

async function createImport({ userId, totalRecords, totalChunks }) {
  if (
    typeof userId !== "string" ||
    !Number.isInteger(totalRecords) ||
    totalRecords < 1 ||
    totalRecords > MAX_BULK_RECORDS ||
    !Number.isInteger(totalChunks) ||
    totalChunks < 1 ||
    totalChunks > MAX_IMPORT_CHUNKS ||
    totalChunks > totalRecords
  ) {
    throw new ValidationError({
      message: "Os dados da sessão de importação são inválidos.",
      action: "Reinicie a importação e confira a quantidade de registros.",
    });
  }
  return database.transaction(async (client) => {
    await client.query(
      "DELETE FROM real_estate_property_imports WHERE expires_at <= now();",
    );
    const result = await client.query({
      text: "INSERT INTO real_estate_property_imports (user_id, total_records, total_chunks) VALUES ($1, $2, $3) RETURNING id;",
      values: [userId, totalRecords, totalChunks],
    });
    return { id: result.rows[0].id };
  });
}

async function addImportChunk({ importId, userId, chunkIndex, records }) {
  assertRecordId(importId, {
    message: "A sessão de importação não foi encontrada ou expirou.",
    action: "Inicie uma nova importação do arquivo.",
  });

  if (
    !Array.isArray(records) ||
    records.length === 0 ||
    !Number.isInteger(chunkIndex) ||
    chunkIndex < 0 ||
    Buffer.byteLength(JSON.stringify(records), "utf8") > MAX_IMPORT_CHUNK_BYTES
  ) {
    throw new ValidationError({
      message: "O lote enviado é inválido ou excede o tamanho permitido.",
      action: "Divida os registros em lotes menores e tente novamente.",
    });
  }
  return database.transaction(async (client) => {
    const importResult = await client.query({
      text: "SELECT id, total_chunks, status FROM real_estate_property_imports WHERE id = $1 AND user_id = $2 AND expires_at > now() FOR UPDATE;",
      values: [importId, userId],
    });
    if (!importResult.rowCount)
      throw new NotFoundError({
        message: "A sessão de importação não foi encontrada ou expirou.",
        action: "Inicie uma nova importação do arquivo.",
      });
    const importSession = importResult.rows[0];
    if (importSession.status !== "receiving")
      throw new ConflictError({
        message: "A importação não está mais recebendo lotes.",
        action: "Finalize ou cancele a sessão atual.",
      });
    if (chunkIndex >= importSession.total_chunks)
      throw new ValidationError({
        message: "O número do lote está fora da sequência esperada.",
        action: "Reenvie o lote usando o índice informado pela importação.",
      });
    const existing = await client.query({
      text: "SELECT records = $3::jsonb AS matches FROM real_estate_property_import_chunks WHERE import_id = $1 AND chunk_index = $2;",
      values: [importId, chunkIndex, JSON.stringify(records)],
    });
    if (existing.rowCount) {
      if (!existing.rows[0].matches)
        throw new ConflictError({
          message: "O lote já foi recebido com conteúdo diferente.",
          action: "Não altere os dados de uma importação em andamento.",
        });
      return { received: true, duplicate: true };
    }
    await client.query({
      text: "INSERT INTO real_estate_property_import_chunks (import_id, chunk_index, records, record_count) VALUES ($1, $2, $3::jsonb, $4);",
      values: [importId, chunkIndex, JSON.stringify(records), records.length],
    });
    return { received: true, duplicate: false };
  });
}

async function finalizeImport({ importId, userId, overwriteExisting = false }) {
  assertRecordId(importId, {
    message: "A sessão de importação não foi encontrada ou expirou.",
    action: "Inicie uma nova importação do arquivo.",
  });

  return database.transaction(async (client) => {
    const importResult = await client.query({
      text: "SELECT id, total_records, total_chunks, status FROM real_estate_property_imports WHERE id = $1 AND user_id = $2 AND expires_at > now() FOR UPDATE;",
      values: [importId, userId],
    });
    if (!importResult.rowCount)
      throw new NotFoundError({
        message: "A sessão de importação não foi encontrada ou expirou.",
        action: "Inicie uma nova importação do arquivo.",
      });
    const importSession = importResult.rows[0];
    if (importSession.status !== "receiving")
      throw new ConflictError({
        message: "A importação já está sendo finalizada.",
        action: "Aguarde a conclusão da operação.",
      });
    const chunksResult = await client.query({
      text: "SELECT chunk_index, records, record_count FROM real_estate_property_import_chunks WHERE import_id = $1 ORDER BY chunk_index;",
      values: [importId],
    });
    const chunks = chunksResult.rows;
    const complete =
      chunks.length === importSession.total_chunks &&
      chunks.every((chunk, index) => chunk.chunk_index === index);
    const receivedRecords = chunks.reduce(
      (total, chunk) => total + chunk.record_count,
      0,
    );
    if (!complete || receivedRecords !== importSession.total_records) {
      throw new ValidationError({
        message: "A importação ainda não recebeu todos os lotes esperados.",
        action: "Reenvie os lotes pendentes antes de finalizar.",
      });
    }
    const records = chunks.flatMap((chunk) => chunk.records);
    const properties = prepareBulkRecords(records);
    const importedCount = await persistBulkRecords(
      client,
      properties,
      overwriteExisting,
      false,
    );
    await client.query(
      "DELETE FROM real_estate_property_imports WHERE id = $1;",
      [importId],
    );
    return { importedCount };
  });
}

async function cancelImport({ importId, userId }) {
  assertRecordId(importId, {
    message: "A sessão de importação não foi encontrada ou expirou.",
    action: "Inicie uma nova importação do arquivo.",
  });

  const result = await database.query({
    text: "DELETE FROM real_estate_property_imports WHERE id = $1 AND user_id = $2 RETURNING id;",
    values: [importId, userId],
  });
  if (!result.rowCount)
    throw new NotFoundError({
      message: "A sessão de importação não foi encontrada.",
      action: "Atualize a página e tente novamente.",
    });
  return { cancelled: true };
}

async function findByPhysicalPropertyIdAndYear(
  physicalPropertyId,
  year,
  annual,
) {
  const results = await database.query({
    text: `
      SELECT *
      FROM real_estate_properties
      WHERE physical_property_id = $1
        AND year = $2
        AND annual = $3
        AND deleted_at IS NULL
      LIMIT 1
    ;`,
    values: [physicalPropertyId, year, annual],
  });
  return results.rows[0] || null;
}

async function findByCtmAndYear(ctm, year, annual) {
  const results = await database.query({
    text: `
      SELECT *
      FROM real_estate_properties
      WHERE regexp_replace(ctm, '[^0-9]', '', 'g') =
            regexp_replace($1, '[^0-9]', '', 'g')
        AND year = $2
        AND annual = $3
        AND deleted_at IS NULL
      ORDER BY physical_registration
    ;`,
    values: [ctm, year, annual],
  });
  return results.rows;
}

const realEstateProperty = {
  create,
  findByPhysicalPropertyIdAndYear,
  findByCtmAndYear,
  createMany,
  createImport,
  addImportChunk,
  finalizeImport,
  cancelImport,
  findAll,
  findOneById,
  update,
  delete: deleteProperty,
  deleteMany,
};

export default realEstateProperty;
