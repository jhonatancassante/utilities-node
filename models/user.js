import database from "@/infra/database.js";
import password from "@/models/password.js";
import session from "@/models/session.js";
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
  userInputValues.name = normalizeName(userInputValues.name ?? userInputValues.username);
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
          users (id, username, name, position, email, password, features, profile_photo_url, profile_photo_public_id)
        VALUES
          (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          *
        ;`,
      values: [
        userInputValues.id ?? null,
        userInputValues.username,
        userInputValues.name,
        "Não informado",
        userInputValues.email,
        userInputValues.password,
        userInputValues.features,
        userInputValues.profile_photo_url ?? null,
        userInputValues.profile_photo_public_id ?? null,
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

const UPDATABLE_FIELDS = ["name", "username", "email", "password"];

async function search(searchTerm) {
  if (typeof searchTerm !== "string" || searchTerm.trim().length < 2) {
    throw new ValidationError({
      message: "Informe ao menos dois caracteres para pesquisar um usuário.",
      action: "Pesquise pelo nome, nome de usuário ou e-mail.",
    });
  }

  const normalizedSearch = `%${searchTerm.trim()}%`;
  const results = await database.query({
    text: `
      SELECT
        id,
        username,
        name,
        email,
        features,
        banned_at,
        timeout_until,
        profile_photo_url,
        created_at,
        updated_at
      FROM
        users
      WHERE
        username ILIKE $1
        OR name ILIKE $1
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
  { allowFeatures = false, allowPosition = false, actorUserId } = {},
) {
  const currentUser = await findOneByUsername(username);
  const allowedInputValues = pickUpdatableFields(userInputValues, {
    allowFeatures,
    allowPosition,
  });
  if ("position" in allowedInputValues) {
    allowedInputValues.position = await validatePositionName(allowedInputValues.position);
  }

  if ("name" in allowedInputValues) {
    allowedInputValues.name = normalizeName(allowedInputValues.name);
  }

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
      const featuresUpdate = allowFeatures ? "features = $7," : "";
      const values = [
        userId,
        userWithNewValues.username,
        userWithNewValues.email,
        userWithNewValues.password,
        userWithNewValues.name,
        userWithNewValues.position,
      ];
      if (allowFeatures) values.push(userWithNewValues.features);
      const result = await client.query({
        text: `UPDATE users SET username = $2, email = $3, password = $4, name = $5, position = $6, ${featuresUpdate} updated_at = timezone('utc', now()) WHERE id = $1 RETURNING *;`,
        values,
      });
      return result.rows[0];
    };
    if (allowFeatures && Object.hasOwn(allowedInputValues, "features"))
      return database.transaction(updateUser);
    const result = await database.query({
      text: "UPDATE users SET username = $2, email = $3, password = $4, name = $5, position = $6, updated_at = timezone('utc', now()) WHERE id = $1 RETURNING *;",
      values: [
        userId,
        userWithNewValues.username,
        userWithNewValues.email,
        userWithNewValues.password,
        userWithNewValues.name,
        userWithNewValues.position,
      ],
    });
    return result.rows[0];
  }
}

function pickUpdatableFields(userInputValues, { allowFeatures = false, allowPosition = false } = {}) {
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

  const updatableFields = [
    ...UPDATABLE_FIELDS,
    ...(allowPosition ? ["position"] : []),
    ...(allowFeatures ? ["features"] : []),
  ];
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
      action: (() => {
        const fields = [
          ...UPDATABLE_FIELDS,
          ...(allowPosition ? ["position"] : []),
          ...(allowFeatures ? ["features"] : []),
        ];
        return `Envie apenas ${fields.slice(0, -1).join(", ")} e ${fields.at(-1)}.`;
      })(),
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

async function setProfilePhoto(userId, profilePhoto) {
  const results = await database.query({
    text: `
      UPDATE users
      SET
        profile_photo_url = $2,
        profile_photo_public_id = $3,
        updated_at = timezone('utc', now())
      WHERE id = $1
      RETURNING *
    ;`,
    values: [userId, profilePhoto?.url ?? null, profilePhoto?.publicId ?? null],
  });
  return results.rows[0];
}

async function ensureProtectedAdminCoverage(client, targetUserId) {
  const protectedFeaturesResult = await client.query({
    text: `
      SELECT name
      FROM features
      WHERE is_protected = true
        AND deleted_at IS NULL
      ORDER BY name
    ;`,
  });
  const protectedFeatureNames = protectedFeaturesResult.rows.map(
    (item) => item.name,
  );

  if (protectedFeatureNames.length === 0) return;

  const targetAdmin = await client.query({
    text: `
      SELECT id
      FROM users
      WHERE id = $1
        AND features @> $2::varchar[]
      LIMIT 1
    ;`,
    values: [targetUserId, protectedFeatureNames],
  });

  if (targetAdmin.rowCount === 0) return;

  const otherAdmin = await client.query({
    text: `
      SELECT id
      FROM users
      WHERE id <> $1
        AND features @> $2::varchar[]
      LIMIT 1
    ;`,
    values: [targetUserId, protectedFeatureNames],
  });

  if (otherAdmin.rowCount === 0) {
    throw new ConflictError({
      message:
        "Esta operação não pode ser realizada porque o usuário é o último administrador com todas as permissões protegidas.",
      action:
        "Conceda todas as permissões protegidas a outra conta antes de banir ou suspender este usuário.",
    });
  }
}

async function validateStatusChangeEligibility(username) {
  const targetUser = await findOneByUsername(username);

  await database.transaction(async (client) => {
    await ensureProtectedAdminCoverage(client, targetUser.id);
  });
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
    if (isBanned) {
      await client.query({
        text: "SELECT pg_advisory_xact_lock(hashtext($1));",
        values: ["protected-features-coverage"],
      });
    }

    const lockedUser = await client.query({
      text: "SELECT * FROM users WHERE id = $1 FOR UPDATE;",
      values: [currentUser.id],
    });

    if (lockedUser.rowCount === 0) {
      throw new NotFoundError({
        message: "O usuário não foi encontrado.",
        action: "Atualize a lista e tente novamente.",
      });
    }

    const lockedUserData = lockedUser.rows[0];
    if (Boolean(lockedUserData.banned_at) === isBanned) {
      return lockedUserData;
    }

    if (isBanned) {
      await ensureProtectedAdminCoverage(client, currentUser.id);
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

    const actorResults = actorUserId
      ? await client.query({
          text: "SELECT username, email FROM users WHERE id = $1;",
          values: [actorUserId],
        })
      : { rows: [] };
    const actor = actorResults.rows[0] ?? {};

    await client.query({
      text: `
        INSERT INTO user_ban_events (
          user_id,
          actor_user_id,
          action,
          username,
          email,
          account_created_at,
          actor_username,
          actor_email,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `,
      values: [
        lockedUserData.id,
        actorUserId ?? null,
        isBanned ? "ban" : "unban",
        lockedUserData.username,
        lockedUserData.email,
        lockedUserData.created_at,
        actor.username ?? null,
        actor.email ?? null,
        results.rows[0].updated_at,
      ],
    });

    if (isBanned) {
      await session.expireAllByUserId(currentUser.id, client);
    }

    return results.rows[0];
  });
}

