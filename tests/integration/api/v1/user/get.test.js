import { jest } from "@jest/globals";
import { version as uuidVersion } from "uuid";

import orchestrator from "tests/orchestrator.js";
import session from "@/models/session.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/user", () => {
  describe("Usuário anônimo", () => {
    test("Com uma sessão válida", async () => {
      const createdUser = await orchestrator.createUser({
        username: "UsuarioComSessaoValida",
      });

      const sessionObject = await orchestrator.createSession(createdUser.id);

      const response = await fetch("http://localhost:3000/api/v1/user", {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });
      expect(response.status).toBe(200);

      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toBe(
        "no-store, no-cache, max-age=0, must-revalidate",
      );

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: createdUser.id,
        username: "UsuarioComSessaoValida",
        email: createdUser.email,
        password: createdUser.password,
        created_at: createdUser.created_at.toISOString(),
        updated_at: createdUser.updated_at.toISOString(),
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      //Sessions assertions
      const renewedSessionObject = await session.findOneValidByToken(
        sessionObject.token,
      );

      expect(
        renewedSessionObject.expires_at > sessionObject.expires_at,
      ).toEqual(true);
      expect(
        renewedSessionObject.updated_at > sessionObject.updated_at,
      ).toEqual(true);

      //Cookies assertions
      const sessionCookie = orchestrator.getSessionCookieObject(response);

      expect(sessionCookie).toEqual({
        name: "session_id",
        value: renewedSessionObject.token,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
      });
    });

    test("Com uma sessão que não existe", async () => {
      const nonexistentToken = "EsseTokenNaoExisteEhApenasUmPlaceHolder";

      const response = await fetch("http://localhost:3000/api/v1/user", {
        headers: {
          Cookie: `session_id=${nonexistentToken}`,
        },
      });
      expect(response.status).toBe(401);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Usuário não possui sessão ativa.",
        action: "Verifique se este usuário está logado e tente novamente.",
        status_code: 401,
      });

      const sessionCookie = orchestrator.getSessionCookieObject(response);
      expect(sessionCookie).toEqual({
        name: "session_id",
        value: "invalid",
        maxAge: -1,
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      });
    });

    test("Com uma sessão expirada", async () => {
      const createdUser = await orchestrator.createUser();

      jest.useFakeTimers({
        now: new Date(Date.now() - session.EXPIRATION_IN_MILLISECONDS),
        // Falsifica só o Date. Os demais continuam reais.
        doNotFake: [
          "nextTick",
          "setImmediate",
          "clearImmediate",
          "setTimeout",
          "clearTimeout",
          "setInterval",
          "clearInterval",
          "queueMicrotask",
          "performance",
          "hrtime",
        ],
      });

      const sessionObject = await orchestrator.createSession(createdUser.id);

      jest.useRealTimers();

      const response = await fetch("http://localhost:3000/api/v1/user", {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });
      expect(response.status).toBe(401);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Usuário não possui sessão ativa.",
        action: "Verifique se este usuário está logado e tente novamente.",
        status_code: 401,
      });

      const sessionCookie = orchestrator.getSessionCookieObject(response);
      expect(sessionCookie).toEqual({
        name: "session_id",
        value: "invalid",
        maxAge: -1,
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      });
    });

    test("Com uma sessão válida mas a meia vida", async () => {
      const createdUser = await orchestrator.createUser();

      jest.useFakeTimers({
        now: new Date(Date.now() - session.EXPIRATION_IN_MILLISECONDS / 2),
        // Falsifica só o Date. Os demais continuam reais.
        doNotFake: [
          "nextTick",
          "setImmediate",
          "clearImmediate",
          "setTimeout",
          "clearTimeout",
          "setInterval",
          "clearInterval",
          "queueMicrotask",
          "performance",
          "hrtime",
        ],
      });

      const sessionObject = await orchestrator.createSession(createdUser.id);

      jest.useRealTimers();

      const response = await fetch("http://localhost:3000/api/v1/user", {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: createdUser.id,
        username: createdUser.username,
        email: createdUser.email,
        password: createdUser.password,
        created_at: createdUser.created_at.toISOString(),
        updated_at: createdUser.updated_at.toISOString(),
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      //Sessions assertions
      const renewedSessionObject = await session.findOneValidByToken(
        sessionObject.token,
      );

      expect(
        renewedSessionObject.expires_at > sessionObject.expires_at,
      ).toEqual(true);
      expect(
        renewedSessionObject.updated_at > sessionObject.updated_at,
      ).toEqual(true);

      //Cookies assertions
      const sessionCookie = orchestrator.getSessionCookieObject(response);

      expect(sessionCookie).toEqual({
        name: "session_id",
        value: renewedSessionObject.token,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
      });

      const oldExpiresAt = new Date(sessionObject.expires_at);
      const expiresAt = new Date(renewedSessionObject.expires_at);

      expect(expiresAt > oldExpiresAt).toBe(true);

      const actualLifetimeInMilliseconds = expiresAt - oldExpiresAt;

      const lifetimeDifferenceInMilliseconds =
        session.EXPIRATION_IN_MILLISECONDS / 2 - actualLifetimeInMilliseconds;

      expect(lifetimeDifferenceInMilliseconds).toBeLessThanOrEqual(100);
    });
  });
});
