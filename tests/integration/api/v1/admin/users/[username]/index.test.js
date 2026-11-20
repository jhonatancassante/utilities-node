import orchestrator from "tests/orchestrator.js";
import user from "@/models/user.js";
import { protectedFeatures } from "@/configs/features.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

function adminUserUrl(username) {
  return `${orchestrator.API_URL}/admin/users/${username}`;
}

async function createPrivilegedSession() {
  const privilegedUser = await orchestrator.createUser();
  await orchestrator.activateUser(privilegedUser);
  await orchestrator.addFeaturesToUser(privilegedUser, protectedFeatures);
  const sessionObject = await orchestrator.createSession(privilegedUser);
  return { privilegedUser, sessionObject };
}

describe("GET /api/v1/admin/users/[username]", () => {
  describe("Usuário anônimo", () => {
    test("Consultando um usuário", async () => {
      const targetUser = await orchestrator.createUser();
      const response = await fetch(adminUserUrl(targetUser.username));
      expect(response.status).toBe(403);
    });
  });

  describe("Usuário padrão", () => {
    test("Consultando outro usuário", async () => {
      const standardUser = await orchestrator.createUser();
      await orchestrator.activateUser(standardUser);
      const sessionObject = await orchestrator.createSession(standardUser);
      const targetUser = await orchestrator.createUser();

      const response = await fetch(adminUserUrl(targetUser.username), {
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });
      expect(response.status).toBe(403);
    });
  });

  describe("Usuário privilegiado", () => {
    test("Consultando outro usuário sem expor a senha", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const targetUser = await orchestrator.createUser();

      const response = await fetch(adminUserUrl(targetUser.username), {
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
      const response = await fetch(adminUserUrl(targetUser.username), {
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

      const response = await fetch(adminUserUrl(targetUser.username), {
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

      const response = await fetch(adminUserUrl(targetUser.username), {
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
      expect(responseBody.features).toEqual([
        "update:user:others",
        "read:status:all",
      ]);
      expect(responseBody).not.toHaveProperty("password");

      const updatedUser = await user.findOneById(targetUser.id);
      expect(updatedUser.username).toBe("adminUpdatedUsername");
      expect(updatedUser.email).toBe("admin-updated@example.com");
    });

    test("Alterando as próprias permissões", async () => {
      const { privilegedUser, sessionObject } = await createPrivilegedSession();

      const response = await fetch(adminUserUrl(privilegedUser.username), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({
          features: [
            "create:session",
            "read:session",
            "update:user",
            ...protectedFeatures,
            "read:status:all",
          ],
        }),
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody.id).toBe(privilegedUser.id);
      expect(responseBody.features).toEqual([
        "create:session",
        "read:session",
        "update:user",
        ...protectedFeatures,
        "read:status:all",
      ]);
      expect(responseBody).not.toHaveProperty("password");

      const updatedUser = await user.findOneById(privilegedUser.id);
      expect(updatedUser.features).toEqual([
        "create:session",
        "read:session",
        "update:user",
        ...protectedFeatures,
        "read:status:all",
      ]);
    });

    test("Rejeitando a remoção de uma feature protegida", async () => {
      const { privilegedUser, sessionObject } = await createPrivilegedSession();

      const response = await fetch(adminUserUrl(privilegedUser.username), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({
          features: [
            "create:session",
            "update:user",
            "update:user:others",
            "read:status:all",
          ],
        }),
      });

      expect(response.status).toBe(400);
      const responseBody = await response.json();
      expect(responseBody.name).toBe("ValidationError");
      expect(responseBody.message).toBe(
        "As seguintes features não podem ser removidas deste usuário: read:session.",
      );
    });

    test("Enviando uma feature desconhecida", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const targetUser = await orchestrator.createUser();

      const response = await fetch(adminUserUrl(targetUser.username), {
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
        "As features a seguir não são reconhecidas ou estão excluídas: feature:inexistente.",
      );
    });
  });
});
