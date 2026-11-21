import database from "@/infra/database.js";
import { NotFoundError, ValidationError } from "@/infra/errors.js";

const UPDATABLE_FIELDS = [
  "name",
  "label",
  "group_name",
  "description",
  "is_self_removable",
  "is_privileged",
  "is_protected",
];

async function create(featureInputValues) {
  const feature = validateFeatureInput(featureInputValues, {
    requiredFields: ["name", "label", "group_name", "description"],
  });

  await validateUniqueName(feature.name);

  const results = await database.query({
    text: `
      INSERT INTO
        features (
          name,
          label,
          group_name,
          description,
          is_self_removable,
          is_privileged,
          is_protected
        )
      VALUES
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        *
    ;`,
    values: [
      feature.name,
      feature.label,
      feature.group_name,
      feature.description,
      feature.is_self_removable ?? true,
      feature.is_privileged ?? false,
      feature.is_protected ?? false,
    ],
  });

  return results.rows[0];
}

async function findOneById(id) {
  const results = await database.query({
    text: `
      SELECT
        *
      FROM
        features
      WHERE
        id = $1
        AND deleted_at IS NULL
      LIMIT 1
    ;`,
    values: [id],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "A feature com o ID informado não foi encontrada.",
      action: "Verifique o ID e tente novamente.",
    });
  }

  return results.rows[0];
}

async function findOneByName(name) {
  const results = await database.query({
    text: `
      SELECT
        *
      FROM
        features
      WHERE
        name = $1
        AND deleted_at IS NULL
      LIMIT 1
    ;`,
    values: [name],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "A feature com o nome informado não foi encontrada.",
      action: "Verifique o nome e tente novamente.",
    });
  }

  return results.rows[0];
}

async function findAll() {
  const results = await database.query({
    text: `
      SELECT
        *
      FROM
        features
      WHERE
        deleted_at IS NULL
      ORDER BY
        group_name,
        label,
        name
    ;`,
  });

  return results.rows;
}

async function update(id, featureInputValues) {
  const feature = validateFeatureInput(featureInputValues, {
    requiredFields: [],
  });

  if (Object.keys(feature).length === 0) {
    throw new ValidationError({
      message: "Nenhum dado foi informado para atualização.",
      action: "Informe ao menos um campo que deseja alterar.",
    });
  }

  return await database.transaction(async (client) => {
    const currentResults = await client.query({
      text: `
        SELECT
          *
        FROM
          features
        WHERE
          id = $1
          AND deleted_at IS NULL
        FOR UPDATE
      ;`,
      values: [id],
    });

    if (currentResults.rowCount === 0) {
      throw new NotFoundError({
        message: "A feature com o ID informado não foi encontrada.",
        action: "Verifique o ID e tente novamente.",
      });
    }

    const currentFeature = currentResults.rows[0];

    if (currentFeature.is_protected) {
      throw new ValidationError({
        message: "Esta feature está protegida e não pode ser alterada.",
        action:
          "As informações de features protegidas não podem ser modificadas.",
      });
    }

    if (feature.name && feature.name !== currentFeature.name) {
      await validateUniqueName(feature.name, { client });
    }

    const updatedFeature = { ...currentFeature, ...feature };
    const fieldsToUpdate = UPDATABLE_FIELDS.filter((field) =>
      Object.hasOwn(feature, field),
    );
    const values = fieldsToUpdate.map((field) => updatedFeature[field]);
    const setClauses = fieldsToUpdate.map(
      (field, index) => `${field} = $${index + 2}`,
    );

    const updateResults = await client.query({
      text: `
        UPDATE
          features
        SET
          ${setClauses.join(", ")},
          updated_at = timezone('utc', now())
        WHERE
          id = $1
        RETURNING
          *
      ;`,
      values: [id, ...values],
    });

    if (feature.name && feature.name !== currentFeature.name) {
      await client.query({
        text: `
          UPDATE
            users
          SET
            features = array_replace(features, $1, $2),
            updated_at = timezone('utc', now())
          WHERE
            $1 = ANY(features)
        ;`,
        values: [currentFeature.name, feature.name],
      });
    }

    return updateResults.rows[0];
  });
}

