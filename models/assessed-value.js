import database from "@/infra/database.js";
import { NotFoundError, ValidationError } from "@/infra/errors.js";

const NUMERIC_FIELDS = [
  "sector_1",
  "sector_2",
  "sector_3",
  "sector_4",
  "sector_5",
  "sector_6",
  "sector_7",
  "sector_8",
  "sector_9",
  "sector_9a",
  "sector_10",
  "sector_11",
  "sector_11a",
  "sector_11b",
  "sector_12",
  "sector_13",
  "sector_14",
  "sector_15",
  "sector_16",
  "sector_17",
  "residential_precarious",
  "residential_simple",
  "residential_regular",
  "residential_medium",
  "residential_good",
  "residential_sophisticated",
  "commercial_precarious",
  "commercial_simple",
  "commercial_regular",
  "commercial_medium",
  "commercial_good",
  "commercial_sophisticated",
  "industrial_precarious",
  "industrial_simple",
  "industrial_regular",
  "industrial_medium",
  "industrial_good",
  "industrial_sophisticated",
  "cleaning",
  "garbage",
  "rural",
];
const UPDATABLE_FIELDS = ["year", "decree", ...NUMERIC_FIELDS];

async function create(inputValues) {
  const assessedValue = validateInput(inputValues, {
    requiredFields: ["year"],
  });
  const columns = UPDATABLE_FIELDS;
  const values = columns.map((field) => assessedValue[field] ?? null);
  const placeholders = columns.map((field, index) => `$${index + 1}`);
  const results = await database.query({
    text: `
      INSERT INTO assessed_values (${columns.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *
    ;`,
    values,
  });
  return results.rows[0];
}

async function findAll() {
  const results = await database.query({
    text: `
      SELECT *
      FROM assessed_values
      WHERE deleted_at IS NULL
      ORDER BY year DESC, created_at DESC
    ;`,
  });
  return results.rows;
}

async function findOneById(id) {
  const results = await database.query({
    text: `
      SELECT *
      FROM assessed_values
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1
    ;`,
    values: [id],
  });
  if (results.rowCount === 0)
    throw new NotFoundError({
      message: "O registro de valores venais informado não foi encontrado.",
      action: "Verifique o ID e tente novamente.",
    });
  return results.rows[0];
}

async function update(id, inputValues) {
  const assessedValue = validateInput(inputValues);
  const fields = UPDATABLE_FIELDS.filter((field) =>
    Object.hasOwn(assessedValue, field),
  );
  if (fields.length === 0)
    throw new ValidationError({
      message: "Nenhum dado foi informado para atualização.",
      action: "Informe ao menos um campo que deseja alterar.",
    });
  const values = fields.map((field) => assessedValue[field]);
  const setClauses = fields.map((field, index) => `${field} = $${index + 2}`);
  const results = await database.query({
    text: `
      UPDATE assessed_values
      SET ${setClauses.join(", ")}, updated_at = timezone('utc', now())
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    ;`,
    values: [id, ...values],
  });
  if (results.rowCount === 0)
    throw new NotFoundError({
      message: "O registro de valores venais informado não foi encontrado.",
      action: "Verifique o ID e tente novamente.",
    });
  return results.rows[0];
}

async function deleteAssessedValue(id) {
  const results = await database.query({
    text: `
      UPDATE assessed_values
      SET deleted_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    ;`,
    values: [id],
  });
  if (results.rowCount === 0)
    throw new NotFoundError({
      message: "O registro de valores venais informado não foi encontrado.",
      action: "Verifique o ID e tente novamente.",
    });
  return results.rows[0];
}

function validateInput(inputValues, { requiredFields = [] } = {}) {
  const isPlainObject =
    inputValues !== null &&
    typeof inputValues === "object" &&
    !Array.isArray(inputValues);
  if (!isPlainObject)
    throw new ValidationError({
      message: "Os dados dos valores venais devem ser enviados em um objeto.",
      action: "Envie um objeto com os campos do registro.",
    });
  const unknownFields = Object.keys(inputValues).filter(
    (field) => !UPDATABLE_FIELDS.includes(field),
  );
  if (unknownFields.length > 0)
    throw new ValidationError({
      message: `Os campos a seguir não podem ser alterados: ${unknownFields.join(", ")}.`,
      action: `Envie apenas os campos: ${UPDATABLE_FIELDS.join(", ")}.`,
    });
  const missingFields = requiredFields.filter(
    (field) => !Object.hasOwn(inputValues, field),
  );
  if (missingFields.length > 0)
    throw new ValidationError({
      message: `Os campos obrigatórios não foram informados: ${missingFields.join(", ")}.`,
      action: "Informe o ano de referência dos valores venais.",
    });
  const assessedValue = {};
  if (Object.hasOwn(inputValues, "year")) {
    const { year } = inputValues;
    if (!Number.isInteger(year) || year < 1 || year > 9999)
      throw new ValidationError({
        message: "O campo year deve ser um número inteiro entre 1 e 9999.",
        action: "Informe um ano válido.",
      });
    assessedValue.year = year;
  }
  if (Object.hasOwn(inputValues, "decree")) {
    const { decree } = inputValues;
    if (
      decree !== null &&
      (typeof decree !== "string" || decree.trim().length > 12)
    )
      throw new ValidationError({
        message:
          "O campo decree deve ser um texto de até 12 caracteres ou nulo.",
        action: "Revise o número do decreto informado.",
      });
    assessedValue.decree =
      typeof decree === "string" ? decree.trim() || null : decree;
  }
  for (const field of NUMERIC_FIELDS) {
    if (!Object.hasOwn(inputValues, field)) continue;
    const value = inputValues[field];
    if (
      value !== null &&
      (typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 9999999999.99 ||
        Math.round(value * 100) / 100 !== value)
    ) {
      throw new ValidationError({
        message: `O campo ${field} deve ser um número não negativo com até duas casas decimais ou nulo.`,
        action: "Revise os valores numéricos informados.",
      });
    }
    assessedValue[field] = value;
  }
  return assessedValue;
}

async function createMany(inputValues) {
  if (
    !Array.isArray(inputValues) ||
    inputValues.length === 0 ||
    inputValues.length > 500
  ) {
    throw new ValidationError({
      message: "A importação deve conter entre 1 e 500 registros.",
      action: "Revise o arquivo CSV e tente importar novamente.",
    });
  }

  const assessedValues = inputValues.map((input) =>
    validateInput(input, { requiredFields: ["year"] }),
  );
  const columns = UPDATABLE_FIELDS;
  const placeholders = columns.map((field, index) => "$" + (index + 1));
  const queryText = `
    INSERT INTO assessed_values (${columns.join(", ")})
    VALUES (${placeholders.join(", ")})
    RETURNING *
  `;

  return database.transaction(async (client) => {
    const records = [];
    for (const assessedValue of assessedValues) {
      const values = columns.map((field) => assessedValue[field] ?? null);
      const result = await client.query({ text: queryText, values });
      records.push(result.rows[0]);
    }
    return records;
  });
}

async function findOneByYear(year) {
  const results = await database.query({
    text: `
      SELECT *
      FROM assessed_values
      WHERE year = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    ;`,
    values: [year],
  });
  if (!results.rowCount) {
    throw new NotFoundError({
      message: `Não foram encontrados valores venais cadastrados para o exercício ${year}.`,
      action:
        "Cadastre os valores venais do exercício solicitado e tente novamente.",
    });
  }
  return results.rows[0];
}

const assessedValueModel = {
  create,
  findOneByYear,
  findAll,
  findOneById,
  update,
  delete: deleteAssessedValue,
  createMany,
};

export default assessedValueModel;
