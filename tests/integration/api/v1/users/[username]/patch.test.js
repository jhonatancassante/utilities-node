import { version as uuidVersion } from "uuid";

import orchestrator from "tests/orchestrator.js";
import user from "@/models/user.js";
import password from "@/models/password.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("PATCH /api/v1/users/[username]", () => {
  describe("Usuário anônimo", () => {
    test("Alterando um usuário", async () => {
      const createdUser = await orchestrator.createUser();

      const response = await fetch(
        `${orchestrator.API_URL}/users/${createdUser.username}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: "newUniqueUsername",
          }),
        },
      );
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action: 'Verifique se o seu usuário possui a feature "update:user".',
        status_code: 403,
      });
    });
  });

  describe("Usuário autenticado", () => {
    test("Com nome de usuário inexistente", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const createdUserSessionObject =
        await orchestrator.createSession(createdUser);

      const response = await fetch(
        `${orchestrator.API_URL}/users/UsuarioInexistente`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${createdUserSessionObject.token}`,
          },
        },
      );
      expect(response.status).toBe(404);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "NotFoundError",
        message: "O nome de usuário informado não foi encontrado no sistema.",
        action:
          "Verifique se digitou o nome de usuário corretamente e tente novamente.",
        status_code: 404,
      });
    });

    test("Com nome de usuário duplicado", async () => {
      await orchestrator.createUser({
        username: "user1",
      });

      const user2 = await orchestrator.createUser({
        username: "user2",
      });
      await orchestrator.activateUser(user2);
      const user2SessionObject = await orchestrator.createSession(user2);

      const response = await fetch(`${orchestrator.API_URL}/users/user2`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${user2SessionObject.token}`,
        },
        body: JSON.stringify({
          username: "user1",
        }),
      });
      expect(response.status).toBe(400);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "O nome de usuário informado já está sendo utilizado.",
        action: "Utilize outro nome de usuário para realizar esta operação.",
        status_code: 400,
      });
    });

    test("Com email inválido", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const createdUserSessionObject =
        await orchestrator.createSession(createdUser);

      const response = await fetch(
        `${orchestrator.API_URL}/users/${createdUser.username}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${createdUserSessionObject.token}`,
          },
          body: JSON.stringify({
            email: "emailInvalido",
          }),
        },
      );
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
      await orchestrator.createUser({
        email: "email1@jhonatancassante.com.br",
      });

      const createdUser2 = await orchestrator.createUser({
        email: "email2@jhonatancassante.com.br",
      });
      await orchestrator.activateUser(createdUser2);
      const createdUser2SessionObject =
        await orchestrator.createSession(createdUser2);

      const response = await fetch(
        `${orchestrator.API_URL}/users/${createdUser2.username}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${createdUser2SessionObject.token}`,
          },
          body: JSON.stringify({
            email: "email1@jhonatancassante.com.br",
          }),
        },
      );
      expect(response.status).toBe(400);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "O email informado já está sendo utilizado.",
        action: "Utilize outro email para realizar esta operação.",
        status_code: 400,
      });
    });

    test("Com nome de usuário único", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const createdUserSessionObject =
        await orchestrator.createSession(createdUser);

      const response = await fetch(
        `${orchestrator.API_URL}/users/${createdUser.username}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${createdUserSessionObject.token}`,
          },
          body: JSON.stringify({
            username: "newUniqueUsername",
          }),
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        username: "newUniqueUsername",
        features: ["create:session", "read:session", "update:user"],
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
      expect(responseBody.updated_at > responseBody.created_at).toBe(true);
    });

    test("Com email único", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const createdUserSessionObject =
        await orchestrator.createSession(createdUser);

      const response = await fetch(
        `${orchestrator.API_URL}/users/${createdUser.username}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${createdUserSessionObject.token}`,
          },
          body: JSON.stringify({
            email: "newUniqueEmail@jhonatancassante.com.br",
          }),
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        username: createdUser.username,
        features: ["create:session", "read:session", "update:user"],
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
      expect(responseBody.updated_at > responseBody.created_at).toBe(true);

      const userInDatabase = await user.findOneByUsername(createdUser.username);

      expect(userInDatabase.email).toBe(
        "newUniqueEmail@jhonatancassante.com.br",
      );
    });

    test("Com um novo password", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const createdUserSessionObject =
        await orchestrator.createSession(createdUser);

      const response = await fetch(
        `${orchestrator.API_URL}/users/${createdUser.username}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${createdUserSessionObject.token}`,
          },
          body: JSON.stringify({
            password: "Senha-Atualizada-Segura-123!!",
          }),
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        username: createdUser.username,
        features: ["create:session", "read:session", "update:user"],
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
      expect(responseBody.updated_at > responseBody.created_at).toBe(true);

      const userInDatabase = await user.findOneByUsername(createdUser.username);
      const correctPasswordMatch = await password.compare(
        "Senha-Atualizada-Segura-123!!",
        userInDatabase.password,
      );

      expect(correctPasswordMatch).toBe(true);

      const incorrectPasswordMatch = await password.compare(
        "Senha-Anterior-Segura-123!!",
        userInDatabase.password,
      );

      expect(incorrectPasswordMatch).toBe(false);
    });

    test("Usuário1 tentando alterar o Usuário2", async () => {
      const user1 = await orchestrator.createUser();
      await orchestrator.activateUser(user1);
      const user1SessionObject = await orchestrator.createSession(user1);

      const user2 = await orchestrator.createUser();

      const response = await fetch(
        `${orchestrator.API_URL}/users/${user2.username}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${user1SessionObject.token}`,
          },
          body: JSON.stringify({
            username: "newUniqueUsernameToUser2",
          }),
        },
      );
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action: 'Verifique se o seu usuário possui a feature "update:user".',
        status_code: 403,
      });
    });

    test("Enviando `id` de outro usuário no body", async () => {
      const user1 = await orchestrator.createUser();
      await orchestrator.activateUser(user1);
      const user1SessionObject = await orchestrator.createSession(user1);

      const user2 = await orchestrator.createUser();

      const response = await fetch(
        `${orchestrator.API_URL}/users/${user1.username}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${user1SessionObject.token}`,
          },
          body: JSON.stringify({
            id: user2.id,
            username: "usernameSomenteDoUsuario1",
          }),
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody.id).toBe(user1.id);
      expect(responseBody.username).toBe("usernameSomenteDoUsuario1");

      const user1InDatabase = await user.findOneById(user1.id);
      expect(user1InDatabase.username).toBe("usernameSomenteDoUsuario1");

      const user2InDatabase = await user.findOneById(user2.id);
      expect(user2InDatabase.username).toBe(user2.username);
      expect(user2InDatabase.email).toBe(user2.email);
      expect(user2InDatabase.password).toBe(user2.password);
    });

    test("Enviando campos que não podem ser alterados", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const createdUserSessionObject =
        await orchestrator.createSession(createdUser);

      const response = await fetch(
        `${orchestrator.API_URL}/users/${createdUser.username}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${createdUserSessionObject.token}`,
          },
          body: JSON.stringify({
            id: "00000000-0000-4000-8000-000000000000",
            features: ["update:user:others", "read:migration"],
            created_at: "2000-01-01T00:00:00.000Z",
          }),
        },
      );
      expect(response.status).toBe(200);

      const userInDatabase = await user.findOneById(createdUser.id);
      expect(userInDatabase.id).toBe(createdUser.id);
      expect(userInDatabase.features).toEqual([
        "create:session",
        "read:session",
        "update:user",
      ]);
      expect(userInDatabase.created_at).toEqual(createdUser.created_at);
    });
  });

  describe("Usuário privilegiado", () => {
    test("Com `update:user:other` tentando alterar o Usuário2", async () => {
      const privilegedUser = await orchestrator.createUser();
      await orchestrator.activateUser(privilegedUser);
      await orchestrator.addFeaturesToUser(privilegedUser, [
        "update:user:others",
      ]);
      const privilegedUserSessionObject =
        await orchestrator.createSession(privilegedUser);

      const user2 = await orchestrator.createUser();

      const response = await fetch(
        `${orchestrator.API_URL}/users/${user2.username}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${privilegedUserSessionObject.token}`,
          },
          body: JSON.stringify({
            username: "newUniqueUsernameToUser2",
          }),
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: user2.id,
        username: "newUniqueUsernameToUser2",
        features: user2.features,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });
    });
  });
});
