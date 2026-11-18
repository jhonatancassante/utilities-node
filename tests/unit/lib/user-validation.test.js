import {
  validateUsername,
  validateEmail,
  validatePassword,
} from "@/lib/user-validation.js";

describe("Validação dos dados de usuário", () => {
  describe("validateUsername()", () => {
    test.each(["Jhow", "jhow_01", "jhow-brito", "JHOW_01"])(
      "Aceita o nome de usuário %s",
      (username) => {
        expect(validateUsername(username)).toBeNull();
      },
    );

    test.each(["ab", "a".repeat(31), "nome inválido", "nome.com", "çarlos"])(
      "Rejeita o nome de usuário %s",
      (username) => {
        expect(validateUsername(username)).not.toBeNull();
      },
    );
  });

  describe("validateEmail()", () => {
    test.each(["jhow@example.com", "nome.sobrenome@sub.dominio.com.br"])(
      "Aceita o e-mail %s",
      (email) => {
        expect(validateEmail(email)).toBeNull();
      },
    );

    test.each([
      "email-invalido",
      "nome@@example.com",
      ".nome@example.com",
      "nome..sobrenome@example.com",
      "a".repeat(245) + "@example.com",
    ])("Rejeita o e-mail %s", (email) => {
      expect(validateEmail(email)).not.toBeNull();
    });
  });

  describe("validatePassword()", () => {
    test("Aceita uma frase-senha longa sem exigir composição artificial", () => {
      expect(
        validatePassword("esta e uma frase senha bastante longa"),
      ).toBeNull();
    });

    test("Conta caracteres Unicode corretamente", () => {
      expect(validatePassword("😀".repeat(15))).toBeNull();
    });

    test("Rejeita senhas menores que 15 caracteres", () => {
      expect(validatePassword("curta")).not.toBeNull();
    });

    test("Rejeita senhas maiores que 64 caracteres", () => {
      expect(validatePassword("a".repeat(65))).not.toBeNull();
    });

    test("Rejeita senhas comuns conhecidas", () => {
      expect(validatePassword("passwordpassword")).not.toBeNull();
    });
  });
});
