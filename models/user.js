import database from "@/infra/database.js";
import password from "@/models/password.js";
import { ValidationError, NotFoundError } from "@/infra/errors.js";
import {
  validateUsername,
  validateEmail,
  validatePassword,
} from "@/lib/user-validation.js";

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
          *
        FROM
          users
        WHERE
          id = $1
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
          *
        FROM
          users
        WHERE
          LOWER(username) = LOWER($1)
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

async function update(username, userInputValues) {
  const currentUser = await findOneByUsername(username);

  if ("username" in userInputValues) {
    validateUsernameFormat(userInputValues.username);
    userInputValues.username = userInputValues.username.trim();
    if (
      currentUser.username.toLowerCase() !==
      userInputValues.username.toLowerCase()
    ) {
      await validateUniqueUsername(userInputValues.username);
    }
  }

  if ("email" in userInputValues) {
    validateEmailFormat(userInputValues.email);
    userInputValues.email = userInputValues.email.trim();
    if (
      currentUser.email.toLowerCase() !== userInputValues.email.toLowerCase()
    ) {
      await validateUniqueEmail(userInputValues.email);
    }
  }

  if ("password" in userInputValues) {
    validatePasswordFormat(userInputValues.password);
    await hashPasswordInObject(userInputValues);
  }

  const userWithNewValues = { ...currentUser, ...userInputValues };

  const updatedUser = await runUpdateQuery(userWithNewValues);
  return updatedUser;

  async function runUpdateQuery(userWithNewValues) {
    const results = await database.query({
      text: `
        UPDATE
          users
        SET
          username = $2,
          email = $3,
          password = $4,
          updated_at = timezone('utc', now())
        WHERE
          id = $1
        RETURNING
          *
      ;`,
      values: [
        userWithNewValues.id,
        userWithNewValues.username,
        userWithNewValues.email,
        userWithNewValues.password,
      ],
    });

    return results.rows[0];
  }
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
  findOneById,
  findOneByUsername,
  findOneByEmail,
  update,
  setFeatures,
  addFeatures,
};

export default user;
