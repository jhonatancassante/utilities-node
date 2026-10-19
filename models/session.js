import * as cookie from "cookie";
import crypto from "node:crypto";
import database from "@/infra/database.js";
import { UnauthorizedError } from "@/infra/errors.js";

const EXPIRATION_IN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000; // 30 DIAS

async function create(userId) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = getExpiresAt();

  const newSession = await runInsertQuery(token, userId, expiresAt);

  return newSession;

  async function runInsertQuery(token, userId, expiresAt) {
    const results = await database.query({
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
  }
}

async function findOneValidByToken(sessionToken) {
  const sessionFound = await runSelectQuery(sessionToken);

  return sessionFound;

  async function runSelectQuery(sessionToken) {
    const results = await database.query({
      text: `
        SELECT
          *
        FROM
          sessions
        WHERE
          token = $1
          AND expires_at > NOW()
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
  const renewedSession = await runUpdateQuery(sessionId, expiresAt);
  return renewedSession;

  async function runUpdateQuery(sessionId, expiresAt) {
    const results = await database.query({
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
  }
}

function getExpiresAt() {
  return new Date(Date.now() + EXPIRATION_IN_MILLISECONDS);
}

function getSetCookiesString(sessionToken) {
  return cookie.stringifySetCookie({
    name: "session_id",
    value: sessionToken,
    path: "/",
    maxAge: EXPIRATION_IN_MILLISECONDS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

const session = {
  create,
  findOneValidByToken,
  renew,
  getSetCookiesString,
  EXPIRATION_IN_MILLISECONDS,
};

export default session;
