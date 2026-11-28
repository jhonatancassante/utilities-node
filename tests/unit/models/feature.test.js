import { jest } from "@jest/globals";

import database from "@/infra/database.js";
import { NotFoundError, ValidationError } from "@/infra/errors.js";
import feature from "@/models/feature.js";

const existingFeature = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "read:reports",
  label: "Consultar relatórios",
  group_name: "Relatórios",
  description: "Permite consultar relatórios.",
  is_self_removable: true,
  is_privileged: false,
  is_protected: false,
  deleted_at: null,
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

function getCallsContaining(querySpy, pattern) {
  return querySpy.mock.calls
    .map(([query]) => query)
    .filter((query) => query.text.includes(pattern));
}

function createFeatureInput(overrides = {}) {
  return {
    name: "read:reports",
    label: "Consultar relatórios",
    group_name: "Relatórios",
    description: "Permite consultar relatórios.",
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("models/feature.js", () => {
  describe(".create()", () => {
    test("Cadastra uma feature com os valores padrão", async () => {
      const querySpy = mockQueries([
        ["SELECT", []],
        ["INSERT", [existingFeature]],
      ]);

      await feature.create(createFeatureInput());

      const [insertQuery] = getCallsContaining(querySpy, "INSERT");
      expect(insertQuery.values).toEqual([
        "read:reports",
        "Consultar relatórios",
        "Relatórios",
        "Permite consultar relatórios.",
        true,
        false,
        false,
      ]);
    });

    test("Normaliza textos e mantém flags informadas", async () => {
      const querySpy = mockQueries([
        ["SELECT", []],
        ["INSERT", [existingFeature]],
      ]);

      await feature.create(
        createFeatureInput({
          name: " read:reports ",
          label: " Consultar relatórios ",
          group_name: " Relatórios ",
          description: " Permite consultar relatórios. ",
          is_self_removable: false,
          is_privileged: true,
          is_protected: true,
        }),
      );

      const [insertQuery] = getCallsContaining(querySpy, "INSERT");
      expect(insertQuery.values).toEqual([
        "read:reports",
        "Consultar relatórios",
        "Relatórios",
        "Permite consultar relatórios.",
        false,
        true,
        true,
      ]);
    });

    test("Com nome já cadastrado", async () => {
      mockQueries([["SELECT", [{ id: existingFeature.id }]]]);

      await expect(feature.create(createFeatureInput())).rejects.toThrow(
        "Já existe uma feature cadastrada com este nome.",
      );
    });

    test.each([undefined, null, "texto", 42, []])(
      "Com dados que não são um objeto (%p)",
      async (input) => {
        await expect(feature.create(input)).rejects.toThrow(ValidationError);
      },
    );

    test.each(["name", "label", "group_name", "description"])(
      "Sem o campo obrigatório %s",
      async (field) => {
        const input = createFeatureInput();
        delete input[field];

        await expect(feature.create(input)).rejects.toThrow(ValidationError);
      },
    );

    test.each([
      ["name", ""],
      ["name", "Read:reports"],
      ["name", "read::reports"],
      ["name", "read:reports:"],
      ["label", " "],
      ["group_name", " "],
      ["description", " "],
      ["label", "a".repeat(51)],
      ["group_name", "a".repeat(51)],
      ["name", "a".repeat(51)],
    ])("Com valor inválido no campo %s", async (field, value) => {
      await expect(
        feature.create(createFeatureInput({ [field]: value })),
      ).rejects.toThrow(ValidationError);
    });

    test.each(["is_self_removable", "is_privileged", "is_protected"])(
      "Com valor não booleano em %s",
      async (field) => {
        await expect(
          feature.create(createFeatureInput({ [field]: "true" })),
        ).rejects.toThrow(ValidationError);
      },
    );

    test("Rejeita campos não permitidos", async () => {
      await expect(
        feature.create(createFeatureInput({ id: existingFeature.id })),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe(".findOneById()", () => {
    test("ID que não é UUID lança NotFoundError sem consultar o banco", async () => {
      const querySpy = mockQueries([["SELECT", []]]);

      await expect(feature.findOneById("inexistente")).rejects.toThrow(
        NotFoundError,
      );
      expect(querySpy).not.toHaveBeenCalled();
    });

    test("Retorna a feature ativa pelo ID", async () => {
      mockQueries([["SELECT", [existingFeature]]]);

      await expect(feature.findOneById(existingFeature.id)).resolves.toEqual(
        existingFeature,
      );
    });

    test("Com ID inexistente ou feature excluída", async () => {
      const querySpy = mockQueries([["SELECT", []]]);

      await expect(
        feature.findOneById("22222222-2222-4222-8222-222222222222"),
      ).rejects.toThrow(NotFoundError);

      const [selectQuery] = getCallsContaining(querySpy, "SELECT");
      expect(selectQuery.text).toContain("deleted_at IS NULL");
    });
  });

  describe(".findOneByName()", () => {
    test("Retorna a feature ativa pelo nome", async () => {
      mockQueries([["SELECT", [existingFeature]]]);

      await expect(
        feature.findOneByName(existingFeature.name),
      ).resolves.toEqual(existingFeature);
    });

    test("Com nome inexistente ou feature excluída", async () => {
      const querySpy = mockQueries([["SELECT", []]]);

      await expect(feature.findOneByName("inexistente")).rejects.toThrow(
        NotFoundError,
      );

      const [selectQuery] = getCallsContaining(querySpy, "SELECT");
      expect(selectQuery.text).toContain("deleted_at IS NULL");
    });
  });

  describe(".findAll()", () => {
    test("Retorna somente features ativas em ordem de grupo, rótulo e nome", async () => {
      const querySpy = mockQueries([["SELECT", [existingFeature]]]);

      await expect(feature.findAll()).resolves.toEqual([existingFeature]);

      const [selectQuery] = getCallsContaining(querySpy, "SELECT");
      expect(selectQuery.text).toContain("deleted_at IS NULL");
      expect(selectQuery.text).toContain(
        "ORDER BY\n        group_name,\n        label,\n        name",
      );
    });
  });

  describe(".update()", () => {
    test("Atualiza somente os campos informados", async () => {
      const updatedFeature = { ...existingFeature, label: "Ler relatórios" };
      const querySpy = mockQueries([
        ["FOR UPDATE", [existingFeature]],
        ["UPDATE\n          features", [updatedFeature]],
      ]);

      await feature.update(existingFeature.id, { label: "Ler relatórios" });

      const [updateQuery] = getCallsContaining(
        querySpy,
        "UPDATE\n          features",
      );
      expect(updateQuery.values).toEqual([
        existingFeature.id,
        "Ler relatórios",
      ]);
      expect(updateQuery.text).toContain("updated_at");
    });

    test("Rejeita atualização sem campos", async () => {
      await expect(feature.update(existingFeature.id, {})).rejects.toThrow(
        ValidationError,
      );
    });

    test("Com feature inexistente", async () => {
      mockQueries([["FOR UPDATE", []]]);

      await expect(
        feature.update(existingFeature.id, { label: "Novo rótulo" }),
      ).rejects.toThrow(NotFoundError);
    });

    test("Rejeita alteração de feature protegida", async () => {
      mockQueries([
        ["FOR UPDATE", [{ ...existingFeature, is_protected: true }]],
      ]);

      await expect(
        feature.update(existingFeature.id, { label: "Novo rótulo" }),
      ).rejects.toThrow("Esta feature está protegida e não pode ser alterada.");
    });

    test("Rejeita nome que já pertence a outra feature", async () => {
      mockQueries([
        ["FOR UPDATE", [existingFeature]],
        [
          "SELECT\n        id\n      FROM\n        features",
          [{ id: "outra-feature" }],
        ],
      ]);

      await expect(
        feature.update(existingFeature.id, { name: "read:users" }),
      ).rejects.toThrow("Já existe uma feature cadastrada com este nome.");
    });

    test("Ao renomear, atualiza as permissões dos usuários", async () => {
      const updatedFeature = { ...existingFeature, name: "read:documents" };
      const querySpy = mockQueries([
        ["FOR UPDATE", [existingFeature]],
        ["SELECT\n        id\n      FROM\n        features", []],
        ["UPDATE\n          features", [updatedFeature]],
        ["array_replace(features, $1, $2)", []],
      ]);

      await feature.update(existingFeature.id, { name: "read:documents" });

      const [usersUpdate] = getCallsContaining(
        querySpy,
        "array_replace(features, $1, $2)",
      );
      expect(usersUpdate.values).toEqual(["read:reports", "read:documents"]);
      expect(usersUpdate.text).toContain("array_replace(features, $1, $2)");
    });
  });

  describe(".delete()", () => {
    test("Exclui logicamente a feature e remove sua atribuição dos usuários", async () => {
      const deletedFeature = {
        ...existingFeature,
        deleted_at: "2026-11-19T00:00:00.000Z",
      };
      const querySpy = mockQueries([
        ["FOR UPDATE", [existingFeature]],
        ["array_remove(features, $1)", []],
        ["UPDATE\n          features", [deletedFeature]],
      ]);

      await expect(feature.delete(existingFeature.id)).resolves.toEqual(
        deletedFeature,
      );

      const [usersUpdate] = getCallsContaining(
        querySpy,
        "array_remove(features, $1)",
      );
      expect(usersUpdate.values).toEqual([existingFeature.name]);
      const [featureUpdate] = getCallsContaining(
        querySpy,
        "UPDATE\n          features",
      );
      expect(featureUpdate.text).toContain("deleted_at = timezone");
    });

    test("Com feature inexistente", async () => {
      mockQueries([["FOR UPDATE", []]]);

      await expect(feature.delete(existingFeature.id)).rejects.toThrow(
        NotFoundError,
      );
    });

    test("Rejeita exclusão de feature protegida", async () => {
      mockQueries([
        ["FOR UPDATE", [{ ...existingFeature, is_protected: true }]],
      ]);

      await expect(feature.delete(existingFeature.id)).rejects.toThrow(
        "Esta feature está protegida e não pode ser excluída.",
      );
    });

    test("Exclui feature não removível do catálogo independentemente dos usuários atribuídos", async () => {
      const nonSelfRemovableFeature = {
        ...existingFeature,
        is_self_removable: false,
      };
      const deletedFeature = {
        ...nonSelfRemovableFeature,
        deleted_at: "2026-11-21T00:00:00.000Z",
      };
      const querySpy = mockQueries([
        ["FOR UPDATE", [nonSelfRemovableFeature]],
        ["array_remove(features, $1)", []],
        ["UPDATE\n          features", [deletedFeature]],
      ]);

      await expect(feature.delete(existingFeature.id)).resolves.toEqual(
        deletedFeature,
      );

      const userLookupQueries = querySpy.mock.calls
        .map(([query]) => query)
        .filter(
          (query) =>
            query.text.trimStart().startsWith("SELECT") &&
            query.text.includes("ANY(features)"),
        );
      expect(userLookupQueries).toEqual([]);
      expect(
        getCallsContaining(querySpy, "array_remove(features, $1)"),
      ).toHaveLength(1);
    });
  });
});
