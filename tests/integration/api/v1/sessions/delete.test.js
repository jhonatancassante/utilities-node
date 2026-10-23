import { jest } from "@jest/globals";
import { version as uuidVersion } from "uuid";

import orchestrator from "tests/orchestrator.js";
import session from "@/models/session.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("DELETE /api/v1/sessions", () => {
  describe("Usuário Padrão", () => {
    test("Como uma sessão inexistente", async () => {
      const nonexistentToken = "EsseTokenNaoExisteEhApenasUmPlaceHolder";

      const response = await fetch(`${orchestrator.API_URL}/sessions`, {
        method: "DELETE",
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
    });

    test("Com um sessão expirada", async () => {
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

      const response = await fetch(`${orchestrator.API_URL}/sessions`, {
        method: "DELETE",
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
    });

    test("Com uma sessão válida", async () => {
      const createdUser = await orchestrator.createUser();
      const sessionObject = await orchestrator.createSession(createdUser.id);

      const response = await fetch(`${orchestrator.API_URL}/sessions`, {
        method: "DELETE",
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: sessionObject.id,
        token: sessionObject.token,
        user_id: sessionObject.user_id,
        expires_at: responseBody.expires_at,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(responseBody.token.length).toBe(96);
      expect(Date.parse(responseBody.expires_at)).not.toBeNaN();
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      expect(
        responseBody.expires_at < sessionObject.expires_at.toISOString(),
      ).toBe(true);
      expect(
        responseBody.updated_at > sessionObject.updated_at.toISOString(),
      ).toBe(true);

      const sessionCookie = orchestrator.getSessionCookieObject(response);
      expect(sessionCookie).toEqual({
        name: "session_id",
        value: "invalid",
        maxAge: -1,
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      });

      const doubleCheckResponse = await fetch(`${orchestrator.API_URL}/user`, {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });
      expect(doubleCheckResponse.status).toBe(401);

      const doubleCheckResponseBody = await doubleCheckResponse.json();

      expect(doubleCheckResponseBody).toEqual({
        name: "UnauthorizedError",
        message: "Usuário não possui sessão ativa.",
        action: "Verifique se este usuário está logado e tente novamente.",
        status_code: 401,
      });
    });
  });
});
