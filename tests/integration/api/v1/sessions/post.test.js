import { version as uuidVersion } from "uuid";

import orchestrator from "tests/orchestrator.js";
import session from "@/models/session.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/sessions", () => {
  describe("Usuário anônimo", () => {
    test("Com o email incorreto mas com a senha correta", async () => {
      await orchestrator.createUser({
        password: "Senha-De-Teste-Segura-123!!",
      });

      const response = await fetch(`${orchestrator.API_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "email@errado.com.br",
          password: "Senha-De-Teste-Segura-123!!",
        }),
      });
      expect(response.status).toBe(401);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Não foi possível autenticar seu usuário no sistema.",
        action:
          "Verifique se digitou o e-mail e a senha corretamente e tente novamente.",
        status_code: 401,
      });
    });

    test("Com a senha incorreta mas com o email correto", async () => {
      await orchestrator.createUser({
        email: "email@correto.com.br",
      });

      const response = await fetch(`${orchestrator.API_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "email@correto.com.br",
          password: "senha-incorreta",
        }),
      });
      expect(response.status).toBe(401);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Não foi possível autenticar seu usuário no sistema.",
        action:
          "Verifique se digitou o e-mail e a senha corretamente e tente novamente.",
        status_code: 401,
      });
    });

    test("Com o email e a senha incorretos", async () => {
      await orchestrator.createUser();

      const response = await fetch(`${orchestrator.API_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "email@incorreto.com.br",
          password: "senha-incorreta",
        }),
      });
      expect(response.status).toBe(401);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Não foi possível autenticar seu usuário no sistema.",
        action:
          "Verifique se digitou o e-mail e a senha corretamente e tente novamente.",
        status_code: 401,
      });
    });

    test("Com o email e a senha corretos", async () => {
      const newUser = await orchestrator.createUser({
        email: "email.e.senha@correto.com.br",
        password: "Email.E.Senha12!!",
      });

      await orchestrator.activateUser(newUser);

      const response = await fetch(`${orchestrator.API_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "email.e.senha@correto.com.br",
          password: "Email.E.Senha12!!",
        }),
      });
      expect(response.status).toBe(201);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        user_id: newUser.id,
        expires_at: responseBody.expires_at,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(responseBody).not.toHaveProperty("token");
      expect(Date.parse(responseBody.expires_at)).not.toBeNaN();
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      const expiresAt = new Date(responseBody.expires_at);
      const createdAt = new Date(responseBody.created_at);

      expect(expiresAt > createdAt).toBe(true);

      const actualLifetimeInMilliseconds = expiresAt - createdAt;
      const lifetimeDifferenceInMilliseconds =
        session.EXPIRATION_IN_MILLISECONDS - actualLifetimeInMilliseconds;

      expect(lifetimeDifferenceInMilliseconds).toBeLessThanOrEqual(100);

      const sessionCookie = orchestrator.getSessionCookieObject(response);

      expect(sessionCookie.value).toMatch(/^[0-9a-f]{96}$/);

      expect(sessionCookie).toEqual({
        name: "session_id",
        value: sessionCookie.value,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
      });
    });
    describe("Com um cookie `session_id` antigo", () => {
      async function login(email, password, sessionToken) {
        return await fetch(`${orchestrator.API_URL}/sessions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionToken}`,
          },
          body: JSON.stringify({ email, password }),
        });
      }

      test("Sessão expirada, com credenciais corretas", async () => {
        const newUser = await orchestrator.createUser({
          email: "cookie.expirado@correto.com.br",
          password: "Email.E.Senha12!!",
        });
        await orchestrator.activateUser(newUser);
        const oldSession = await orchestrator.createSession(newUser);
        await session.expireById(oldSession.id);

        const response = await login(
          "cookie.expirado@correto.com.br",
          "Email.E.Senha12!!",
          oldSession.token,
        );
        expect(response.status).toBe(201);

        const sessionCookie = orchestrator.getSessionCookieObject(response);
        expect(sessionCookie.value).toMatch(/^[0-9a-f]{96}$/);
        expect(sessionCookie.value).not.toBe(oldSession.token);
        expect(sessionCookie.maxAge).toBe(
          session.EXPIRATION_IN_MILLISECONDS / 1000,
        );
      });

      test("Token inexistente, com credenciais corretas", async () => {
        const newUser = await orchestrator.createUser({
          email: "cookie.inexistente@correto.com.br",
          password: "Email.E.Senha12!!",
        });
        await orchestrator.activateUser(newUser);

        const response = await login(
          "cookie.inexistente@correto.com.br",
          "Email.E.Senha12!!",
          "0".repeat(96),
        );
        expect(response.status).toBe(201);

        const sessionCookie = orchestrator.getSessionCookieObject(response);
        expect(sessionCookie.value).toMatch(/^[0-9a-f]{96}$/);
      });

      test("Sessão expirada, com credenciais incorretas", async () => {
        const newUser = await orchestrator.createUser({
          email: "cookie.expirado@incorreto.com.br",
        });
        await orchestrator.activateUser(newUser);
        const oldSession = await orchestrator.createSession(newUser);
        await session.expireById(oldSession.id);

        const response = await login(
          "cookie.expirado@incorreto.com.br",
          "senha-incorreta",
          oldSession.token,
        );
        expect(response.status).toBe(401);

        const responseBody = await response.json();
        expect(responseBody.message).toBe(
          "Não foi possível autenticar seu usuário no sistema.",
        );

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
    });
  });
});
