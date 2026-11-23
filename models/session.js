import crypto from "node:crypto";
import database from "@/infra/database.js";
import {
  BannedUserError,
  TimedOutUserError,
  UnauthorizedError,
} from "@/infra/errors.js";

const EXPIRATION_IN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000; // 30 DIAS

async function create(userId) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = getExpiresAt();

  return database.transaction(async (client) => {
    const userResults = await client.query({
      text: "SELECT banned_at, timeout_until > NOW() AS timeout_active FROM users WHERE id = $1 FOR UPDATE;",
      values: [userId],
    });

    if (userResults.rowCount === 0) {
      throw new UnauthorizedError({
        message: "Não foi possível autenticar seu usuário no sistema.",
        action:
          "Verifique se digitou o e-mail e a senha corretamente e tente novamente.",
      });
    }

    if (userResults.rows[0].banned_at) {
      throw new BannedUserError({});
    }

    if (
      userResults.rows[0].timeout_active
    ) {
      throw new TimedOutUserError({});
    }

    const results = await client.query({
      text: `
        INSERT INTO
          sessions (token, user_id, expires_at)
        VALUES
          ($1, $2, $3)
        RETURNING
          *
        ;`,
      values: [token, userId, expiresAt],
    });

    return results.rows[0];
  });
}

async function findOneValidByToken(sessionToken) {
  const sessionFound = await runSelectQuery(sessionToken);

  return sessionFound;

  async function runSelectQuery(sessionToken) {
    const results = await database.query({
      text: `
        SELECT
          sessions.*
        FROM
          sessions
        INNER JOIN
          users
          ON users.id = sessions.user_id
        WHERE
          sessions.token = $1
          AND sessions.expires_at > NOW()
          AND users.banned_at IS NULL
          AND (users.timeout_until IS NULL OR users.timeout_until <= NOW())
        LIMIT 1
      ;`,
      values: [sessionToken],
    });

    if (results.rowCount === 0) {
      throw new UnauthorizedError({
        message: "Usuário não possui sessão ativa.",
        action: "Verifique se este usuário está logado e tente novamente.",
      });
    }

    return results.rows[0];
  }
}

async function renew(sessionId) {
  const expiresAt = getExpiresAt();

  return database.transaction(async (client) => {
    const userResults = await client.query({
      text: `
        SELECT
          users.banned_at,
          users.timeout_until > NOW() AS timeout_active
        FROM
          sessions
        INNER JOIN
          users
          ON users.id = sessions.user_id
        WHERE
          sessions.id = $1
        FOR UPDATE OF users
      ;`,
      values: [sessionId],
    });

    if (
      userResults.rowCount === 0 ||
      userResults.rows[0].banned_at ||
      userResults.rows[0].timeout_active
    ) {
      throw new UnauthorizedError({
        message: "Usuário não possui sessão ativa.",
        action: "Verifique se este usuário está logado e tente novamente.",
      });
    }

    const results = await client.query({
      text: `
        UPDATE
          sessions
        SET
          expires_at = $2,
          updated_at = timezone('utc', now())
        WHERE
          id = $1
        RETURNING
          *
      ;`,
      values: [sessionId, expiresAt],
    });

    return results.rows[0];
  });
}

async function expireById(sessionId) {
  const expiredSession = await runUpdateQuery(sessionId);
  return expiredSession;

  async function runUpdateQuery(sessionId) {
    const results = await database.query({
      text: `
        UPDATE
          sessions
        SET
          expires_at = expires_at - interval '1 year',
          updated_at = timezone('utc', now())
        WHERE
          id = $1
        RETURNING
          *
      ;`,
      values: [sessionId],
    });

    return results.rows[0];
  }
}

async function expireAllByUserId(userId, client = database) {
  const results = await client.query({
    text: `
      UPDATE
        sessions
      SET
        expires_at = expires_at - interval '1 year',
        updated_at = timezone('utc', now())
      WHERE
        user_id = $1
      RETURNING
        id
    ;`,
    values: [userId],
  });

  return results.rows;
}

function getExpiresAt() {
  return new Date(Date.now() + EXPIRATION_IN_MILLISECONDS);
}

const session = {
  create,
  findOneValidByToken,
  renew,
  expireById,
  expireAllByUserId,
  EXPIRATION_IN_MILLISECONDS,
};

export default session;
