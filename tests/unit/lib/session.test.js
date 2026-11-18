import { jest } from "@jest/globals";
import requestAPI from "@/lib/api.js";
import session from "@/lib/session.js";

jest.mock("@/lib/api.js", () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe("lib/session.js", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Recupera os dados da pessoa autenticada", async () => {
    const currentUser = { id: "user-id", username: "jhow" };
    requestAPI.mockResolvedValue(currentUser);

    await expect(session.getCurrentUser()).resolves.toEqual(currentUser);
    expect(requestAPI).toHaveBeenCalledWith("/api/v1/user");
  });

  test("Retorna null quando não existe uma sessão autenticada", async () => {
    requestAPI.mockRejectedValue({ statusCode: 403 });

    await expect(session.getCurrentUser()).resolves.toBeNull();
  });

  test("Cria uma sessão enviando e-mail e senha", async () => {
    requestAPI.mockResolvedValue({ id: "session-id" });

    await session.login("jhow@example.com", "senha-segura");

    expect(requestAPI).toHaveBeenCalledWith("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify({
        email: "jhow@example.com",
        password: "senha-segura",
      }),
    });
  });

  test("Encerra a sessão atual", async () => {
    requestAPI.mockResolvedValue({});

    await session.logout();

    expect(requestAPI).toHaveBeenCalledWith("/api/v1/sessions", {
      method: "DELETE",
    });
  });
});
