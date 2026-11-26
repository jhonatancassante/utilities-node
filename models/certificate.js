import database from "@/infra/database.js";
import { NotFoundError, ValidationError } from "@/infra/errors.js";

const FIELD_RULES = {
  protocol_number: { type: "integer", nullable: true },
  protocol_year: {
    type: "integer",
    nullable: true,
    min: 1900,
    max: 9999,
  },
  applicant_name: { type: "string", required: true, maxLength: 150 },
  year: { type: "integer", min: 1, max: 9999 },
  purpose: { type: "string", required: true, maxLength: 50 },
  physical_property_id: { type: "integer", required: true, min: 1 },
  physical_registration: { type: "string", required: true },
  owner_name: { type: "string", required: true, maxLength: 150 },
  promissory_buyer: { type: "string", required: true, maxLength: 150 },
  property_street: { type: "string", required: true, maxLength: 150 },
  property_number: { type: "number", nullable: true },
  property_neighborhood: {
    type: "string",
    required: true,
    maxLength: 70,
  },
  property_block: { type: "string", nullable: true, maxLength: 20 },
  property_lots: { type: "string", nullable: true, maxLength: 20 },
  property_complement: { type: "string", nullable: true, maxLength: 150 },
  owner_rg: { type: "string", nullable: true, maxLength: 20 },
  land_area: { type: "number", required: true, scale: 2 },
  built_area: { type: "number", required: true, scale: 2 },
  land_value: { type: "number", required: true, scale: 2 },
  building_value: { type: "number", required: true, scale: 2 },
  total_value: { type: "number", required: true, scale: 2 },
  observations: { type: "string", required: true, maxLength: 150 },
  validity_days: { type: "integer", min: 1, max: 2147483647 },
};
const WRITABLE_FIELDS = Object.keys(FIELD_RULES);

function validateInput(inputValues, { requiredFields = [] } = {}) {
  if (
    !inputValues ||
    typeof inputValues !== "object" ||
    Array.isArray(inputValues)
  ) {
    throw new ValidationError({
      message: "Os dados da certidão devem ser enviados em um objeto.",
      action: "Envie um objeto com os campos da certidão.",
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
      action: "Preencha os dados obrigatórios da certidão.",
    });
  }

  const certificate = {};
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
      certificate[field] = null;
      continue;
    }

    if (rule.type === "string") {
      if (
        typeof value !== "string" ||
        !value.trim() ||
        (rule.maxLength !== undefined &&
          value.trim().length > rule.maxLength)
      ) {
        throw new ValidationError({
          message: `O campo ${field} contém um texto inválido.`,
          action: rule.maxLength
            ? `Informe um texto de até ${rule.maxLength} caracteres.`
            : "Informe um texto válido.",
        });
      }
      certificate[field] = value.trim();
      continue;
    }

    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (rule.type === "integer" && !Number.isInteger(value)) ||
      (rule.min !== undefined && value < rule.min) ||
      (rule.max !== undefined && value > rule.max) ||
      (rule.scale !== undefined &&
        Math.round(value * 100) / 100 !== value)
    ) {
      throw new ValidationError({
        message: `O campo ${field} contém um valor numérico inválido.`,
        action: "Revise o número informado e respeite os limites do campo.",
      });
    }
    certificate[field] = value;
  }
  return certificate;
}

async function validatePhysicalPropertyReference(physicalPropertyId) {
  const result = await database.query({
    text: "SELECT physical_property_id FROM real_estate_properties WHERE physical_property_id = $1 AND deleted_at IS NULL LIMIT 1;",
    values: [physicalPropertyId],
  });
  if (!result.rowCount) {
    throw new NotFoundError({
      message: "O código físico do imóvel vinculado à certidão não foi encontrado.",
      action: "Informe um código físico de imóvel cadastrado e ativo.",
    });
  }
}

async function create(inputValues, userId) {
  const certificate = validateInput(inputValues, {
    requiredFields: [
      "applicant_name",
      "purpose",
      "physical_property_id",
      "physical_registration",
      "owner_name",
      "promissory_buyer",
      "property_street",
      "property_neighborhood",
      "land_area",
      "built_area",
      "land_value",
      "building_value",
      "total_value",
      "observations",
    ],
  });
  await validatePhysicalPropertyReference(certificate.physical_property_id);
  const columns = [
    "user_id",
    ...WRITABLE_FIELDS.filter((field) => Object.hasOwn(certificate, field)),
  ];
  const values = [
    userId,
    ...columns.slice(1).map((field) => certificate[field]),
  ];
  const placeholders = columns.map((field, index) => `$${index + 1}`);
  const results = await database.query({
    text: `INSERT INTO certificates (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *;`,
    values,
  });
  return results.rows[0];
}

async function findAll() {
  const results = await database.query({
    text: `
      SELECT *
      FROM certificates
      WHERE deleted_at IS NULL
      ORDER BY year DESC, protocol_year DESC NULLS LAST, protocol_number DESC NULLS LAST, created_at DESC
    ;`,
  });
  return results.rows;
}

async function findOneById(id) {
  const results = await database.query({
    text: "SELECT * FROM certificates WHERE id = $1 AND deleted_at IS NULL LIMIT 1;",
    values: [id],
  });
  if (!results.rowCount) {
    throw new NotFoundError({
      message: "A certidão informada não foi encontrada.",
      action: "Verifique o ID e tente novamente.",
    });
  }
  return results.rows[0];
}

async function update(id, inputValues) {
  const certificate = validateInput(inputValues);
  const fields = WRITABLE_FIELDS.filter((field) =>
    Object.hasOwn(certificate, field),
  );
  if (!fields.length) {
    throw new ValidationError({
      message: "Nenhum dado foi informado para atualização.",
      action: "Informe ao menos um campo que deseja alterar.",
    });
  }
  if (Object.hasOwn(certificate, "physical_property_id")) {
    await validatePhysicalPropertyReference(certificate.physical_property_id);
  }
  const values = fields.map((field) => certificate[field]);
  const setClauses = fields.map((field, index) => `${field} = $${index + 2}`);
  const results = await database.query({
    text: `
      UPDATE certificates
      SET ${setClauses.join(", ")}, updated_at = timezone('utc', now())
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    ;`,
    values: [id, ...values],
  });
  if (!results.rowCount) {
    throw new NotFoundError({
      message: "A certidão informada não foi encontrada.",
      action: "Verifique o ID e tente novamente.",
    });
  }
  return results.rows[0];
}

async function deleteCertificate(id) {
  const results = await database.query({
    text: `
      UPDATE certificates
      SET deleted_at = timezone('utc', now()), updated_at = timezone('utc', now())
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    ;`,
    values: [id],
  });
  if (!results.rowCount) {
    throw new NotFoundError({
      message: "A certidão informada não foi encontrada.",
      action: "Verifique o ID e tente novamente.",
    });
  }
  return results.rows[0];
}

const certificateModel = {
  create,
  findAll,
  findOneById,
  update,
  delete: deleteCertificate,
};
export default certificateModel;
