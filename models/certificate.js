import database from "@/infra/database.js";
import { NotFoundError, ValidationError } from "@/infra/errors.js";

const FIELD_RULES = {
  protocol_number: { type: "string", required: true, maxLength: 6, pattern: /^[0-9]{1,6}$/ },
  protocol_year: { type: "integer", required: true, min: 1900, max: 9999 },
  applicant_name: { type: "string", required: true, maxLength: 150 },
  year: { type: "integer", min: 1, max: 9999 },
  purpose: { type: "string", required: true, maxLength: 50 },
  real_estate_property_id: { type: "uuid", required: true },
  property_number: { type: "number", required: true, min: 0 },
  applicant_rg: { type: "string", nullable: true, maxLength: 20 },
  observations: { type: "string", nullable: true, maxLength: 150 },
  validity_days: { type: "integer", min: 1, max: 2147483647 },
  is_updated: { type: "boolean" },
};
const WRITABLE_FIELDS = Object.keys(FIELD_RULES);

function validateInput(inputValues, { requiredFields = [] } = {}) {
  if (!inputValues || typeof inputValues !== "object" || Array.isArray(inputValues)) {
    throw new ValidationError({
      message: "Os dados da certidão devem ser enviados em um objeto.",
      action: "Envie um objeto com os campos da certidão.",
    });
  }

  const unknownFields = Object.keys(inputValues).filter((field) => !WRITABLE_FIELDS.includes(field));
  if (unknownFields.length) {
    throw new ValidationError({
      message: `Os campos a seguir não podem ser alterados: ${unknownFields.join(", ")}.`,
      action: `Envie apenas os campos: ${WRITABLE_FIELDS.join(", ")}.`,
    });
  }

  const missingFields = requiredFields.filter((field) => !Object.hasOwn(inputValues, field));
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
      if (typeof value !== "string" || !value.trim() || value.trim().length > rule.maxLength || (rule.pattern && !rule.pattern.test(value.trim()))) {
        throw new ValidationError({
          message: `O campo ${field} contém um texto inválido.`,
          action: rule.pattern ? "Informe o número do protocolo com até seis dígitos." : `Informe um texto de até ${rule.maxLength} caracteres.`,
        });
      }
      certificate[field] = value.trim();
      continue;
    }

    if (rule.type === "uuid") {
      if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new ValidationError({
          message: "O campo real_estate_property_id deve conter um UUID válido.",
          action: "Selecione um imóvel cadastrado.",
        });
      }
      certificate[field] = value;
      continue;
    }

    if (rule.type === "boolean") {
      if (typeof value !== "boolean") {
        throw new ValidationError({
          message: `O campo ${field} deve ser verdadeiro ou falso.`,
          action: "Informe um valor booleano.",
        });
      }
      certificate[field] = value;
      continue;
    }

    if (typeof value !== "number" || !Number.isFinite(value) ||
      (rule.type === "integer" && !Number.isInteger(value)) ||
      (rule.min !== undefined && value < rule.min) ||
      (rule.max !== undefined && value > rule.max) ||
      (rule.type === "number" && Math.round(value * 100) / 100 !== value)) {
      throw new ValidationError({
        message: `O campo ${field} contém um valor numérico inválido.`,
        action: "Revise o número informado e respeite os limites do campo.",
      });
    }
    certificate[field] = value;
  }
  return certificate;
}

async function validatePropertyReference(propertyId) {
  const result = await database.query({
    text: "SELECT id FROM real_estate_properties WHERE id = $1 AND deleted_at IS NULL LIMIT 1;",
    values: [propertyId],
  });
  if (!result.rowCount) {
    throw new NotFoundError({
      message: "O imóvel vinculado à certidão não foi encontrado.",
      action: "Selecione um imóvel cadastrado e ativo.",
    });
  }
}

async function create(inputValues) {
  const certificate = validateInput(inputValues, {
    requiredFields: ["protocol_number", "protocol_year", "applicant_name", "purpose", "real_estate_property_id", "property_number"],
  });
  await validatePropertyReference(certificate.real_estate_property_id);
  const columns = WRITABLE_FIELDS.filter((field) => Object.hasOwn(certificate, field));
  const values = columns.map((field) => certificate[field]);
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
      ORDER BY protocol_year DESC, protocol_number DESC, created_at DESC
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
  const fields = WRITABLE_FIELDS.filter((field) => Object.hasOwn(certificate, field));
  if (!fields.length) {
    throw new ValidationError({
      message: "Nenhum dado foi informado para atualização.",
      action: "Informe ao menos um campo que deseja alterar.",
    });
  }
  if (Object.hasOwn(certificate, "real_estate_property_id")) {
    await validatePropertyReference(certificate.real_estate_property_id);
  }
  const values = fields.map((field) => certificate[field]);
  const setClauses = fields.map((field, index) => `${field} = ${index + 2}`);
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

const certificateModel = { create, findAll, findOneById, update, delete: deleteCertificate };
export default certificateModel;
