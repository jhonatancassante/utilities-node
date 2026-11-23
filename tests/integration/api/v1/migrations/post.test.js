import database from "@/infra/database.js";
import orchestrator from "tests/orchestrator.js";

const MIGRATION_LOCK_KEY = 73190421;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/migrations", () => {
  describe("Usuário anônimo", () => {
    test("Rodar as migrações pendentes", async () => {
      const response = await fetch(`${orchestrator.API_URL}/migrations`, {
        method: "POST",
      });
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action:
          'Verifique se o seu usuário possui a feature "create:migration".',
        status_code: 403,
      });
    });
  });

  describe("Usuário padrão", () => {
    test("Rodar as migrações pendentes", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const createdUserSessionObject =
        await orchestrator.createSession(createdUser);

      const response = await fetch(`${orchestrator.API_URL}/migrations`, {
        method: "POST",
        headers: {
          Cookie: `session_id=${createdUserSessionObject.token}`,
        },
      });
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action:
          'Verifique se o seu usuário possui a feature "create:migration".',
        status_code: 403,
      });
    });
  });

  describe("Usuário privilegiado", () => {
    test("Rodar as migrações pendentes", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const sessionObject = await orchestrator.createSession(createdUser);
      await orchestrator.addFeaturesToUser(createdUser, ["create:migration"]);

      const response = await fetch(`${orchestrator.API_URL}/migrations`, {
        method: "POST",
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(Array.isArray(responseBody)).toBe(true);
    });

    test("Impede duas execuções simultâneas", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const sessionObject = await orchestrator.createSession(createdUser);
      await orchestrator.addFeaturesToUser(createdUser, ["create:migration"]);
      const dbClient = await database.getNewClient();

      try {
        const lockResult = await dbClient.query({
          text: "SELECT pg_try_advisory_lock($1) AS locked;",
          values: [MIGRATION_LOCK_KEY],
        });

        expect(lockResult.rows[0].locked).toBe(true);

        const response = await fetch(`${orchestrator.API_URL}/migrations`, {
          method: "POST",
          headers: {
            Cookie: `session_id=${sessionObject.token}`,
          },
        });

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({
          name: "ConflictError",
          message: "Já existe uma execução de migrations em andamento.",
          action:
            "Aguarde a conclusão da execução atual e atualize a verificação.",
          status_code: 409,
        });
      } finally {
        await dbClient.query({
          text: "SELECT pg_advisory_unlock($1);",
          values: [MIGRATION_LOCK_KEY],
        });
        await dbClient.end();
      }
    });
  });
});
