import database from "@/infra/database.js";
import password from "@/models/password.js";
import { ValidationError, NotFoundError } from "@/infra/errors.js";

async function create(userInputValues) {
  await validateEmailFormat(userInputValues.email);
  await validateUniqueEmail(userInputValues.email);
  await validateUniqueUsername(userInputValues.username);
  await hashPasswordInObject(userInputValues);

  const newUser = await runInsertQuery(userInputValues);
  return newUser;

  function validateEmailFormat(email) {
    const cleanEmail = email.trim();

    // Regex padrão para validação estrutural de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      throw new ValidationError({
        message: "O e-mail informado não possui um formato válido.",
        action:
          "Verifique se digitou o e-mail corretamente (ex: nome@dominio.com).",
      });
    }
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
        action: "Utilize outro email para realizar o cadastro.",
      });
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
        action: "Utilize outro nome de usuário para realizar o cadastro.",
      });
    }
  }

  async function hashPasswordInObject(userInputValues) {
    const hashedPassword = await password.hash(userInputValues.password);
    userInputValues.password = hashedPassword;
  }

  async function runInsertQuery(userInputValues) {
    const { username, email, password } = userInputValues;

    const results = await database.query({
      text: `
        INSERT INTO
          users (username, email, password)
        VALUES
          ($1, $2, $3)
        RETURNING
          *
        ;`,
      values: [username, email, password],
    });

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

const user = {
  create,
  findOneByUsername,
};

export default user;
