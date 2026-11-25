import database from "@/infra/database.js";
import { ConflictError, NotFoundError, ValidationError } from "@/infra/errors.js";

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
  property_neighborhood: { type: "string", maxLength: 50, required: true },
  owner_name: { type: "string", maxLength: 100, required: true },
  promissory_buyer: { type: "string", maxLength: 100, nullable: true },
  land_sector: { type: "integer", min: 0, required: true },
  property_street: { type: "string", maxLength: 100, required: true },
  property_number: { type: "number", min: 0, nullable: true },
  property_complement: { type: "string", maxLength: 100, nullable: true },
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
      property[field] = value.trim();
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


async function insertManyRecords(client, properties, { annual }) {
  const records = new Array(properties.length);
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
        (_, columnIndex) =>
          `${rowIndex * columns.length + columnIndex + 1}`,
      );
      return `(${placeholders.join(", ")})`;
    });
    const updateFields = columns.filter((field) =>
      annual
        ? !["year", "physical_property_id"].includes(field)
        : field !== "physical_property_id",
    );
    const updates = updateFields.map(
      (field) => `${field} = EXCLUDED.${field}`,
    );
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
        RETURNING *
      ;`,
      values,
    });

    result.rows.forEach((record, index) => {
      records[start + index] = record;
    });
    start = end;
  }

  return records;
}

async function create(inputValues) {
  const property = validateInput(inputValues, {
    requiredFields: Object.entries(FIELD_RULES)
      .filter(([, rule]) => rule.required)
      .map(([field]) => field),
  });
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
          WHERE physical_property_id = $1 AND deleted_at IS NULL
          LIMIT 1
        ;`,
        values: [property.physical_property_id],
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
    const updates = updateFields.map(
      (field) => `${field} = EXCLUDED.${field}`,
    );
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
  const property = validateInput(inputValues);
  const columns = getColumns(property);
  if (!columns.length) {
    throw new ValidationError({
      message: "Nenhum dado foi informado para atualização.",
      action: "Informe ao menos um campo que deseja alterar.",
    });
  }
  const values = columns.map((field) => property[field]);
  const setClauses = columns.map((field, index) => `${field} = $${index + 2}`);
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
      action: "Verifique o ID e tente novamente.",
    });
  }
  return results.rows[0];
}

async function deleteProperty(id, client = database) {
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
      action: "Verifique o ID e tente novamente.",
    });
  }
  return results.rows[0];
}

async function deleteMany(ids) {
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > 500 ||
    ids.some((id) => typeof id !== "string" || !id.trim()) ||
    new Set(ids).size !== ids.length
  ) {
    throw new ValidationError({
      message: "A exclusão em lote deve conter entre 1 e 500 IDs únicos.",
      action: "Revise a seleção de imóveis e tente novamente.",
    });
  }

  return database.transaction(async (client) => {
    const results = await client.query({
      text: `
        UPDATE real_estate_properties
        SET deleted_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
        RETURNING *
      ;`,
      values: [ids],
    });
    if (results.rowCount !== ids.length) {
      throw new NotFoundError({
        message:
          "Um ou mais imóveis selecionados não foram encontrados ou já foram excluídos.",
        action: "Atualize a listagem e confira os registros selecionados.",
      });
    }
    return results.rows;
  });
}

async function createMany(inputValues, { overwriteExisting = false } = {}) {
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
    const property = validateInput(input, {
      requiredFields: [
        "year",
        ...Object.entries(FIELD_RULES)
          .filter(([, rule]) => rule.required)
          .map(([field]) => field),
      ],
    });
    if (!Object.hasOwn(property, "annual")) property.annual = false;
    return property;
  });
  const annual = properties[0].annual;
  if (properties.some((property) => property.annual !== annual)) {
    throw new ValidationError({
      message: "Todos os imóveis da importação devem ter a mesma situação de atualização.",
      action: "Confira o campo Atualizado e gere novamente a prévia do arquivo.",
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

  return database.transaction(async (client) => {
    await client.query(
      "LOCK TABLE real_estate_properties IN SHARE ROW EXCLUSIVE MODE;",
    );

    if (!annual) {
      await client.query(
        "DELETE FROM real_estate_properties WHERE annual = false;",
      );
      return insertManyRecords(client, properties, { annual: false });
    }

    const existing = await client.query({
      text: `
        SELECT year, physical_property_id
        FROM real_estate_properties
        WHERE annual = true
          AND deleted_at IS NULL
          AND (year, physical_property_id) IN (
            SELECT * FROM unnest($1::integer[], $2::integer[])
          )
        ORDER BY year, physical_property_id
      ;`,
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
        action: "Escolha Continuar para atualizar os existentes ou Cancelar para interromper a importação.",
      });
    }

    return insertManyRecords(client, properties, { annual: true });
  });
}

const realEstateProperty = {
  create,
  createMany,
  findAll,
  findOneById,
  update,
  delete: deleteProperty,
  deleteMany,
};

export default realEstateProperty;