async function deleteFeature(id) {
  return await database.transaction(async (client) => {
    const currentResults = await client.query({
      text: `
        SELECT
          *
        FROM
          features
        WHERE
          id = $1
          AND deleted_at IS NULL
        FOR UPDATE
      ;`,
      values: [id],
    });

    if (currentResults.rowCount === 0) {
      throw new NotFoundError({
        message: "A feature com o ID informado não foi encontrada.",
        action: "Verifique o ID e tente novamente.",
      });
    }

    const currentFeature = currentResults.rows[0];

    if (currentFeature.is_protected) {
      throw new ValidationError({
        message: "Esta feature está protegida e não pode ser excluída.",
        action: "As features protegidas não podem ser removidas do sistema.",
      });
    }

    await client.query({
      text: `
        UPDATE
          users
        SET
          features = array_remove(features, $1),
          updated_at = timezone('utc', now())
        WHERE
          $1 = ANY(features)
      ;`,
      values: [currentFeature.name],
    });

    const results = await client.query({
      text: `
        UPDATE
          features
        SET
          deleted_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        WHERE
          id = $1
        RETURNING
          *
      ;`,
      values: [id],
    });

    return results.rows[0];
  });
}

function validateFeatureInput(
  featureInputValues,
  { requiredFields = [] } = {},
) {
  const isPlainObject =
    featureInputValues !== null &&
    typeof featureInputValues === "object" &&
    !Array.isArray(featureInputValues);

  if (!isPlainObject) {
    throw new ValidationError({
      message: "Os dados da feature devem ser enviados em um objeto.",
      action: "Envie um objeto com os campos da feature.",
    });
  }

  const unknownFields = Object.keys(featureInputValues).filter(
    (field) => !UPDATABLE_FIELDS.includes(field),
  );

  if (unknownFields.length > 0) {
    throw new ValidationError({
      message: `Os campos a seguir não podem ser alterados: ${unknownFields.join(", ")}.`,
      action: `Envie apenas os campos: ${UPDATABLE_FIELDS.join(", ")}.`,
    });
  }

  const missingFields = requiredFields.filter(
    (field) => !Object.hasOwn(featureInputValues, field),
  );

  if (missingFields.length > 0) {
    throw new ValidationError({
      message: `Os campos obrigatórios não foram informados: ${missingFields.join(", ")}.`,
      action: "Informe nome, título, grupo e descrição da feature.",
    });
  }

  const feature = {};

  for (const field of ["name", "label", "group_name", "description"]) {
    if (!Object.hasOwn(featureInputValues, field)) continue;

    const value = featureInputValues[field];
    const maxLength = field === "description" ? null : 50;

    if (
      typeof value !== "string" ||
      value.trim().length === 0 ||
      (maxLength && value.trim().length > maxLength)
    ) {
      const fieldLabels = {
        name: "nome",
        label: "rótulo",
        group_name: "grupo",
        description: "descrição",
      };

      throw new ValidationError({
        message: maxLength
          ? `O campo ${fieldLabels[field]} deve ser um texto entre 1 e ${maxLength} caracteres.`
          : `O campo ${fieldLabels[field]} deve ser um texto.`,
        action: "Revise os dados informados e tente novamente.",
      });
    }

    feature[field] = value.trim();
  }

  if (Object.hasOwn(feature, "name")) {
    if (!/^[a-z][a-z0-9]*(?::[a-z][a-z0-9]*)*$/.test(feature.name)) {
      throw new ValidationError({
        message: "O nome da feature possui um formato inválido.",
        action:
          "Utilize letras minúsculas, números e dois-pontos para separar os níveis (ex.: read:user).",
      });
    }
  }

  for (const field of ["is_self_removable", "is_privileged", "is_protected"]) {
    if (!Object.hasOwn(featureInputValues, field)) continue;

    if (typeof featureInputValues[field] !== "boolean") {
      throw new ValidationError({
        message: `O campo ${field} deve ser verdadeiro ou falso.`,
        action: "Informe um valor booleano para este campo.",
      });
    }

    feature[field] = featureInputValues[field];
  }

  return feature;
}

async function validateUniqueName(name, { client = database } = {}) {
  const results = await client.query({
    text: `
      SELECT
        id
      FROM
        features
      WHERE
        name = $1
      LIMIT 1
    ;`,
    values: [name],
  });

  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "Já existe uma feature cadastrada com este nome.",
      action: "Escolha outro nome para a feature.",
    });
  }
}

const feature = {
  create,
  update,
  findOneById,
  findOneByName,
  findAll,
  delete: deleteFeature,
};

export default feature;
