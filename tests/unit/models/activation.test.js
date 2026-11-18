import { jest } from "@jest/globals";

import database from "@/infra/database.js";
import email from "@/infra/email.js";
import webserver from "@/infra/webserver.js";
import { ForbiddenError, NotFoundError } from "@/infra/errors.js";
import activation from "@/models/activation.js";
import user from "@/models/user.js";

function mockQuery(rows) {
  return jest
    .spyOn(database, "query")
    .mockResolvedValue({ rows, rowCount: rows.length });
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("models/activation.js", () => {
  test("create() cria token que expira em 15 minutos", async () => {
    jest.useFakeTimers({ now: new Date("2026-01-01T10:00:00.000Z") });
    const querySpy = mockQuery([{ id: "t1" }]);

    await activation.create("user-1");

    const [query] = querySpy.mock.calls[0];
    expect(query.values).toEqual([
      "user-1",
      new Date("2026-01-01T10:15:00.000Z"),
    ]);
  });

  test("findOneValidById() ignora tokens expirados ou já usados", async () => {
    const querySpy = mockQuery([{ id: "t1" }]);

    await activation.findOneValidById("t1");

    const [query] = querySpy.mock.calls[0];
    expect(query.text).toContain("expires_at > NOW()");
    expect(query.text).toContain("used_at IS NULL");
  });

  test("findOneValidById() sem resultado lança NotFoundError", async () => {
    mockQuery([]);

    await expect(activation.findOneValidById("t1")).rejects.toThrow(
      NotFoundError,
    );
  });

  test("markTokenAsUsed() só marca tokens válidos e ainda não usados", async () => {
    const querySpy = mockQuery([{ id: "t1" }]);

    await activation.markTokenAsUsed("t1");

    const [query] = querySpy.mock.calls[0];
    expect(query.text).toContain("used_at IS NULL");
    expect(query.text).toContain("expires_at > NOW()");
  });

  test("markTokenAsUsed() sem resultado lança NotFoundError", async () => {
    mockQuery([]);

    await expect(activation.markTokenAsUsed("t1")).rejects.toThrow(
      NotFoundError,
    );
  });

  test("sendEmailToUser() envia o link de ativação com o id do token", async () => {
    const sendSpy = jest.spyOn(email, "send").mockResolvedValue();

    await activation.sendEmailToUser(
      { username: "joao", email: "joao@example.com" },
      { id: "token-123" },
    );

    const [mail] = sendSpy.mock.calls[0];
    expect(mail.to).toBe("joao@example.com");
    expect(mail.text).toContain("Olá joao,");
    expect(mail.text).toContain(
      `${webserver.origin}/cadastro/ativar/token-123`,
    );
  });

  test("activateUserByUserId() libera as features de usuário ativo", async () => {
    jest.spyOn(user, "findOneById").mockResolvedValue({
      id: "user-1",
      features: ["read:activation_token"],
    });
    const setFeaturesSpy = jest
      .spyOn(user, "setFeatures")
      .mockResolvedValue({ id: "user-1" });

    await activation.activateUserByUserId("user-1");

    expect(setFeaturesSpy).toHaveBeenCalledWith("user-1", [
      "create:session",
      "read:session",
      "update:user",
    ]);
  });

  test("activateUserByUserId() com usuário já ativo lança ForbiddenError", async () => {
    jest.spyOn(user, "findOneById").mockResolvedValue({
      id: "user-1",
      features: ["create:session", "read:session", "update:user"],
    });
    const setFeaturesSpy = jest.spyOn(user, "setFeatures");

    await expect(activation.activateUserByUserId("user-1")).rejects.toThrow(
      ForbiddenError,
    );
    expect(setFeaturesSpy).not.toHaveBeenCalled();
  });
});
