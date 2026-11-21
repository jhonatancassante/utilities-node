import { version as uuidVersion } from "uuid";

import orchestrator from "tests/orchestrator.js";
import user from "@/models/user.js";
import password from "@/models/password.js";
import session from "@/models/session.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/users", () => {
  const validPassword = ["Senha-De-Teste", "Segura", "123"].join("-") + "!!";

  describe("Usuário anônimo", () => {
    test("Com dados únicos e válidos", async () => {
      const response = await fetch(`${orchestrator.API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "unicoevalido",
          email: "unicoevalido@jhonatancassante.com.br",
          password: validPassword,
        }),
      });
      expect(response.status).toBe(201);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        username: "unicoevalido",
        features: ["read:activation_token"],
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      const userInDatabase = await user.findOneByUsername("unicoevalido");
      const correctPasswordMatch = await password.compare(
        validPassword,
        userInDatabase.password,
      );

      expect(correctPasswordMatch).toBe(true);

      const incorrectPassword = validPassword.replace("123", "124");
      const incorrectPasswordMatch = await password.compare(
        incorrectPassword,
        userInDatabase.password,
      );

      expect(incorrectPasswordMatch).toBe(false);
    });

    test("Rejeita uma foto de perfil em formato não permitido", async () => {
      const response = await fetch(`${orchestrator.API_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "fotoformato",
          email: "fotoformato@example.com",
          password: validPassword,
          profile_photo:
            "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
        }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        name: "ValidationError",
        message: "O formato da imagem não é permitido.",
        status_code: 400,
      });
    });

    test("Com nome de usuário duplicado", async () => {
      const response1 = await fetch(`${orchestrator.API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "usernameduplicado",
          email: "usernameduplicado1@jhonatancassante.com.br",
          password: validPassword,
        }),
      });
      expect(response1.status).toBe(201);

      const response2 = await fetch(`${orchestrator.API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "UsernameDuplicado",
          email: "usernameduplicado2@jhonatancassante.com.br",
          password: validPassword,
        }),
      });
      expect(response2.status).toBe(400);

      const response2Body = await response2.json();

      expect(response2Body).toEqual({
        name: "ValidationError",
        message: "O nome de usuário informado já está sendo utilizado.",
        action: "Utilize outro nome de usuário para realizar esta operação.",
        status_code: 400,
      });
    });

    test("Com email inválido", async () => {
      const response = await fetch(`${orchestrator.API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "emailInvalido",
          email: "emailInvalido",
          password: validPassword,
        }),
      });
      expect(response.status).toBe(400);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "O e-mail informado não possui um formato válido.",
        action:
          "Verifique se digitou o e-mail corretamente (ex: nome@dominio.com).",
        status_code: 400,
      });
    });

    test("Com email duplicado", async () => {
      const response1 = await fetch(`${orchestrator.API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "emailduplicado1",
          email: "emailduplicado@jhonatancassante.com.br",
          password: validPassword,
        }),
      });
      expect(response1.status).toBe(201);

      const response2 = await fetch(`${orchestrator.API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "emailduplicado2",
          email: "EmailDuplicado@jhonatancassante.com.br",
          password: validPassword,
        }),
      });
      expect(response2.status).toBe(400);

      const response2Body = await response2.json();

      expect(response2Body).toEqual({
        name: "ValidationError",
        message: "O email informado já está sendo utilizado.",
        action: "Utilize outro email para realizar esta operação.",
        status_code: 400,
      });
    });

    test.each([
      [
        "nome de usuário com caracteres inválidos",
        {
          username: "usuario!",
          email: "usuario-invalido@exemplo.com",
          password: validPassword,
        },
        "O nome de usuário contém caracteres não permitidos.",
      ],
      [
        "email com mais de 254 caracteres",
        {
          username: "usuario123",
          email: "a".repeat(245) + "@example.com",
          password: validPassword,
        },
        "O e-mail deve ter no máximo 254 caracteres.",
      ],
      [
        "senha com menos de 12 caracteres",
        {
          username: "usuario123",
          email: "usuario-valido@exemplo.com",
          password: ["Aa", "Bb", "12", "!!", "xyZ"].join(""),
        },
        "A senha deve ter pelo menos 12 caracteres.",
      ],
      [
        "senha sem letras minúsculas",
        {
          username: "usuario123",
          email: "usuario-valido@exemplo.com",
          password: ["123456789", "012345"].join(""),
        },
        "A senha deve conter pelo menos 2 letras minúsculas.",
      ],
      [
        "senha com mais de 64 caracteres",
        {
          username: "usuario123",
          email: "usuario-valido@exemplo.com",
          password: "S".repeat(65),
        },
        "A senha deve ter no máximo 64 caracteres.",
      ],
    ])("Com %s", async (_descricao, userInput, expectedMessage) => {
      const response = await fetch(`${orchestrator.API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userInput),
      });

      expect(response.status).toBe(400);
      const responseBody = await response.json();
      expect(responseBody.name).toBe("ValidationError");
      expect(responseBody.message).toBe(expectedMessage);
    });

    test("Com um cookie `session_id` expirado", async () => {
      const oldUser = await orchestrator.createUser();
      await orchestrator.activateUser(oldUser);
      const oldSession = await orchestrator.createSession(oldUser);
      await session.expireById(oldSession.id);

      const response = await fetch(`${orchestrator.API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${oldSession.token}`,
        },
        body: JSON.stringify({
          username: "cadastroComCookieExpirado",
          email: "cadastro.cookie.expirado@example.com",
          password: validPassword,
        }),
      });
      expect(response.status).toBe(201);

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

    test("Com um cookie `session_id` inexistente", async () => {
      const response = await fetch(`${orchestrator.API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${"0".repeat(96)}`,
        },
        body: JSON.stringify({
          username: "cadastroComCookieInexistente",
          email: "cadastro.cookie.inexistente@example.com",
          password: validPassword,
        }),
      });

      expect(response.status).toBe(201);
    });
  });

  describe("Usuário padrão", () => {
    test("Com dados únicos e válidos", async () => {
      const user1 = await orchestrator.createUser();
      await orchestrator.activateUser(user1);
      const user1SessionObject = await orchestrator.createSession(user1);

      const user2Response = await fetch(`${orchestrator.API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${user1SessionObject.token}`,
        },
        body: JSON.stringify({
          username: "unicoevalido",
          email: "unicoevalido@jhonatancassante.com.br",
          password: validPassword,
        }),
      });
      expect(user2Response.status).toBe(403);

      const responseBody = await user2Response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action: 'Verifique se o seu usuário possui a feature "create:user".',
        status_code: 403,
      });
    });
  });
});
