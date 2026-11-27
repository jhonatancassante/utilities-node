import orchestrator from "tests/orchestrator.js";
import user from "@/models/user.js";
import feature from "@/models/feature.js";
import position from "@/models/position.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

function adminUserUrl(username) {
  return `${orchestrator.API_URL}/admin/users/${username}`;
}

async function createGeneralEditorSession() {
  const generalEditor = await orchestrator.createUser();
  await orchestrator.activateUser(generalEditor);
  await orchestrator.addFeaturesToUser(generalEditor, [
    "update:user:others",
    "read:user:others",
  ]);
  const sessionObject = await orchestrator.createSession(generalEditor);
  return { generalEditor, sessionObject };
}

async function createFeatureManagerSession() {
  const featureManager = await orchestrator.createUser();
  await orchestrator.activateUser(featureManager);
  await orchestrator.addFeaturesToUser(featureManager, [
    "update:user:features",
    "read:user:others",
  ]);
  const sessionObject = await orchestrator.createSession(featureManager);
  return { featureManager, sessionObject };
}

async function createPrivilegedSession() {
  const protectedFeatures = (await feature.findAll())
    .filter((item) => item.is_protected)
    .map((item) => item.name);
  const privilegedUser = await orchestrator.createUser();
  await orchestrator.activateUser(privilegedUser);
  await orchestrator.addFeaturesToUser(privilegedUser, [
    ...protectedFeatures,
    "read:session",
    "update:user:features",
  ]);
  const sessionObject = await orchestrator.createSession(privilegedUser);
  return { privilegedUser, sessionObject, protectedFeatures };
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

  describe("Permissões específicas", () => {
    test("update:user:others permite atribuir cargo cadastrado e rejeita cargo excluído", async () => {
      const { sessionObject } = await createGeneralEditorSession();
      const targetUser = await orchestrator.createUser();
      const job = await position.create({ name: "Analista Administrativo" });
      const headers = {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      };
      const response = await fetch(adminUserUrl(targetUser.username), {
        method: "PATCH",
        headers,
        body: JSON.stringify({ position: job.name }),
      });
      expect(response.status).toBe(200);
      expect((await response.json()).position).toBe(job.name);
      expect((await user.findOneById(targetUser.id)).position).toBe(job.name);

      const deleted = await position.create({ name: "Cargo desativado" });
      await position.delete(deleted.id);
      const invalidResponse = await fetch(adminUserUrl(targetUser.username), {
        method: "PATCH",
        headers,
        body: JSON.stringify({ position: deleted.name }),
      });
      expect(invalidResponse.status).toBe(400);
      expect(await invalidResponse.json()).toMatchObject({
        name: "ValidationError",
        message: "O cargo informado não existe ou está inativo.",
      });
      expect((await user.findOneById(targetUser.id)).position).toBe(job.name);
    });

    test("update:user:others permite alterar dados gerais, mas não features", async () => {
      const { sessionObject } = await createGeneralEditorSession();
      const targetUser = await orchestrator.createUser();
      const headers = {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      };

      const dataResponse = await fetch(adminUserUrl(targetUser.username), {
        method: "PATCH",
        headers,
        body: JSON.stringify({ username: "generalEditorUpdated" }),
      });
      expect(dataResponse.status).toBe(200);

      const featuresResponse = await fetch(
        adminUserUrl("generalEditorUpdated"),
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ features: ["read:activation_token"] }),
        },
      );
      expect(featuresResponse.status).toBe(403);
      expect((await user.findOneById(targetUser.id)).features).toEqual(
        targetUser.features,
      );
    });

    test("update:user:features permite alterar features sem update:user:others", async () => {
      const { sessionObject } = await createFeatureManagerSession();
      const targetUser = await orchestrator.createUser();

      const response = await fetch(adminUserUrl(targetUser.username), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({ features: ["read:activation_token"] }),
      });

      expect(response.status).toBe(200);
      expect((await response.json()).features).toEqual([
        "read:activation_token",
      ]);
      expect((await user.findOneById(targetUser.id)).features).toEqual([
        "read:activation_token",
      ]);
    });

    test("Permite alterar features de usuário cujo e-mail contém sublinhado", async () => {
      const { sessionObject } = await createFeatureManagerSession();
      const targetUser = await orchestrator.createUser({
        email: "usuario_teste@exemplo.com",
      });

      const response = await fetch(adminUserUrl(targetUser.username), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({ features: ["read:activation_token"] }),
      });

      expect(response.status).toBe(200);
      expect((await response.json()).features).toEqual([
        "read:activation_token",
      ]);
      expect((await user.findOneById(targetUser.id)).features).toEqual([
        "read:activation_token",
      ]);
    });

    test("Exige as duas features quando altera dados gerais e features juntos", async () => {
      const { sessionObject } = await createFeatureManagerSession();
      const targetUser = await orchestrator.createUser();

      const response = await fetch(adminUserUrl(targetUser.username), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({
          username: "featureManagerMustNotRename",
          features: ["read:activation_token"],
        }),
      });

      expect(response.status).toBe(403);
      expect((await user.findOneById(targetUser.id)).username).toBe(
        targetUser.username,
      );
      expect((await user.findOneById(targetUser.id)).features).toEqual(
        targetUser.features,
      );
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
          name: "Nome Atualizado",
          username: "adminUpdatedUsername",
          email: "admin-updated@example.com",
          password: "Senha-Atualizada-Segura-123!!",
          features: ["update:user:others", "read:status:all"],
        }),
      });
      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody.username).toBe("adminUpdatedUsername");
      expect(responseBody.name).toBe("Nome Atualizado");
      expect(responseBody.email).toBe("admin-updated@example.com");
      expect(responseBody.features).toEqual([
        "update:user:others",
        "read:status:all",
      ]);
      expect(responseBody).not.toHaveProperty("password");

      const updatedUser = await user.findOneById(targetUser.id);
      expect(updatedUser.username).toBe("adminUpdatedUsername");
      expect(updatedUser.name).toBe("Nome Atualizado");
      expect(updatedUser.email).toBe("admin-updated@example.com");
    });

    test("Alterando as próprias permissões", async () => {
      const { privilegedUser, sessionObject, protectedFeatures } =
        await createPrivilegedSession();

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

    test("Permite retirar de outro usuário uma feature não removível por ele mesmo", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const targetUser = await orchestrator.createUser();
      const nonSelfRemovableFeature = await feature.create({
        name: "read:nonselfremovable",
        label: "Consultar recurso protegido",
        group_name: "Testes",
        description: "Feature que não pode ser removida pelo próprio titular.",
        is_self_removable: false,
      });
      await orchestrator.addFeaturesToUser(targetUser, [
        nonSelfRemovableFeature.name,
      ]);

      const response = await fetch(adminUserUrl(targetUser.username), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({ features: ["read:activation_token"] }),
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody.features).toEqual(["read:activation_token"]);

      const updatedUser = await user.findOneById(targetUser.id);
      expect(updatedUser.features).not.toContain(nonSelfRemovableFeature.name);
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
        is_privileged: true,
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
      const responseBody = await response.json();
      expect(responseBody.features).toEqual([
        "read:activation_token",
        "read:dynamicreports",
      ]);
      expect(responseBody.privileged_features).toContain(dynamicFeature.name);

      const updatedUser = await user.findOneById(targetUser.id);
      expect(updatedUser.features).toContain(dynamicFeature.name);
      expect(updatedUser.privileged_features).toContain(dynamicFeature.name);
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

      const dynamicProtectedFeature = await feature.create({
        name: "read:protectedreports",
        label: "Consultar relatórios protegidos",
        group_name: "Relatórios",
        description: "Feature protegida criada dinamicamente para o teste.",
        is_protected: true,
      });
      const { privilegedUser, sessionObject } = await createPrivilegedSession();
      const currentPrivilegedUser = await user.findOneById(privilegedUser.id);
      const remainingFeatures = currentPrivilegedUser.features.filter(
        (name) => name !== dynamicProtectedFeature.name,
      );

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
