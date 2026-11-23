import orchestrator from "tests/orchestrator.js";
import database from "@/infra/database.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

function auditUrl() {
  return orchestrator.API_URL + "/admin/audit/migrations";
}

async function createAuditorSession() {
  const auditor = await orchestrator.createUser();
  await orchestrator.activateUser(auditor);
  await orchestrator.addFeaturesToUser(auditor, ["read:audit"]);
  const sessionObject = await orchestrator.createSession(auditor);

  return sessionObject;
}

async function createStandardSession() {
  const standardUser = await orchestrator.createUser();
  await orchestrator.activateUser(standardUser);

  return orchestrator.createSession(standardUser);
}

describe("GET /api/v1/admin/audit/migrations", () => {
  describe("Usuário anônimo", () => {
    test("Consultando o histórico sem autenticação", async () => {
      const response = await fetch(auditUrl());

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
      });
    });
  });

  describe("Usuário padrão", () => {
    test("Consultando o histórico sem a feature read:audit", async () => {
      const sessionObject = await createStandardSession();

      const response = await fetch(auditUrl(), {
        headers: { Cookie: "session_id=" + sessionObject.token },
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
      });
    });
  });

  describe("Usuário com permissão de auditoria", () => {
    test("Consulta o histórico registrado em pgmigrations", async () => {
      const sessionObject = await createAuditorSession();
      const expectedMigrations = await database.query({
        text: "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on DESC, id DESC;",
      });

      const response = await fetch(auditUrl(), {
        headers: { Cookie: "session_id=" + sessionObject.token },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");

      const migrations = await response.json();

      expect(migrations).toEqual(
        expectedMigrations.rows.map((migration) => ({
          id: migration.id,
          name: migration.name,
          run_on: migration.run_on.toISOString(),
        })),
      );
      expect(migrations.length).toBeGreaterThan(0);
      expect(migrations[0]).not.toHaveProperty("password");
    });
  });
});
