import dedent from "dedent";

import email from "@/infra/email.js";
import database from "@/infra/database.js";
import webserver from "@/infra/webserver.js";

const EXPIRATION_IN_MILLISECONDS = 15 * 60 * 1000; // 15 minutos

async function create(userId) {
  const expiresAt = new Date(Date.now() + EXPIRATION_IN_MILLISECONDS);

  const newToken = await runInsertQuery(userId, expiresAt);
  return newToken;

  async function runInsertQuery(userId, expiresAt) {
    const results = await database.query({
      text: `
        INSERT INTO
          user_activation_tokens (user_id, expires_at)
        VALUES
          ($1, $2)
        RETURNING
          *
        ;`,
      values: [userId, expiresAt],
    });

    return results.rows[0];
  }
}

async function findOneByUserId(userId) {
  const foundedToken = await runSelectQuery(userId);
  return foundedToken;

  async function runSelectQuery(userId) {
    const result = await database.query({
      text: `
        SELECT
          *
        FROM
          user_activation_tokens
        WHERE
          user_id = $1
        LIMIT 1
      ;`,
      values: [userId],
    });

    return result.rows[0];
  }
}

async function sendEmailToUser(user, activationToken) {
  await email.send({
    from: "Jhonatan Cassante<contato@jhonatancassante.com.br>",
    to: user.email,
    subject: "Ative seu cadastro no site jhonatancassante.com.br",
    text: dedent`Olá ${user.username},

    Clique no link abaixo para ativar seu cadastro no site jhonatancassante.com.br:

    ${webserver.origin}/cadastro/ativar/${activationToken.id}

    Atenciosamente,
    Jhonatan Cassante.`,
  });
}

const activation = {
  create,
  findOneByUserId,
  sendEmailToUser,
};

export default activation;
