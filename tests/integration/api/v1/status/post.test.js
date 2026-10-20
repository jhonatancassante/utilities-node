import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("POST /api/v1/status", () => {
  describe("Usuário anônimo", () => {
    test("Obtendo o status atual do sistema", async () => {
      const response = await fetch(`${orchestrator.API_URL}/status`, {
        method: "POST",
      });
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toEqual("GET");

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
