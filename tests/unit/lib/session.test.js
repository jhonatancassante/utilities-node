import { jest } from "@jest/globals";
import session from "@/lib/session.js";

describe("lib/session.js", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Recupera os dados da pessoa autenticada", async () => {
    const currentUser = { id: "user-id", username: "jhow" };
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(currentUser),
    });

    await expect(session.getCurrentUser()).resolves.toEqual(currentUser);
    expect(fetch).toHaveBeenCalledWith("/api/v1/user", {
      headers: { Accept: "application/json" },
    });
  });

  test("Retorna null quando não existe uma sessão autenticada", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue({ message: "Acesso negado." }),
    });

    await expect(session.getCurrentUser()).resolves.toBeNull();
  });

  test("Cria uma sessão enviando e-mail e senha", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: "session-id" }),
    });

    await session.login("jhow@example.com", "senha-segura");

    expect(fetch).toHaveBeenCalledWith("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify({
        email: "jhow@example.com",
        password: "senha-segura",
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  });

  test("Encerra a sessão atual", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });

    await session.logout();

    expect(fetch).toHaveBeenCalledWith("/api/v1/sessions", {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
  });
});
