import { jest } from "@jest/globals";

import database from "@/infra/database.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/infra/errors.js";
import session from "@/models/session.js";
import user from "@/models/user.js";

const existingUser = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "UsuarioAtual",
  email: "atual@example.com",
  password: "hash-atual",
  features: ["create:session", "read:session", "update:user"],
};

function mockQueries(handlers) {
  const queryMock = jest
    .spyOn(database, "query")
    .mockImplementation(async (query) => {
      const text = typeof query === "string" ? query : query.text;

      for (const [pattern, result] of handlers) {
        if (text.includes(pattern)) {
          const rows = typeof result === "function" ? result(query) : result;
          return { rows, rowCount: rows.length };
        }
      }

      throw new Error(`Consulta inesperada: ${text}`);
    });

  jest
    .spyOn(database, "transaction")
    .mockImplementation(async (callback) => callback({ query: queryMock }));

  return queryMock;
}

const existingFeatureMetadata = [
  { name: "create:session", is_self_removable: false, deleted_at: null },
  { name: "read:session", is_self_removable: false, deleted_at: null },
  { name: "update:user", is_self_removable: false, deleted_at: null },
  { name: "update:user:others", is_self_removable: true, deleted_at: null },
  { name: "read:status:all", is_self_removable: true, deleted_at: null },
];

