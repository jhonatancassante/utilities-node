import database from "@/infra/database.js";
import { NotFoundError, ValidationError } from "@/infra/errors.js";

const UPDATABLE_FIELDS = ["name"];

async function create(inputValues) {
  const position = validateInput(inputValues, {
    requiredFields: ["name"],
  });

  await validateUniqueName(position.name);

  const results = await database.query({
    text: `
      INSERT INTO positions (name)
      VALUES ($1)
      RETURNING *
    ;`,
    values: [position.name],
  });

  return results.rows[0];
}

async function findAll() {
  const results = await database.query({
    text: `
      SELECT *
      FROM positions
      WHERE deleted_at IS NULL
      ORDER BY name, created_at
    ;`,
  });

  return results.rows;
}

async function findOneById(id) {
  const results = await database.query({
    text: `
      SELECT *
      FROM positions
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1
    ;`,
    values: [id],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "O cargo informado não foi encontrado.",
      action: "Verifique o ID e tente novamente.",
    });
  }

  return results.rows[0];
}

async function update(id, inputValues) {
  const position = validateInput(inputValues);

  if (Object.keys(position).length === 0) {
    throw new ValidationError({
      message: "Nenhum dado foi informado para atualização.",
      action: "Informe o nome do cargo que deseja alterar.",
    });
  }

  await findOneById(id);
  await validateUniqueName(position.name, { exceptId: id });

  const results = await database.query({
    text: `
      UPDATE positions
      SET
        name = $2,
        updated_at = timezone('utc', now())
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    ;`,
    values: [id, position.name],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "O cargo informado não foi encontrado.",
      action: "Atualize a lista e tente novamente.",
    });
  }

  return results.rows[0];
}

async function deletePosition(id) {
  const results = await database.query({
    text: `
      UPDATE positions
      SET
        deleted_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    ;`,
    values: [id],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "O cargo informado não foi encontrado.",
      action: "Atualize a lista e tente novamente.",
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
      action: "Revise a seleção de cargos e tente novamente.",
    });
  }

  return database.transaction(async (client) => {
    const results = await client.query({
      text: `
        UPDATE positions
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
          "Um ou mais cargos selecionados não foram encontrados ou já foram excluídos.",
        action: "Atualize a listagem e confira os cargos selecionados.",
      });
    }

    return results.rows;
  });
}

function validateInput(inputValues, { requiredFields = [] } = {}) {
  const isPlainObject =
    inputValues !== null &&
    typeof inputValues === "object" &&
    !Array.isArray(inputValues);

  if (!isPlainObject) {
    throw new ValidationError({
      message: "Os dados do cargo devem ser enviados em um objeto.",
      action: "Envie um objeto com o campo name.",
    });
  }

  const unknownFields = Object.keys(inputValues).filter(
    (field) => !UPDATABLE_FIELDS.includes(field),
  );

  if (unknownFields.length > 0) {
    throw new ValidationError({
      message: `Os campos a seguir não podem ser alterados: ${unknownFields.join(", ")}.`,
      action: "Envie apenas o campo name.",
    });
  }

  const missingFields = requiredFields.filter(
    (field) => !Object.hasOwn(inputValues, field),
  );

  if (missingFields.length > 0) {
    throw new ValidationError({
      message: "O campo obrigatório não foi informado: name.",
      action: "Informe o nome do cargo.",
    });
  }

  const position = {};

  if (Object.hasOwn(inputValues, "name")) {
    const { name } = inputValues;

    if (
      typeof name !== "string" ||
      name.trim().length === 0 ||
      name.trim().length > 60
    ) {
      throw new ValidationError({
        message: "O campo name deve ser um texto entre 1 e 60 caracteres.",
        action: "Informe um nome de cargo válido, com até 60 caracteres.",
      });
    }

    position.name = name.trim();
  }

  return position;
}

async function validateUniqueName(name, { exceptId = null } = {}) {
  const results = await database.query({
    text: `
      SELECT id
      FROM positions
      WHERE LOWER(name) = LOWER($1)
        AND deleted_at IS NULL
        AND ($2::uuid IS NULL OR id <> $2)
      LIMIT 1
    ;`,
    values: [name, exceptId],
  });

  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "Já existe um cargo cadastrado com este nome.",
      action: "Escolha outro nome para o cargo.",
    });
  }
}

const position = {
  create,
  findAll,
  findOneById,
  update,
  delete: deletePosition,
  deleteMany,
};

export default position;
