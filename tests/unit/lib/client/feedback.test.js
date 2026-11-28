import { APIError } from "@/lib/client/api.js";
import { feedbackFromError } from "@/lib/client/feedback.js";

describe("lib/client/feedback.js", () => {
  test("Erro devolvido pela API mantém o nome para ser exibido em modal", () => {
    const error = new APIError({
      name: "ValidationError",
      message: "Dados inválidos.",
      action: "Revise os campos.",
      statusCode: 400,
    });

    expect(feedbackFromError(error)).toEqual({
      type: "error",
      name: "ValidationError",
      message: "Dados inválidos.",
      action: "Revise os campos.",
    });
  });

  test("Falha sem resposta da API vira aviso simples, sem nome", () => {
    const feedback = feedbackFromError(new TypeError("Failed to fetch"));

    expect(feedback.type).toBe("error");
    expect(feedback.name).toBeUndefined();
    expect(feedback.message).toBe("Failed to fetch");
  });
});
