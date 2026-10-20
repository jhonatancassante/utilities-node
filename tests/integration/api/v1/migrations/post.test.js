import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
});

describe("POST /api/v1/migrations", () => {
  describe("Usuário anônimo", () => {
    describe("Rodar as migrações pendentes", () => {
      test("Pela primeira vez", async () => {
        const response = await fetch(`${orchestrator.API_URL}/migrations`, {
          method: "POST",
        });
        expect(response.status).toBe(201);

        const responseBody = await response.json();

        expect(Array.isArray(responseBody)).toBe(true);
        expect(responseBody.length).toBeGreaterThan(0);
      });

      test("Pela segunda vez", async () => {
        const response = await fetch(`${orchestrator.API_URL}/migrations`, {
          method: "POST",
        });
        expect(response.status).toBe(200);

        const responseBody = await response.json();

        expect(Array.isArray(responseBody)).toBe(true);
        expect(responseBody.length).toBe(0);
      });
    });
  });
});
