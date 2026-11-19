import { jest } from "@jest/globals";
import activateAccount from "@/lib/client/activation.js";

describe("lib/client/activation.js", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("activateAccount()", () => {
    test("Ativa a conta utilizando o token recebido por parâmetro", async () => {
      const responseBody = { id: "activation-token-id" };
      jest.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(responseBody),
      });

      const response = await activateAccount("activation-token-id");

      expect(response).toEqual(responseBody);
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/activations/activation-token-id",
        {
          method: "PATCH",
          headers: { Accept: "application/json" },
        },
      );
    });

    test("Codifica o token antes de incluí-lo no caminho da API", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await activateAccount("token/com-caracteres");

      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/activations/token%2Fcom-caracteres",
        {
          method: "PATCH",
          headers: { Accept: "application/json" },
        },
      );
    });
  });
});
