import orchestrator from "tests/orchestrator.js";
import appPaths from "@/configs/app_paths.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
});

describe("GET /api/v1/migrations", () => {
  describe("Usuário anônimo", () => {
    test("Visualizando as migrações pendentes", async () => {
      const response = await fetch(`${appPaths.API_URL}/migrations`);
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(Array.isArray(responseBody)).toBe(true);
      expect(responseBody.length).toBeGreaterThan(0);
    });
  });
});
