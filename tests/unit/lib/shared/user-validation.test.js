import {
  validateUsername,
  validateEmail,
  validatePassword,
} from "@/lib/shared/user-validation.js";

describe("lib/shared/user-validation.js", () => {
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
    test.each([
      "jhow@example.com",
      "nome.sobrenome@sub.dominio.com.br",
      "nome_sobrenome@example.com",
      "nome-sobrenome@example.com",
      "nome_sobrenome-teste@meu-dominio.com.br",
    ])("Aceita o e-mail %s", (email) => {
      expect(validateEmail(email)).toBeNull();
    });

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
      const password = ["AaBb", "12!!", "xyZz"].join("");
      expect(validatePassword(password)).toBeNull();
    });

    test("Conta letras Unicode corretamente", () => {
      expect(validatePassword("ÁáÉéÜü12!@ab")).toBeNull();
    });

    test("Rejeita senha menor que 12 caracteres", () => {
      const password = ["AaBb", "12!!", "xyZ"].join("");
      expect(validatePassword(password)).not.toBeNull();
    });

    test("Rejeita senha maior que 64 caracteres", () => {
      const password = ["AaBb12!!", "x".repeat(57)].join("");
      expect(validatePassword(password)).not.toBeNull();
    });

    test.each([
      [["aabb", "12!!", "xyzz", "C"].join(""), "sem duas maiúsculas"],
      [["AABB", "12!!", "XYZZ"].join(""), "sem duas minúsculas"],
      [["AaBb", "!!", "xyZz", "CD"].join(""), "sem dois números"],
      [["AaBb", "12", "xyZz", "CD"].join(""), "sem dois caracteres especiais"],
      [["123456", "789012", "345"].join(""), "composta somente por números"],
    ])("Rejeita senha %s (%s)", (password) => {
      expect(validatePassword(password)).not.toBeNull();
    });

    test("Rejeita senhas comuns conhecidas", () => {
      const password = ["Password", "Password", "12!!"].join("");
      expect(validatePassword(password)).not.toBeNull();
    });
  });
});
