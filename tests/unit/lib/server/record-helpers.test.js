import { NotFoundError, ValidationError } from "@/infra/errors.js";
import {
  assertRecordId,
  isUuid,
  softDeleteMany,
} from "@/lib/server/record-helpers.js";

const VALID_ID = "99999999-9999-4999-8999-999999999999";

describe("lib/server/record-helpers.js", () => {
  describe(".isUuid()", () => {
    test("Aceita UUID válido, em maiúsculas ou minúsculas", () => {
      expect(isUuid(VALID_ID)).toBe(true);
      expect(isUuid(VALID_ID.toUpperCase())).toBe(true);
    });

    test.each([
      undefined,
      null,
      1,
      {},
      "",
      "abc",
      VALID_ID + "0",
      " " + VALID_ID,
    ])("Rejeita valor inválido: %p", (value) => {
      expect(isUuid(value)).toBe(false);
    });
  });

  describe(".assertRecordId()", () => {
    const options = { message: "Não encontrado.", action: "Verifique o ID." };

    test("Não lança erro para UUID válido", () => {
      expect(() => assertRecordId(VALID_ID, options)).not.toThrow();
    });

    test("Lança NotFoundError com a mensagem informada para ID inválido", () => {
      const error = (() => {
        try {
          assertRecordId("nao-e-uuid", options);
        } catch (thrown) {
          return thrown;
        }
      })();

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe("Não encontrado.");
      expect(error.action).toBe("Verifique o ID.");
    });
  });

  describe(".softDeleteMany()", () => {
    const options = {
      selectionLabel: "itens",
      notFoundMessage: "Não encontrados.",
      notFoundAction: "Atualize.",
    };

    test.each([
      ["sem lista", undefined],
      ["lista vazia", []],
      ["ID que não é UUID", ["abc"]],
      ["IDs repetidos", [VALID_ID, VALID_ID]],
      [
        "mais de 500 IDs",
        Array.from(
          { length: 501 },
          (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        ),
      ],
    ])("Rejeita seleção inválida: %s", async (_, ids) => {
      const error = await softDeleteMany("items", ids, options).catch((e) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe(
        "A exclusão em lote deve conter entre 1 e 500 IDs únicos.",
      );
      expect(error.action).toBe("Revise a seleção de itens e tente novamente.");
    });

    test("Rejeita nome de tabela fora do padrão", async () => {
      await expect(
        softDeleteMany("items; DROP TABLE users", [VALID_ID], options),
      ).rejects.toThrow("Nome de tabela inválido");
    });
  });
});
