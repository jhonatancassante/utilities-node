import dedent from "dedent";

import email from "@/infra/email.js";
import database from "@/infra/database.js";
import webserver from "@/infra/webserver.js";
import { NotFoundError, ForbiddenError } from "@/infra/errors.js";
import { assertRecordId } from "@/lib/server/record-helpers.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";

const EXPIRATION_IN_MILLISECONDS = 15 * 60 * 1000; // 15 minutos
const ACTIVE_USER_FEATURES = ["create:session", "read:session", "update:user"];

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

async function findOneValidById(id) {
  assertRecordId(id, {
    message:
      "O token de ativação utilizado não foi encontrado no sistema ou expirou.",
    action: "Faça um novo cadastro.",
  });

  const foundedToken = await runSelectQuery(id);
  return foundedToken;

  async function runSelectQuery(id) {
    const results = await database.query({
      text: `
        SELECT
          *
        FROM
          user_activation_tokens
        WHERE
          id = $1
          AND expires_at > NOW()
          AND used_at IS NULL
        LIMIT 1
      ;`,
      values: [id],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message:
          "O token de ativação utilizado não foi encontrado no sistema ou expirou.",
        action: "Faça um novo cadastro.",
      });
    }

    return results.rows[0];
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

async function markTokenAsUsed(activationTokenId) {
  const usedActivationToken = await runUpdateQuery(activationTokenId);
  return usedActivationToken;

  async function runUpdateQuery(activationTokenId) {
    const results = await database.query({
      text: `
        UPDATE
          user_activation_tokens
        SET
          used_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        WHERE
          id = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING
          *
      ;`,
      values: [activationTokenId],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O token de ativação não foi encontrado ou expirou.",
        action: "Faça um novo cadastro.",
      });
    }

    return results.rows[0];
  }
}

async function activate(activationTokenId) {
  return await database.transaction(async (client) => {
    const tokenResults = await client.query({
      text: `
        UPDATE
          user_activation_tokens
        SET
          used_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        WHERE
          id = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING
          *
      ;`,
      values: [activationTokenId],
    });

    if (tokenResults.rowCount === 0) {
      throw new NotFoundError({
        message:
          "O token de ativação utilizado não foi encontrado no sistema ou expirou.",
        action: "Faça um novo cadastro.",
      });
    }

    const usedToken = tokenResults.rows[0];

    const userResults = await client.query({
      text: `
        SELECT
          *
        FROM
          users
        WHERE
          id = $1
        FOR UPDATE
      ;`,
      values: [usedToken.user_id],
    });

    if (userResults.rowCount === 0) {
      throw new NotFoundError({
        message: "O usuário deste token de ativação não foi encontrado.",
        action: "Faça um novo cadastro.",
      });
    }

    if (!authorization.can(userResults.rows[0], "read:activation_token")) {
      throw new ForbiddenError({
        message: "Você não pode mais utilizar tokens de ativação.",
        action: "Entre em contato com o suporte.",
      });
    }

    await client.query({
      text: `
        UPDATE
          users
        SET
          features = $2,
          updated_at = timezone('utc', now())
        WHERE
          id = $1
      ;`,
      values: [usedToken.user_id, ACTIVE_USER_FEATURES],
    });

    return usedToken;
  });
}

async function activateUserByUserId(userId) {
  const userToActivate = await user.findOneById(userId);

  if (!authorization.can(userToActivate, "read:activation_token")) {
    throw new ForbiddenError({
      message: "Você não pode mais utilizar tokens de ativação.",
      action: "Entre em contato com o suporte.",
    });
  }

  const activatedUser = await user.setFeatures(userId, ACTIVE_USER_FEATURES);
  return activatedUser;
}

const activation = {
  EXPIRATION_IN_MILLISECONDS,
  create,
  findOneValidById,
  sendEmailToUser,
  markTokenAsUsed,
  activateUserByUserId,
  activate,
};

export default activation;
