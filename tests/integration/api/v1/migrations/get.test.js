import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/migrations", () => {
  describe("Usuário anônimo", () => {
    test("Visualizando as migrações pendentes", async () => {
      const response = await fetch(`${orchestrator.API_URL}/migrations`);
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action: 'Verifique se o seu usuário possui a feature "read:migration".',
        status_code: 403,
      });
    });
  });

  describe("Usuário autenticado", () => {
    test("Visualizando as migrações pendentes", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const createdUserSessionObject =
        await orchestrator.createSession(createdUser);

      const response = await fetch(`${orchestrator.API_URL}/migrations`, {
        headers: {
          Cookie: `session_id=${createdUserSessionObject.token}`,
        },
      });
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action: 'Verifique se o seu usuário possui a feature "read:migration".',
        status_code: 403,
      });
    });
  });

  describe("Usuário privilegiado", () => {
    test("Visualizando as migrações pendentes", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const sessionObject = await orchestrator.createSession(createdUser);
      await orchestrator.addFeaturesToUser(createdUser, ["read:migration"]);

      const response = await fetch(`${orchestrator.API_URL}/migrations`, {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(Array.isArray(responseBody)).toBe(true);
    });
  });
});
