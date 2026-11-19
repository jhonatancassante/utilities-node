import {
  calculateVerifiers,
  formatCpf,
  generateCpfVariations,
  isValidCpf,
} from "@/features/cpf-tester/lib/cpf.js";

describe("features/cpf-tester/lib/cpf.js", () => {
  describe("formatCpf()", () => {
    test("Formata um CPF completo", () => {
      expect(formatCpf("52998224725")).toBe("529.982.247-25");
    });

    test("Formata valores parciais durante a digitação", () => {
      expect(formatCpf("529982")).toBe("529.982");
      expect(formatCpf("529982247")).toBe("529.982.247");
    });

    test("Remove caracteres não numéricos e limita a 11 dígitos", () => {
      expect(formatCpf("529.982.247-25abc99")).toBe("529.982.247-25");
    });

    test("Trata valores vazios ou indefinidos", () => {
      expect(formatCpf("")).toBe("");
      expect(formatCpf(undefined)).toBe("");
    });
  });

  describe("calculateVerifiers()", () => {
    test("Calcula os dígitos verificadores conhecidos", () => {
      expect(calculateVerifiers("529982247")).toBe("25");
    });

    test("Retorna vazio quando a base não possui nove dígitos", () => {
      expect(calculateVerifiers("123")).toBe("");
      expect(calculateVerifiers("12345678a")).toBe("");
    });
  });

  describe("isValidCpf()", () => {
    test("Reconhece um CPF válido", () => {
      expect(isValidCpf("52998224725")).toBe(true);
    });

    test("Rejeita dígitos verificadores incorretos", () => {
      expect(isValidCpf("52998224724")).toBe(false);
    });

    test("Rejeita CPFs com todos os dígitos iguais", () => {
      expect(isValidCpf("00000000000")).toBe(false);
      expect(isValidCpf("11111111111")).toBe(false);
    });

    test("Rejeita valores com tamanho ou caracteres inválidos", () => {
      expect(isValidCpf("5299822472")).toBe(false);
      expect(isValidCpf("52998224725x")).toBe(false);
    });
  });

  describe("generateCpfVariations()", () => {
    test("Inclui o CPF original quando ele já é válido", () => {
      const variations = generateCpfVariations("52998224725");

      expect(variations).toContainEqual({
        cpf: "52998224725",
        isOriginal: true,
        changedIndex: null,
      });
    });

    test("Encontra o dígito verificador correto quando o original é inválido", () => {
      const variations = generateCpfVariations("52998224724");

      expect(variations).toContainEqual({
        cpf: "52998224725",
        isOriginal: false,
        changedIndex: 10,
      });
      expect(variations.every((item) => isValidCpf(item.cpf))).toBe(true);
    });

    test("Gera apenas resultados únicos que diferem em uma posição", () => {
      const original = "52998224724";
      const variations = generateCpfVariations(original);
      const unique = new Set(variations.map((item) => item.cpf));

      expect(unique.size).toBe(variations.length);
      variations.forEach((item) => {
        const differences = [...original].filter(
          (digit, index) => digit !== item.cpf[index],
        );
        expect(differences).toHaveLength(1);
      });
    });

    test("Retorna lista vazia para entrada inválida", () => {
      expect(generateCpfVariations("123")).toEqual([]);
      expect(generateCpfVariations("5299822472x")).toEqual([]);
    });
  });
});
