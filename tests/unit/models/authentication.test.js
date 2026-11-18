import { jest } from "@jest/globals";

import { NotFoundError, UnauthorizedError } from "@/infra/errors.js";

describe("models/authentication.js", () => {
  let instance = 0;
  let authentication;
  let password;
  let user;
  let hashSpy;

  beforeEach(async () => {
    ({ default: password } = await import("@/models/password.js"));
    ({ default: user } = await import("@/models/user.js"));

    hashSpy = jest.spyOn(password, "hash");
    jest.spyOn(user, "findOneByEmail").mockRejectedValue(new NotFoundError({}));

    ({ default: authentication } = await import(
      `../../../models/authentication.js?instance=${++instance}`
    ));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Não gera o hash falso ao carregar o módulo", () => {
    expect(hashSpy).not.toHaveBeenCalled();
  });

  test("Com email inexistente, gera o hash falso uma única vez", async () => {
    await expect(
      authentication.getUser("naoexiste@example.com", "Senha_Qualquer_123"),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      authentication.getUser("outro@example.com", "Senha_Qualquer_123"),
    ).rejects.toThrow(UnauthorizedError);

    expect(hashSpy).toHaveBeenCalledTimes(1);
  });

  test("Com email inexistente, devolve a mensagem genérica de autenticação", async () => {
    const error = await authentication
      .getUser("naoexiste@example.com", "Senha_Qualquer_123")
      .catch((e) => e);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toBe(
      "Não foi possível autenticar seu usuário no sistema.",
    );
  });

  test("Se a geração do hash falso falhar, tenta de novo na chamada seguinte", async () => {
    hashSpy.mockRejectedValueOnce(new Error("falha"));

    await expect(
      authentication.getUser("a@example.com", "Senha_Qualquer_123"),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      authentication.getUser("b@example.com", "Senha_Qualquer_123"),
    ).rejects.toThrow(UnauthorizedError);

    expect(hashSpy).toHaveBeenCalledTimes(2);
  });
});
