import orchestrator from "tests/orchestrator.js";
import user from "@/models/user.js";
import feature from "@/models/feature.js";
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
  await orchestrator.addFeaturesToUser(privilegedUser, [...protectedFeatures, "read:session"]);
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

    test("Atribuindo uma feature criada dinamicamente", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const targetUser = await orchestrator.createUser();
      const dynamicFeature = await feature.create({
        name: "read:dynamicreports",
        label: "Consultar relatórios dinâmicos",
        group_name: "Relatórios",
        description: "Permite consultar relatórios criados dinamicamente.",
      });

      const response = await fetch(adminUserUrl(targetUser.username), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({
          features: ["read:activation_token", dynamicFeature.name],
        }),
      });

      expect(response.status).toBe(200);
      expect((await response.json()).features).toEqual([
        "read:activation_token",
        "read:dynamicreports",
      ]);
      const updatedUser = await user.findOneById(targetUser.id);
      expect(updatedUser.features).toContain(dynamicFeature.name);
    });

    test("Rejeitando a atribuição de uma feature excluída", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const targetUser = await orchestrator.createUser();
      const deletedFeature = await feature.create({
        name: "read:deletedreports",
        label: "Consultar relatórios excluídos",
        group_name: "Relatórios",
        description: "Feature usada para validar exclusão lógica.",
      });
      await feature.delete(deletedFeature.id);

      const response = await fetch(adminUserUrl(targetUser.username), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({
          features: ["read:activation_token", deletedFeature.name],
        }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        name: "ValidationError",
        message:
          "As features a seguir não são reconhecidas ou estão excluídas: read:deletedreports.",
      });
    });

    test("Impedindo a remoção do último conjunto de permissões protegidas", async () => {
      await orchestrator.clearDatabase();
      await orchestrator.runPendingMigrations();

      const { privilegedUser, sessionObject } = await createPrivilegedSession();
      const remainingFeatures = [
        ...protectedFeatures.slice(1),
        "read:activation_token",
        "read:session",
      ];

      const response = await fetch(adminUserUrl(privilegedUser.username), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({ features: remainingFeatures }),
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        name: "ConflictError",
        message:
          "Esta alteração não pode ser realizada porque deixaria o sistema sem um administrador com todas as permissões protegidas.",
        action:
          "Atribua todas as permissões protegidas a outro usuário antes de tentar novamente.",
        status_code: 409,
      });
    });
  });
});