function getCallsContaining(querySpy, pattern) {
  return querySpy.mock.calls
    .map(([query]) => query)
    .filter((query) => query.text.includes(pattern));
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("models/user.js", () => {
  describe(".update()", () => {
    test("Usa o id do usuário encontrado no WHERE", async () => {
      const querySpy = mockQueries([
        ["LOWER(users.username) = LOWER($1)\n        LIMIT 1", [existingUser]],
        ["UPDATE", (query) => [{ ...existingUser, username: query.values[1] }]],
      ]);

      await user.update("UsuarioAtual", { username: "UsuarioAtual" });

      const [updateQuery] = getCallsContaining(querySpy, "UPDATE");
      expect(updateQuery.values[0]).toBe(existingUser.id);
    });

    test("Só altera os campos enviados e mantém os demais", async () => {
      const querySpy = mockQueries([
        ["SELECT", [existingUser]],
        ["UPDATE", [existingUser]],
      ]);

      await user.update("UsuarioAtual", { email: "atual@example.com" });

      const [updateQuery] = getCallsContaining(querySpy, "UPDATE");
      expect(updateQuery.values).toEqual([
        existingUser.id,
        existingUser.username,
        "atual@example.com",
        existingUser.password,
      ]);
      expect(updateQuery.text).not.toContain("features");
    });

    test("Rejeita `id` no body e não executa nenhum UPDATE", async () => {
      const querySpy = mockQueries([
        ["SELECT", [existingUser]],
        ["UPDATE", [existingUser]],
      ]);

      const error = await user
        .update("UsuarioAtual", {
          id: "99999999-9999-4999-8999-999999999999",
          username: "UsuarioAtual",
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe(
        "Os campos a seguir não podem ser alterados: id.",
      );
      expect(error.action).toBe("Envie apenas username, email e password.");
      expect(getCallsContaining(querySpy, "UPDATE")).toEqual([]);
    });

    test("Rejeita campos não permitidos e lista todos eles", async () => {
      const querySpy = mockQueries([
        ["SELECT", [existingUser]],
        ["UPDATE", [existingUser]],
      ]);

      const error = await user
        .update("UsuarioAtual", {
          features: ["update:user:others"],
          created_at: "2000-01-01",
          email: "atual@example.com",
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe(
        "Os campos a seguir não podem ser alterados: features, created_at.",
      );
      expect(getCallsContaining(querySpy, "UPDATE")).toEqual([]);
    });

    test("Não altera o objeto recebido", async () => {
      mockQueries([
        ["SELECT", [existingUser]],
        ["UPDATE", [existingUser]],
      ]);

      const input = { email: "  atual@example.com  " };
      await user.update("UsuarioAtual", input);

      expect(input).toEqual({ email: "  atual@example.com  " });
    });

    test.each([undefined, null, "texto", 42, ["username"]])(
      "Com body que não é objeto (%p), rejeita e não executa nenhum UPDATE",
      async (body) => {
        const querySpy = mockQueries([
          ["SELECT", [existingUser]],
          ["UPDATE", [existingUser]],
        ]);

        const error = await user.update("UsuarioAtual", body).catch((e) => e);

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe(
          "O corpo da requisição deve ser um objeto JSON.",
        );
        expect(getCallsContaining(querySpy, "UPDATE")).toEqual([]);
      },
    );

    test("Com objeto vazio, mantém todos os campos", async () => {
      const querySpy = mockQueries([
        ["SELECT", [existingUser]],
        ["UPDATE", [existingUser]],
      ]);

      await user.update("UsuarioAtual", {});

      const [updateQuery] = getCallsContaining(querySpy, "UPDATE");
      expect(updateQuery.values).toEqual([
        existingUser.id,
        existingUser.username,
        existingUser.email,
        existingUser.password,
      ]);
    });

    test("Com permissão administrativa, atualiza as features", async () => {
      const querySpy = mockQueries([
        [
          "name,\n          is_self_removable,\n          deleted_at\n        FROM\n          features",
          existingFeatureMetadata,
        ],
        ["SELECT", [existingUser]],
        ["UPDATE", [existingUser]],
      ]);
      const features = [
        "create:session",
        "read:session",
        "update:user",
        "update:user:others",
        "read:status:all",
      ];

      await user.update("UsuarioAtual", { features }, { allowFeatures: true });

      const [updateQuery] = getCallsContaining(querySpy, "UPDATE users SET");
      expect(updateQuery.text).toContain("features = $5");
      expect(updateQuery.values).toEqual([
        existingUser.id,
        existingUser.username,
        existingUser.email,
        existingUser.password,
        features,
      ]);
    });

    test("Permite que um administrador retire feature não removível de outro usuário", async () => {
      const querySpy = mockQueries([
        [
          "name,\n          is_self_removable,\n          deleted_at\n        FROM\n          features",
          existingFeatureMetadata,
        ],
        ["SELECT", [existingUser]],
        ["UPDATE", [existingUser]],
      ]);

      const features = ["create:session", "update:user"];

      await user.update(
        "UsuarioAtual",
        { features },
        { allowFeatures: true, actorUserId: "admin-user-id" },
      );

      expect(
        getCallsContaining(
          querySpy,
          "SELECT name, is_self_removable FROM features",
        ),
      ).toEqual([]);
      expect(getCallsContaining(querySpy, "UPDATE users SET")).toHaveLength(1);
    });

    test("Rejeita a alteração de uma feature não editável", async () => {
      const querySpy = mockQueries([
        [
          "name,\n          is_self_removable,\n          deleted_at\n        FROM\n          features",
          existingFeatureMetadata,
        ],
        [
          "SELECT name, is_self_removable FROM features",
          [{ name: "read:session", is_self_removable: false }],
        ],
        ["SELECT", [existingUser]],
        ["UPDATE", [existingUser]],
      ]);

      const error = await user
        .update(
          "UsuarioAtual",
          { features: ["create:session", "update:user"] },
          { allowFeatures: true, actorUserId: existingUser.id },
        )
        .catch((e) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe(
        "As seguintes features não podem ser removidas deste usuário: read:session.",
      );
      expect(getCallsContaining(querySpy, "UPDATE users SET")).toEqual([]);
    });

    test("Com nome de usuário inválido", async () => {
      mockQueries([["SELECT", [existingUser]]]);

      await expect(
        user.update("UsuarioAtual", { username: "a" }),
      ).rejects.toThrow(ValidationError);
    });

    test("Com email inválido", async () => {
      mockQueries([["SELECT", [existingUser]]]);

      await expect(
        user.update("UsuarioAtual", { email: "email-invalido" }),
      ).rejects.toThrow(ValidationError);
    });

    test("Com senha inválida", async () => {
      mockQueries([["SELECT", [existingUser]]]);

      await expect(
        user.update("UsuarioAtual", { password: "curta" }),
      ).rejects.toThrow(ValidationError);
    });

    test("Com nome de usuário já utilizado por outro usuário", async () => {
      mockQueries([
        ["LOWER(users.username) = LOWER($1)", [existingUser]],
        ["SELECT\n          username", [{ username: "Outro" }]],
      ]);

      await expect(
        user.update("UsuarioAtual", { username: "Outro" }),
      ).rejects.toThrow("O nome de usuário informado já está sendo utilizado.");
    });

    test("Trocar a caixa do username não conta como duplicado", async () => {
      const querySpy = mockQueries([
        ["LOWER(users.username) = LOWER($1)", [existingUser]],
        ["UPDATE", [existingUser]],
      ]);

      await user.update("UsuarioAtual", { username: "usuarioatual" });

      expect(
        getCallsContaining(querySpy, "SELECT\n          username"),
      ).toEqual([]);
    });

    test("Grava a senha com hash, nunca em texto puro", async () => {
      const querySpy = mockQueries([
        ["SELECT", [existingUser]],
        ["UPDATE", [existingUser]],
      ]);

      await user.update("UsuarioAtual", { password: "Nova-Senha-Segura-123!" });

      const [updateQuery] = getCallsContaining(querySpy, "UPDATE");
      expect(updateQuery.values[3]).not.toBe("Nova-Senha-Segura-123!");
      expect(updateQuery.values[3]).toMatch(/^\$2[aby]\$/);
    });

    test("Com username inexistente", async () => {
      mockQueries([["SELECT", []]]);

      await expect(user.update("NaoExiste", {})).rejects.toThrow(NotFoundError);
    });
  });

  describe(".search()", () => {
    test("Pesquisa por nome de usuário ou e-mail", async () => {
      const querySpy = mockQueries([["SELECT", [existingUser]]]);

      const results = await user.search("usuario");

      expect(results).toEqual([existingUser]);
      const [searchQuery] = querySpy.mock.calls.map(([query]) => query);
      expect(searchQuery.values).toEqual(["%usuario%"]);
      expect(searchQuery.text).toContain("username ILIKE $1");
      expect(searchQuery.text).toContain("email ILIKE $1");
      expect(searchQuery.text).toContain("LIMIT 10");
    });

    test("Com termo de pesquisa menor que dois caracteres", async () => {
      await expect(user.search("a")).rejects.toThrow(ValidationError);
    });
  });

  describe(".create()", () => {
    test("Define a feature inicial e guarda hash da senha", async () => {
      const querySpy = mockQueries([
        ["SELECT", []],
        ["INSERT", [existingUser]],
      ]);

      await user.create({
        username: "  NovoUsuario ",
        email: " novo@example.com ",
        password: ["Senha", "Segura", "Valida", "123"].join("-"),
      });

      const [insertQuery] = getCallsContaining(querySpy, "INSERT");
      expect(insertQuery.values[0]).toBe("NovoUsuario");
      expect(insertQuery.values[1]).toBe("novo@example.com");
      expect(insertQuery.values[2]).toMatch(/^\$2[aby]\$/);
      expect(insertQuery.values[3]).toEqual(["read:activation_token"]);
    });

    test("Com email já utilizado", async () => {
      mockQueries([
        ["SELECT\n          username", []],
        ["SELECT\n          email", [{ email: "novo@example.com" }]],
      ]);

      await expect(
        user.create({
          username: "NovoUsuario",
          email: "novo@example.com",
          password: ["Senha", "Segura", "Valida", "123"].join("-"),
        }),
      ).rejects.toThrow("O email informado já está sendo utilizado.");
    });
  });

  describe(".findOneById(), .findOneByUsername() e .findOneByEmail()", () => {
    test.each([
      [
        "findOneById",
        "O id de usuário informado não foi encontrado no sistema.",
      ],
      [
        "findOneByUsername",
        "O nome de usuário informado não foi encontrado no sistema.",
      ],
      ["findOneByEmail", "O email informado não foi encontrado no sistema."],
    ])(".%s() sem resultado lança NotFoundError", async (method, message) => {
      mockQueries([["SELECT", []]]);

      const error = await user[method]("qualquer").catch((e) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe(message);
    });
  });

  describe(".setFeatures()", () => {
    test("Substitui as features do usuário informado", async () => {
      const querySpy = mockQueries([["UPDATE", [existingUser]]]);

      await user.setFeatures(existingUser.id, ["read:session"]);

      const [updateQuery] = getCallsContaining(querySpy, "UPDATE");
      expect(updateQuery.text).toContain("features = $2");
      expect(updateQuery.values).toEqual([existingUser.id, ["read:session"]]);
    });
  });

  describe(".addFeatures()", () => {
    test("Concatena as features do usuário informado", async () => {
      const querySpy = mockQueries([["UPDATE", [existingUser]]]);

      await user.addFeatures(existingUser.id, ["read:migration"]);

      const [updateQuery] = getCallsContaining(querySpy, "UPDATE");
      expect(updateQuery.text).toContain("array_cat(features, $2)");
      expect(updateQuery.values).toEqual([existingUser.id, ["read:migration"]]);
    });
  });

  describe(".setBanStatus()", () => {
    test("Rejeita um status que não seja booleano", async () => {
      const querySpy = mockQueries([]);

      await expect(user.setBanStatus("UsuarioAtual", "banido")).rejects.toThrow(
        ValidationError,
      );

      expect(querySpy).not.toHaveBeenCalled();
      expect(database.transaction).not.toHaveBeenCalled();
    });

    test("Impede que o usuário bana a própria conta", async () => {
      mockQueries([
        ["LOWER(users.username) = LOWER($1)", [existingUser]],
      ]);

      await expect(
        user.setBanStatus("UsuarioAtual", true, existingUser.id),
      ).rejects.toThrow(ForbiddenError);

      expect(database.transaction).not.toHaveBeenCalled();
    });

    test("Não registra evento quando o status já está aplicado", async () => {
      const alreadyBannedUser = {
        ...existingUser,
        banned_at: new Date("2026-01-01T00:00:00.000Z"),
      };
      const querySpy = mockQueries([
        ["LOWER(users.username) = LOWER($1)", [alreadyBannedUser]],
        ["SELECT * FROM users WHERE id = $1 FOR UPDATE;", [alreadyBannedUser]],
      ]);

      const result = await user.setBanStatus("UsuarioAtual", true, "admin-1");

      expect(result).toEqual(alreadyBannedUser);
      expect(getCallsContaining(querySpy, "banned_at = CASE")).toEqual([]);
      expect(getCallsContaining(querySpy, "INSERT INTO user_ban_events")).toEqual(
        [],
      );
    });

    test("Registra o banimento e expira as sessões na mesma transação", async () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      const updatedAt = new Date("2026-02-01T00:00:00.000Z");
      const lockedUser = { ...existingUser, created_at: createdAt, banned_at: null };
      const bannedUser = { ...lockedUser, banned_at: updatedAt, updated_at: updatedAt };
      const actor = { username: "Administrador", email: "admin@example.com" };
      const querySpy = mockQueries([
        ["LOWER(users.username) = LOWER($1)", [lockedUser]],
        ["SELECT * FROM users WHERE id = $1 FOR UPDATE;", [lockedUser]],
        ["UPDATE\n          users", [bannedUser]],
        ["SELECT username, email FROM users WHERE id = $1;", [actor]],
        ["INSERT INTO user_ban_events", []],
      ]);
      const expireSessionsSpy = jest
        .spyOn(session, "expireAllByUserId")
        .mockResolvedValue([]);

      await user.setBanStatus("UsuarioAtual", true, "admin-1");

      const [insertQuery] = getCallsContaining(
        querySpy,
        "INSERT INTO user_ban_events",
      );
      expect(insertQuery.values).toEqual([
        existingUser.id,
        "admin-1",
        "ban",
        existingUser.username,
        existingUser.email,
        createdAt,
        actor.username,
        actor.email,
        updatedAt,
      ]);
      expect(expireSessionsSpy).toHaveBeenCalledWith(
        existingUser.id,
        expect.objectContaining({ query: expect.any(Function) }),
      );
    });

    test("Registra o desbanimento sem reativar sessões anteriores", async () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      const bannedAt = new Date("2026-01-15T00:00:00.000Z");
      const updatedAt = new Date("2026-02-01T00:00:00.000Z");
      const lockedUser = {
        ...existingUser,
        created_at: createdAt,
        banned_at: bannedAt,
      };
      const unbannedUser = { ...lockedUser, banned_at: null, updated_at: updatedAt };
      const actor = { username: "Administrador", email: "admin@example.com" };
      const querySpy = mockQueries([
        ["LOWER(users.username) = LOWER($1)", [lockedUser]],
        ["SELECT * FROM users WHERE id = $1 FOR UPDATE;", [lockedUser]],
        ["UPDATE\n          users", [unbannedUser]],
        ["SELECT username, email FROM users WHERE id = $1;", [actor]],
        ["INSERT INTO user_ban_events", []],
      ]);
      const expireSessionsSpy = jest.spyOn(session, "expireAllByUserId");

      await user.setBanStatus("UsuarioAtual", false, "admin-1");

      const [insertQuery] = getCallsContaining(
        querySpy,
        "INSERT INTO user_ban_events",
      );
      expect(insertQuery.values).toEqual([
        existingUser.id,
        "admin-1",
        "unban",
        existingUser.username,
        existingUser.email,
        createdAt,
        actor.username,
        actor.email,
        updatedAt,
      ]);
      expect(expireSessionsSpy).not.toHaveBeenCalled();
    });
  });

});
