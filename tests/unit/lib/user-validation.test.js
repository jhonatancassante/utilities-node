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
    test("Aceita senha com 12 caracteres e a composição exigida", () => {
      expect(validatePassword("AaBb12!!xyZz")).toBeNull();
    });

    test("Conta letras Unicode corretamente", () => {
      expect(validatePassword("ÁáÉéÜü12!@ab")).toBeNull();
    });

    test("Rejeita senha menor que 12 caracteres", () => {
      expect(validatePassword("AaBb12!!xyZ")).not.toBeNull();
    });

    test("Rejeita senha maior que 64 caracteres", () => {
      expect(validatePassword("AaBb12!!" + "x".repeat(57))).not.toBeNull();
    });

    test.each([
      ["aaBB12!!xyzz", "sem duas maiúsculas"],
      ["AABB12!!XYZZ", "sem duas minúsculas"],
      ["AaBb!!xyZzCD", "sem dois números"],
      ["AaBb12xyZzCD", "sem dois caracteres especiais"],
      ["123456789012345", "composta somente por números"],
    ])("Rejeita senha %s (%s)", (password) => {
      expect(validatePassword(password)).not.toBeNull();
    });

    test("Rejeita senhas comuns conhecidas", () => {
      expect(validatePassword("passwordpassword")).not.toBeNull();
    });
  });
});
