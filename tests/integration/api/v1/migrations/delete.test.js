import orchestrator from "tests/orchestrator.js";
import appPaths from "@/configs/app_paths.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
});

describe("DELETE /api/v1/migrations", () => {
  describe("Usuário anônimo", () => {
    test("Visualizando as migrações pendentes", async () => {
      const response = await fetch(`${appPaths.API_URL}/migrations`, {
        method: "DELETE",
      });
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toEqual("GET, POST");

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "MethodNotAllowedError",
        message: "Método não permitido para esse endpoint.",
        action: "Verifique se o método HTTP é válido para este endpoint.",
        status_code: 405,
      });
    });
  });
});
