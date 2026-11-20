import orchestrator from "tests/orchestrator.js";
import feature from "@/models/feature.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

const endpoint = `${orchestrator.API_URL}/admin/users/features`;

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
  return sessionObject;
}

describe("GET /api/v1/admin/users/features", () => {
  describe("Usuário anônimo", () => {
    test("Consultando o catálogo de permissões", async () => {
      const response = await fetch(endpoint);

      expect(response.status).toBe(403);
    });
  });

  describe("Usuário padrão", () => {
    test("Consultando o catálogo de permissões", async () => {
      const standardUser = await orchestrator.createUser();
      await orchestrator.activateUser(standardUser);
      const sessionObject = await orchestrator.createSession(standardUser);

      const response = await fetch(endpoint, {
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });

      expect(response.status).toBe(403);
    });
  });

  describe("Usuário privilegiado", () => {
    test("Consultando features cadastradas dinamicamente", async () => {
      const sessionObject = await createPrivilegedSession();
      const dynamicFeature = await feature.create({
        name: "read:dynamicreports",
        label: "Consultar relatórios dinâmicos",
        group_name: "Relatórios",
        description: "Permite consultar relatórios criados dinamicamente.",
        is_privileged: true,
      });

      const response = await fetch(endpoint, {
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody).toContainEqual(
        expect.objectContaining({
          name: dynamicFeature.name,
          label: dynamicFeature.label,
          group_name: dynamicFeature.group_name,
          is_privileged: true,
        }),
      );
    });
  });
});
