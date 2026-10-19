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
        password: "senha-correta",
      });

      const response = await fetch("http://localhost:3000/api/v1/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "email@errado.com.br",
          password: "senha-correta",
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

      const response = await fetch("http://localhost:3000/api/v1/sessions", {
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

      const response = await fetch("http://localhost:3000/api/v1/sessions", {
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
        password: "email.e.senha@correto",
      });

      const response = await fetch("http://localhost:3000/api/v1/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "email.e.senha@correto.com.br",
          password: "email.e.senha@correto",
        }),
      });
      expect(response.status).toBe(201);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        token: responseBody.token,
        user_id: newUser.id,
        expires_at: responseBody.expires_at,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(responseBody.token.length).toBe(96);
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

      const setCookies = response.headers.getSetCookieObject();

      const sessionCookie = orchestrator.getCookieObject(setCookies);

      expect(sessionCookie).toEqual({
        name: "session_id",
        value: responseBody.token,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
      });
    });
  });
});
