import database from "@/infra/database.js";
import password from "@/models/password.js";
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
} from "@/infra/errors.js";
import {
  validateUsername,
  validateEmail,
  validatePassword,
} from "@/lib/shared/user-validation.js";

async function create(userInputValues) {
  validateUsernameFormat(userInputValues.username);
  validateEmailFormat(userInputValues.email);
  validatePasswordFormat(userInputValues.password);
  userInputValues.username = userInputValues.username.trim();
  userInputValues.email = userInputValues.email.trim();
  await validateUniqueUsername(userInputValues.username);
  await validateUniqueEmail(userInputValues.email);
  await hashPasswordInObject(userInputValues);

  injectDefaultFeaturesInObject(userInputValues);

  const newUser = await runInsertQuery(userInputValues);
  return newUser;

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
        INSERT INTO
          users (username, email, password, features)
        VALUES
          ($1, $2, $3, $4)
        RETURNING
          *
        ;`,
      values: [
        userInputValues.username,
        userInputValues.email,
        userInputValues.password,
        userInputValues.features,
      ],
    });

    return results.rows[0];
  }

  function injectDefaultFeaturesInObject(userInputValues) {
    userInputValues.features = ["read:activation_token"];
  }
}

async function findOneById(id) {
  const userFound = await runSelectQuery(id);

  return userFound;

  async function runSelectQuery(id) {
    const results = await database.query({
      text: `
        SELECT
          users.*,
          COALESCE(
            (
              SELECT array_agg(features.name)
              FROM features
              WHERE features.is_privileged = true
                AND features.deleted_at IS NULL
                AND features.name = ANY(users.features)
            ),
            ARRAY[]::varchar[]
          ) AS privileged_features
        FROM
          users
        WHERE
          users.id = $1
        LIMIT 1
        ;`,
      values: [id],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O id de usuário informado não foi encontrado no sistema.",
        action:
          "Verifique se digitou o id de usuário corretamente e tente novamente.",
      });
    }

    return results.rows[0];
  }
}

async function findOneByUsername(username) {
  const userFound = await runSelectQuery(username);

  return userFound;

  async function runSelectQuery(username) {
    const results = await database.query({
      text: `
        SELECT
          users.*,
          COALESCE(
            (
              SELECT array_agg(features.name)
              FROM features
              WHERE features.is_privileged = true
                AND features.deleted_at IS NULL
                AND features.name = ANY(users.features)
            ),
            ARRAY[]::varchar[]
          ) AS privileged_features
        FROM
          users
        WHERE
          LOWER(users.username) = LOWER($1)
        LIMIT 1
        ;`,
      values: [username],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O nome de usuário informado não foi encontrado no sistema.",
        action:
          "Verifique se digitou o nome de usuário corretamente e tente novamente.",
      });
    }

    return results.rows[0];
  }
}

async function findOneByEmail(email) {
  const userFound = await runSelectQuery(email);

  return userFound;

  async function runSelectQuery(email) {
    const results = await database.query({
      text: `
        SELECT
          *
        FROM
          users
        WHERE
          LOWER(email) = LOWER($1)
        LIMIT 1
        ;`,
      values: [email],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O email informado não foi encontrado no sistema.",
        action: "Verifique se digitou o email corretamente e tente novamente.",
      });
    }

    return results.rows[0];
  }
}

const UPDATABLE_FIELDS = ["username", "email", "password"];

async function search(searchTerm) {
  if (typeof searchTerm !== "string" || searchTerm.trim().length < 2) {
    throw new ValidationError({
      message: "Informe ao menos dois caracteres para pesquisar um usuário.",
      action: "Pesquise pelo nome de usuário ou pelo e-mail.",
    });
  }

  const normalizedSearch = `%${searchTerm.trim()}%`;
  const results = await database.query({
    text: `
      SELECT
        id,
        username,
        email,
        features,
        banned_at,
        created_at,
        updated_at
      FROM
        users
      WHERE
        username ILIKE $1
        OR email ILIKE $1
      ORDER BY
        username
      LIMIT 10
      ;
    `,
    values: [normalizedSearch],
  });

  return results.rows;
}

async function update(
  username,
  userInputValues,
  { allowFeatures = false, actorUserId } = {},
) {
  const currentUser = await findOneByUsername(username);
  const allowedInputValues = pickUpdatableFields(userInputValues, {
    allowFeatures,
  });

  if ("username" in allowedInputValues) {
    validateUsernameFormat(allowedInputValues.username);
    allowedInputValues.username = allowedInputValues.username.trim();
    if (
      currentUser.username.toLowerCase() !==
      allowedInputValues.username.toLowerCase()
    ) {
      await validateUniqueUsername(allowedInputValues.username);
    }
  }

  if ("email" in allowedInputValues) {
    validateEmailFormat(allowedInputValues.email);
    allowedInputValues.email = allowedInputValues.email.trim();
    if (
      currentUser.email.toLowerCase() !== allowedInputValues.email.toLowerCase()
    ) {
      await validateUniqueEmail(allowedInputValues.email);
    }
  }

  if ("password" in allowedInputValues) {
    validatePasswordFormat(allowedInputValues.password);
    await hashPasswordInObject(allowedInputValues);
  }

  if ("features" in allowedInputValues) {
    if (!Array.isArray(allowedInputValues.features)) {
      throw new ValidationError({
        message: "O campo features deve ser uma lista de permissões.",
        action: "Envie uma lista de features válidas.",
      });
    }

    allowedInputValues.features = [...new Set(allowedInputValues.features)];

    const featureResults = await database.query({
      text: `
        SELECT
          name,
          is_self_removable,
          deleted_at
        FROM
          features
        WHERE
          name = ANY($1)
      ;`,
      values: [
        [...new Set([...currentUser.features, ...allowedInputValues.features])],
      ],
    });
    const featureMetadata = new Map(
      featureResults.rows.map((feature) => [feature.name, feature]),
    );
    const unknownFeatures = allowedInputValues.features.filter(
      (featureName) => {
        const feature = featureMetadata.get(featureName);
        return !feature || feature.deleted_at !== null;
      },
    );

    if (unknownFeatures.length > 0) {
      const message = [
        "As features a seguir não são reconhecidas ou estão excluídas:",
        unknownFeatures.join(", "),
      ].join(" ");

      throw new ValidationError({
        message: `${message}.`,
        action: "Selecione apenas features ativas no sistema.",
      });
    }
  }

  const userWithNewValues = { ...currentUser, ...allowedInputValues };

  const updatedUser = await runUpdateQuery(
    currentUser.id,
    userWithNewValues,
    allowFeatures,
  );
  return updatedUser;

  async function runUpdateQuery(userId, userWithNewValues, allowFeatures) {
    const updateUser = async (client) => {
      if (allowFeatures && Object.hasOwn(allowedInputValues, "features")) {
        await client.query({
          text: "SELECT pg_advisory_xact_lock(hashtext($1));",
          values: ["protected-features-coverage"],
        });
        const currentResults = await client.query({
          text: "SELECT id, features FROM users WHERE id = $1 FOR UPDATE;",
          values: [userId],
        });
        if (currentResults.rowCount === 0)
          throw new NotFoundError({
            message: "O usuário não foi encontrado.",
            action: "Atualize a lista e tente novamente.",
          });
        const currentFeatures = currentResults.rows[0].features;
        if (
          JSON.stringify([...currentFeatures].sort()) !==
          JSON.stringify([...currentUser.features].sort())
        ) {
          throw new ValidationError({
            message:
              "As permissões deste usuário foram alteradas por outra operação.",
            action: "Atualize os dados do usuário antes de tentar novamente.",
          });
        }
        const removedFeatures = currentFeatures.filter(
          (name) => !userWithNewValues.features.includes(name),
        );
        const isSelfUpdate = !actorUserId || actorUserId === userId;
        if (removedFeatures.length && isSelfUpdate) {
          const metadata = await client.query({
            text: "SELECT name, is_self_removable FROM features WHERE name = ANY($1);",
            values: [removedFeatures],
          });
          const locked = metadata.rows
            .filter((item) => !item.is_self_removable)
            .map((item) => item.name);
          if (locked.length)
            throw new ValidationError({
              message: `As seguintes features não podem ser removidas deste usuário: ${locked.join(", ")}.`,
              action:
                "Uma feature não removível pode ser atribuída, mas não pode ser retirada pelo próprio usuário.",
            });
        }
        const protectedFeatureResults = await client.query({
          text: `
            SELECT name
            FROM features
            WHERE is_protected = true
              AND deleted_at IS NULL
            ORDER BY name
          ;`,
        });
        const protectedFeatures = protectedFeatureResults.rows.map(
          (item) => item.name,
        );

        if (protectedFeatures.length) {
          const coverage = await client.query({
            text: `
              SELECT id FROM users
              WHERE (id = $1 AND $2::varchar[] @> $3::varchar[])
                 OR (id <> $1 AND features @> $3::varchar[])
              LIMIT 1
            ;`,
            values: [userId, userWithNewValues.features, protectedFeatures],
          });
          if (!coverage.rowCount)
            throw new ConflictError({
              message:
                "Esta alteração não pode ser realizada porque deixaria o sistema sem um administrador com todas as permissões protegidas.",
              action:
                "Atribua todas as permissões protegidas a outro usuário antes de tentar novamente.",
            });
        }
      }
      const featuresUpdate = allowFeatures ? "features = $5," : "";
      const values = [
        userId,
        userWithNewValues.username,
        userWithNewValues.email,
        userWithNewValues.password,
      ];
      if (allowFeatures) values.push(userWithNewValues.features);
      const result = await client.query({
        text: `UPDATE users SET username = $2, email = $3, password = $4, ${featuresUpdate} updated_at = timezone('utc', now()) WHERE id = $1 RETURNING *;`,
        values,
      });
      return result.rows[0];
    };
    if (allowFeatures && Object.hasOwn(allowedInputValues, "features"))
      return database.transaction(updateUser);
    const result = await database.query({
      text: "UPDATE users SET username = $2, email = $3, password = $4, updated_at = timezone('utc', now()) WHERE id = $1 RETURNING *;",
      values: [
        userId,
        userWithNewValues.username,
        userWithNewValues.email,
        userWithNewValues.password,
      ],
    });
    return result.rows[0];
  }
}

function pickUpdatableFields(userInputValues, { allowFeatures = false } = {}) {
  const isPlainObject =
    userInputValues !== null &&
    typeof userInputValues === "object" &&
    !Array.isArray(userInputValues);

  if (!isPlainObject) {
    throw new ValidationError({
      message: "O corpo da requisição deve ser um objeto JSON.",
      action: "Envie um objeto com os campos a serem alterados.",
    });
  }

  const updatableFields = allowFeatures
    ? [...UPDATABLE_FIELDS, "features"]
    : UPDATABLE_FIELDS;
  const unknownFields = Object.keys(userInputValues).filter(
    (field) => !updatableFields.includes(field),
  );

  if (unknownFields.length > 0) {
    const message = [
      "Os campos a seguir não podem ser alterados:",
      unknownFields.join(", "),
    ].join(" ");

    throw new ValidationError({
      message: `${message}.`,
      action: allowFeatures
        ? "Envie apenas username, email, password e features."
        : "Envie apenas username, email e password.",
    });
  }

  const picked = {};
  for (const field of updatableFields) {
    if (Object.hasOwn(userInputValues, field)) {
      picked[field] = userInputValues[field];
    }
  }
  return picked;
}

async function setBanStatus(username, isBanned, actorUserId) {
  if (typeof isBanned !== "boolean") {
    throw new ValidationError({
      message: "O status de banimento deve ser verdadeiro ou falso.",
      action: "Informe se o usuário deve ser banido ou desbanido.",
    });
  }

  const currentUser = await findOneByUsername(username);

  if (currentUser.id === actorUserId) {
    throw new ForbiddenError({
      message: "Não é permitido banir a própria conta administrativa.",
      action: "Selecione outro usuário para realizar esta operação.",
    });
  }

  return database.transaction(async (client) => {
    const lockedUser = await client.query({
      text: "SELECT id FROM users WHERE id = $1 FOR UPDATE;",
      values: [currentUser.id],
    });

    if (lockedUser.rowCount === 0) {
      throw new NotFoundError({
        message: "O usuário não foi encontrado.",
        action: "Atualize a lista e tente novamente.",
      });
    }

    const results = await client.query({
      text: `
        UPDATE
          users
        SET
          banned_at = CASE WHEN $2 THEN now() ELSE NULL END,
          updated_at = timezone('utc', now())
        WHERE
          id = $1
        RETURNING
          *
      ;`,
      values: [currentUser.id, isBanned],
    });

    if (isBanned) {
      await client.query({
        text: `
          UPDATE
            sessions
          SET
            expires_at = NOW() - interval '1 second',
            updated_at = timezone('utc', now())
          WHERE
            user_id = $1
            AND expires_at > NOW()
        ;`,
        values: [currentUser.id],
      });
    }

    return results.rows[0];
  });
}

async function setFeatures(userId, userFeatures) {
  const updatedUser = await runUpdateQuery(userId, userFeatures);
  return updatedUser;

  async function runUpdateQuery(userId, userFeatures) {
    const results = await database.query({
      text: `
        UPDATE
          users
        SET
          features = $2,
          updated_at = timezone('utc', now())
        WHERE
          id = $1
        RETURNING
          *
      ;`,
      values: [userId, userFeatures],
    });

    return results.rows[0];
  }
}

async function addFeatures(userId, userFeatures) {
  const updatedUser = await runUpdateQuery(userId, userFeatures);
  return updatedUser;

  async function runUpdateQuery(userId, userFeatures) {
    const results = await database.query({
      text: `
        UPDATE
          users
        SET
          features = array_cat(features, $2),
          updated_at = timezone('utc', now())
        WHERE
          id = $1
        RETURNING
          *
      ;`,
      values: [userId, userFeatures],
    });

    return results.rows[0];
  }
}

async function validateUniqueUsername(username) {
  const results = await database.query({
    text: `
        SELECT
          username
        FROM
          users
        WHERE
          LOWER(username) = LOWER($1)
        LIMIT 1
        ;`,
    values: [username],
  });

  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "O nome de usuário informado já está sendo utilizado.",
      action: "Utilize outro nome de usuário para realizar esta operação.",
    });
  }
}

function validateUsernameFormat(username) {
  const error = validateUsername(username);
  if (error) throw new ValidationError(error);
}

function validateEmailFormat(email) {
  const error = validateEmail(email);
  if (error) throw new ValidationError(error);
}

function validatePasswordFormat(password) {
  const error = validatePassword(password);
  if (error) throw new ValidationError(error);
}

async function validateUniqueEmail(email) {
  const results = await database.query({
    text: `
        SELECT
          email
        FROM
          users
        WHERE
          LOWER(email) = LOWER($1)
        LIMIT 1
        ;`,
    values: [email],
  });

  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "O email informado já está sendo utilizado.",
      action: "Utilize outro email para realizar esta operação.",
    });
  }
}

async function hashPasswordInObject(userInputValues) {
  const hashedPassword = await password.hash(userInputValues.password);
  userInputValues.password = hashedPassword;
}

const user = {
  create,
  search,
  findOneById,
  findOneByUsername,
  findOneByEmail,
  update,
  setBanStatus,
  setFeatures,
  addFeatures,
};

export default user;
