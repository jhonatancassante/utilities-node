import orchestrator from "tests/orchestrator.js";
import feature from "@/models/feature.js";
import user from "@/models/user.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function createPrivilegedSession() {
  const protectedFeatures = (await feature.findAll())
    .filter((item) => item.is_protected)
    .map((item) => item.name);
  const privilegedUser = await orchestrator.createUser();
  await orchestrator.activateUser(privilegedUser);
  await orchestrator.addFeaturesToUser(privilegedUser, [
    ...protectedFeatures,
    "read:session",
  ]);
  const sessionObject = await orchestrator.createSession(privilegedUser);
  return { privilegedUser, sessionObject };
}

function featureUrl(id) {
  return `${orchestrator.API_URL}/admin/features/${id}`;
}

let nextFeatureNumber = 1;

async function createTestFeature(overrides = {}) {
  const featureNumber = nextFeatureNumber++;
  return await feature.create({
    name: `read:reports${featureNumber}`,
    label: "Consultar relatórios",
    group_name: "Relatórios",
    description: "Permite consultar relatórios.",
    ...overrides,
  });
}

describe("PATCH /api/v1/admin/features/[id]", () => {
  describe("Usuário anônimo", () => {
    test("Alterando uma feature", async () => {
      const createdFeature = await createTestFeature();

      const response = await fetch(featureUrl(createdFeature.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Ler relatórios" }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("Usuário padrão", () => {
    test("Alterando uma feature", async () => {
      const standardUser = await orchestrator.createUser();
      await orchestrator.activateUser(standardUser);
      const sessionObject = await orchestrator.createSession(standardUser);
      const createdFeature = await createTestFeature();

      const response = await fetch(featureUrl(createdFeature.id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({ label: "Ler relatórios" }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("Usuário privilegiado", () => {
    test("Alterando os dados de uma feature", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const createdFeature = await createTestFeature();

      const response = await fetch(featureUrl(createdFeature.id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({
          label: "Ler relatórios",
          is_privileged: true,
        }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        id: createdFeature.id,
        name: createdFeature.name,
        label: "Ler relatórios",
        is_privileged: true,
      });
    });

    test("Renomeando uma feature já atribuída a usuários", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const createdFeature = await createTestFeature();
      const targetUser = await orchestrator.createUser();
      await orchestrator.addFeaturesToUser(targetUser, [createdFeature.name]);

      const response = await fetch(featureUrl(createdFeature.id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({ name: "read:documents" }),
      });

      expect(response.status).toBe(200);
      expect((await response.json()).name).toBe("read:documents");

      const updatedUser = await user.findOneById(targetUser.id);
      expect(updatedUser.features).toContain("read:documents");
      expect(updatedUser.features).not.toContain(createdFeature.name);
    });

    test("Rejeitando alteração de uma feature protegida", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const protectedFeature = await feature.findOneByName("read:feature");

      const response = await fetch(featureUrl(protectedFeature.id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({ label: "Alteração indevida" }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        name: "ValidationError",
        message: "Esta feature está protegida e não pode ser alterada.",
      });
    });

    test("Com ID inexistente", async () => {
      const { sessionObject } = await createPrivilegedSession();

      const response = await fetch(
        featureUrl("99999999-9999-4999-8999-999999999999"),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObject.token}`,
          },
          body: JSON.stringify({ label: "Ler relatórios" }),
        },
      );

      expect(response.status).toBe(404);
    });
  });
});

describe("DELETE /api/v1/admin/features/[id]", () => {
  describe("Usuário anônimo", () => {
    test("Excluindo uma feature", async () => {
      const createdFeature = await createTestFeature();

      const response = await fetch(featureUrl(createdFeature.id), {
        method: "DELETE",
      });

      expect(response.status).toBe(403);
    });
  });

  describe("Usuário padrão", () => {
    test("Excluindo uma feature", async () => {
      const standardUser = await orchestrator.createUser();
      await orchestrator.activateUser(standardUser);
      const sessionObject = await orchestrator.createSession(standardUser);
      const createdFeature = await createTestFeature();

      const response = await fetch(featureUrl(createdFeature.id), {
        method: "DELETE",
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });

      expect(response.status).toBe(403);
    });
  });

  describe("Usuário privilegiado", () => {
    test("Excluindo logicamente uma feature e removendo-a dos usuários", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const createdFeature = await createTestFeature();
      const targetUser = await orchestrator.createUser();
      await orchestrator.addFeaturesToUser(targetUser, [createdFeature.name]);

      const response = await fetch(featureUrl(createdFeature.id), {
        method: "DELETE",
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        id: createdFeature.id,
        name: createdFeature.name,
      });

      await expect(feature.findOneById(createdFeature.id)).rejects.toThrow(
        "A feature com o ID informado não foi encontrada.",
      );
      const updatedUser = await user.findOneById(targetUser.id);
      expect(updatedUser.features).not.toContain(createdFeature.name);
    });

    test("Rejeitando exclusão de uma feature protegida", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const protectedFeature = await feature.findOneByName("read:feature");

      const response = await fetch(featureUrl(protectedFeature.id), {
        method: "DELETE",
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        name: "ValidationError",
        message: "Esta feature está protegida e não pode ser excluída.",
      });
    });

    test("Rejeitando exclusão de feature não removível atribuída a usuários", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const createdFeature = await createTestFeature({
        name: "read:lockedreports",
        is_removable: false,
      });
      const targetUser = await orchestrator.createUser();
      await orchestrator.addFeaturesToUser(targetUser, [createdFeature.name]);

      const response = await fetch(featureUrl(createdFeature.id), {
        method: "DELETE",
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        name: "ValidationError",
        message:
          "Esta feature não pode ser excluída enquanto estiver atribuída a usuários.",
      });
    });

    test("Com ID inexistente", async () => {
      const { sessionObject } = await createPrivilegedSession();

      const response = await fetch(
        featureUrl("99999999-9999-4999-8999-999999999999"),
        {
          method: "DELETE",
          headers: { Cookie: `session_id=${sessionObject.token}` },
        },
      );

      expect(response.status).toBe(404);
    });
  });
});
