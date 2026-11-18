import { jest } from "@jest/globals";
import requestAPI, { APIError } from "@/lib/client/api.js";

describe("lib/client/api.js", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("requestAPI()", () => {
    test("Realiza uma requisição e retorna a resposta JSON", async () => {
      const responseBody = { id: "user-id", username: "jhow" };
      jest.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(responseBody),
      });

      const response = await requestAPI("/api/v1/users");

      expect(response).toEqual(responseBody);
      expect(fetch).toHaveBeenCalledWith("/api/v1/users", {
        headers: { Accept: "application/json" },
      });
    });

    test("Define o cabeçalho JSON quando existe corpo na requisição", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await requestAPI("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({ username: "jhow" }),
      });

      expect(fetch).toHaveBeenCalledWith("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({ username: "jhow" }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
    });

    test("Lança APIError com os detalhes retornados pela API", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          name: "ValidationError",
          message: "O e-mail informado já está sendo utilizado.",
          action: "Utilize outro e-mail.",
        }),
      });

      await expect(requestAPI("/api/v1/users")).rejects.toMatchObject({
        name: "ValidationError",
        message: "O e-mail informado já está sendo utilizado.",
        action: "Utilize outro e-mail.",
        statusCode: 400,
      });
    });

    test("Usa uma mensagem padrão quando a resposta de erro não contém JSON", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 503,
        json: jest.fn().mockRejectedValue(new Error("Resposta inválida")),
      });

      const request = requestAPI("/api/v1/users");

      await expect(request).rejects.toBeInstanceOf(APIError);
      await expect(request).rejects.toMatchObject({
        name: "APIError",
        message: "Não foi possível concluir a solicitação.",
        statusCode: 503,
      });
    });
  });
});
