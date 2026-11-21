import { jest } from "@jest/globals";

import database from "@/infra/database.js";
import { UnauthorizedError } from "@/infra/errors.js";
import session from "@/models/session.js";

function mockQuery(rows) {
  return jest
    .spyOn(database, "query")
    .mockResolvedValue({ rows, rowCount: rows.length });
}

function mockTransaction(query) {
  jest
    .spyOn(database, "transaction")
    .mockImplementation(async (callback) => callback({ query }));
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("models/session.js", () => {
  describe(".create()", () => {
    test("Gera token hexadecimal de 96 caracteres e expira em 30 dias", async () => {
      jest.useFakeTimers({ now: new Date("2026-01-01T00:00:00.000Z") });
      const querySpy = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ banned_at: null }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: "s1" }], rowCount: 1 });
      mockTransaction(querySpy);

      await session.create("user-1");

      const [query] = querySpy.mock.calls.slice(1)[0];
      const [token, userId, expiresAt] = query.values;
      expect(token).toMatch(/^[0-9a-f]{96}$/);
      expect(userId).toBe("user-1");
      expect(expiresAt).toEqual(new Date("2026-01-31T00:00:00.000Z"));
    });

    test("Rejeita a criação de sessão para usuário banido", async () => {
      const querySpy = jest.fn().mockResolvedValue({
        rows: [{ banned_at: new Date() }],
        rowCount: 1,
      });
      mockTransaction(querySpy);

      await expect(session.create("user-1")).rejects.toThrow(
        "Não foi possível autenticar seu usuário no sistema.",
      );

      expect(querySpy).toHaveBeenCalledTimes(1);
    });

    test("Gera tokens diferentes a cada chamada", async () => {
      const querySpy = jest
        .fn()
        .mockResolvedValue({ rows: [{ banned_at: null }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ banned_at: null }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: "s1" }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ banned_at: null }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: "s2" }], rowCount: 1 });
      mockTransaction(querySpy);

      await session.create("user-1");
      await session.create("user-1");

      const [first, second] = querySpy.mock.calls
        .filter(([q]) => q.text.includes("INSERT INTO"))
        .map(([q]) => q.values[0]);
      expect(first).not.toBe(second);
    });
  });

  describe(".findOneValidByToken()", () => {
    test("Só considera sessões não expiradas", async () => {
      const querySpy = mockQuery([{ id: "s1" }]);

      const found = await session.findOneValidByToken("token");

      expect(found).toEqual({ id: "s1" });
      const [query] = querySpy.mock.calls[0];
      expect(query.text).toContain("sessions.expires_at > NOW()");
      expect(query.text).toContain("users.banned_at IS NULL");
      expect(query.text).toContain("INNER JOIN");
      expect(query.values).toEqual(["token"]);
    });

    test("Sem resultado lança UnauthorizedError", async () => {
      mockQuery([]);

      const error = await session.findOneValidByToken("token").catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.message).toBe("Usuário não possui sessão ativa.");
    });
  });

  describe(".renew()", () => {
    test("Estende a expiração em 30 dias", async () => {
      jest.useFakeTimers({ now: new Date("2026-03-01T12:00:00.000Z") });
      const querySpy = mockQuery([{ id: "s1" }]);

      await session.renew("s1");

      const [query] = querySpy.mock.calls[0];
      expect(query.values).toEqual([
        "s1",
        new Date("2026-03-31T12:00:00.000Z"),
      ]);
    });
  });

  describe(".expireById()", () => {
    test("Empurra a expiração para o passado", async () => {
      const querySpy = mockQuery([{ id: "s1" }]);

      await session.expireById("s1");

      const [query] = querySpy.mock.calls[0];
      expect(query.text).toContain("expires_at - interval '1 year'");
      expect(query.values).toEqual(["s1"]);
    });
  });
});