async function setTimeoutStatus(username, timeoutUntil, actorUserId) {
  const currentUser = await findOneByUsername(username);

  if (currentUser.id === actorUserId) {
    throw new ForbiddenError({
      message:
        "Não é permitido aplicar ou remover timeout da própria conta administrativa.",
      action: "Selecione outro usuário para realizar esta operação.",
    });
  }

  let normalizedTimeout = null;
  if (timeoutUntil !== null) {
    if (typeof timeoutUntil !== "string") {
      throw new ValidationError({
        message: "A data e hora do timeout devem ser informadas como texto.",
        action: "Envie uma data e hora ISO 8601 futura.",
      });
    }

    normalizedTimeout = new Date(timeoutUntil);
    if (
      Number.isNaN(normalizedTimeout.getTime()) ||
      normalizedTimeout <= new Date()
    ) {
      throw new ValidationError({
        message: "A data e hora do timeout devem ser válidas e futuras.",
        action: "Informe uma data e hora posteriores ao momento atual.",
      });
    }
  }

  return database.transaction(async (client) => {
    if (normalizedTimeout) {
      await client.query({
        text: "SELECT pg_advisory_xact_lock(hashtext($1));",
        values: ["protected-features-coverage"],
      });
    }

    const lockedUser = await client.query({
      text: "SELECT id, banned_at FROM users WHERE id = $1 FOR UPDATE;",
      values: [currentUser.id],
    });

    if (lockedUser.rowCount === 0) {
      throw new NotFoundError({
        message: "O usuário não foi encontrado.",
        action: "Atualize a lista e tente novamente.",
      });
    }

    if (normalizedTimeout && lockedUser.rows[0].banned_at) {
      throw new ForbiddenError({
        message:
          "Não é possível aplicar timeout a uma conta que já está banida.",
        action: "Remova o banimento antes de aplicar uma suspensão temporária.",
      });
    }

    if (normalizedTimeout) {
      await ensureProtectedAdminCoverage(client, currentUser.id);
    }

    const result = await client.query({
      text: `
        UPDATE users
        SET
          timeout_until = $2,
          updated_at = timezone('utc', now())
        WHERE id = $1
        RETURNING *
      ;`,
      values: [currentUser.id, normalizedTimeout],
    });

    if (normalizedTimeout) {
      await session.expireAllByUserId(currentUser.id, client);
    }

    return result.rows[0];
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

async function validatePositionName(positionName) {
  if (typeof positionName !== "string" || !positionName.trim()) {
    throw new ValidationError({
      message: "O cargo deve ser informado como texto.",
      action: "Selecione um cargo cadastrado no sistema.",
    });
  }
  const normalizedPosition = positionName.trim();
  const results = await database.query({
    text: `SELECT name FROM positions WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL LIMIT 1;`,
    values: [normalizedPosition],
  });
  if (results.rowCount === 0) {
    throw new ValidationError({
      message: "O cargo informado não existe ou está inativo.",
      action: "Selecione um cargo ativo na lista de cargos cadastrados.",
    });
  }
  return results.rows[0].name;
}

function normalizeName(name) {
  if (typeof name !== "string") {
    throw new ValidationError({
      message: "O nome deve ser informado como texto.",
      action: "Informe um nome com até 150 caracteres.",
    });
  }
  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.length > 150) {
    throw new ValidationError({
      message: "O nome deve ter entre 1 e 150 caracteres.",
      action: "Informe um nome válido com até 150 caracteres.",
    });
  }
  return normalizedName;
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
  validateStatusChangeEligibility,
  setTimeoutStatus,
  setProfilePhoto,
  setFeatures,
  addFeatures,
};

export default user;
