import orchestrator from "tests/orchestrator.js";
import user from "@/models/user.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function createPrivilegedSession() {
  const privilegedUser = await orchestrator.createUser();
  await orchestrator.activateUser(privilegedUser);
  await orchestrator.addFeaturesToUser(privilegedUser, ["update:user:others"]);
  const sessionObject = await orchestrator.createSession(privilegedUser);
  return { privilegedUser, sessionObject };
}

describe("GET /api/v1/admin/users/[username]", () => {
  describe("Usuário anônimo", () => {
    test("Consultando um usuário", async () => {
      const targetUser = await orchestrator.createUser();
      const response = await fetch(`${orchestrator.API_URL}/admin/users/${targetUser.username}`);
      expect(response.status).toBe(403);
    });
  });

  describe("Usuário padrão", () => {
    test("Consultando outro usuário", async () => {
      const standardUser = await orchestrator.createUser();
      await orchestrator.activateUser(standardUser);
      const sessionObject = await orchestrator.createSession(standardUser);
      const targetUser = await orchestrator.createUser();

      const response = await fetch(`${orchestrator.API_URL}/admin/users/${targetUser.username}`, {
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });
      expect(response.status).toBe(403);
    });
  });

  describe("Usuário privilegiado", () => {
    test("Consultando os dados de outro usuário sem expor a senha", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const targetUser = await orchestrator.createUser();

      const response = await fetch(`${orchestrator.API_URL}/admin/users/${targetUser.username}`, {
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });
      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody).toMatchObject({
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        features: targetUser.features,
      });
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
    });
  });
});

describe("PATCH /api/v1/admin/users/[username]", () => {
  describe("Usuário anônimo", () => {
    test("Alterando os dados e as permissões de um usuário", async () => {
      const targetUser = await orchestrator.createUser();
      const response = await fetch(`${orchestrator.API_URL}/admin/users/${targetUser.username}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "changedByAnonymous" }),
      });
      expect(response.status).toBe(403);
    });
  });

  describe("Usuário padrão", () => {
    test("Alterando as permissões de outro usuário", async () => {
      const standardUser = await orchestrator.createUser();
      await orchestrator.activateUser(standardUser);
      const sessionObject = await orchestrator.createSession(standardUser);
      const targetUser = await orchestrator.createUser();

      const response = await fetch(`${orchestrator.API_URL}/admin/users/${targetUser.username}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({ features: ["update:user:others"] }),
      });
      expect(response.status).toBe(403);
    });
  });

  describe("Usuário privilegiado", () => {
    test("Alterando os dados e as permissões de outro usuário", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const targetUser = await orchestrator.createUser();

      const response = await fetch(`${orchestrator.API_URL}/admin/users/${targetUser.username}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({
          username: "adminUpdatedUsername",
          email: "admin-updated@example.com",
          password: "Senha-Atualizada-Segura-123!!",
          features: ["update:user:others", "read:status:all"],
        }),
      });
      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody.username).toBe("adminUpdatedUsername");
      expect(responseBody.email).toBe("admin-updated@example.com");
      expect(responseBody.features).toEqual(["update:user:others", "read:status:all"]);
      expect(responseBody).not.toHaveProperty("password");

      const updatedUser = await user.findOneById(targetUser.id);
      expect(updatedUser.username).toBe("adminUpdatedUsername");
      expect(updatedUser.email).toBe("admin-updated@example.com");
    });

    test("Tentando alterar a própria conta", async () => {
      const { privilegedUser, sessionObject } = await createPrivilegedSession();

      const response = await fetch(
        `${orchestrator.API_URL}/admin/users/${privilegedUser.username}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObject.token}`,
          },
          body: JSON.stringify({
            features: ["update:user:others", "read:status:all"],
          }),
        },
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        name: "ValidationError",
        message: "Não é permitido alterar a própria conta pelo painel administrativo.",
        action: "Utilize a página Meu perfil para alterar seus próprios dados.",
        status_code: 400,
      });
    });

    test("Enviando uma feature desconhecida", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const targetUser = await orchestrator.createUser();

      const response = await fetch(`${orchestrator.API_URL}/admin/users/${targetUser.username}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({ features: ["feature:inexistente"] }),
      });
      expect(response.status).toBe(400);
      const responseBody = await response.json();
      expect(responseBody.name).toBe("ValidationError");
      expect(responseBody.message).toBe(
        "As features a seguir não são reconhecidas: feature:inexistente.",
      );
    });
  });
});

describe("DELETE /api/v1/admin/users/[username]", () => {
  describe("Usuário anônimo", () => {
    test("Removendo um usuário", async () => {
      const targetUser = await orchestrator.createUser();
      const response = await fetch(`${orchestrator.API_URL}/admin/users/${targetUser.username}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(403);
    });
  });

  describe("Usuário padrão", () => {
    test("Removendo outro usuário", async () => {
      const standardUser = await orchestrator.createUser();
      await orchestrator.activateUser(standardUser);
      const sessionObject = await orchestrator.createSession(standardUser);
      const targetUser = await orchestrator.createUser();

      const response = await fetch(`${orchestrator.API_URL}/admin/users/${targetUser.username}`, {
        method: "DELETE",
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });
      expect(response.status).toBe(403);
    });
  });

  describe("Usuário privilegiado", () => {
    test("Removendo outro usuário e suas sessões", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const targetUser = await orchestrator.createUser();
      await orchestrator.createSession(targetUser);

      const response = await fetch(`${orchestrator.API_URL}/admin/users/${targetUser.username}`, {
        method: "DELETE",
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });
      expect(response.status).toBe(204);
      await expect(user.findOneById(targetUser.id)).rejects.toThrow();
    });

    test("Tentando remover a própria conta", async () => {
      const { privilegedUser, sessionObject } = await createPrivilegedSession();
      const response = await fetch(`${orchestrator.API_URL}/admin/users/${privilegedUser.username}`, {
        method: "DELETE",
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        name: "ValidationError",
        message: "Não é permitido remover a própria conta pelo painel administrativo.",
        action: "Utilize outra conta privilegiada para remover este usuário.",
        status_code: 400,
      });
    });
  });
});
