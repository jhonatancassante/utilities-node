import {
  amountToPortugueseWords,
  getCertificateDiscountPercentage,
  numberToPortugueseWords,
} from "@/lib/client/certificate-format.js";

describe("formatação de certidões", () => {
  test.each([
    [0, "zero"],
    [7, "sete"],
    [21, "vinte e um"],
    [100, "cem"],
    [101, "cento e um"],
    [1000, "mil"],
    [1452047, "um milhão, quatrocentos e cinquenta e dois mil e quarenta e sete"],
  ])("converte %i para extenso", (value, expected) => {
    expect(numberToPortugueseWords(value)).toBe(expected);
  });

  test("formata o valor monetário com reais e centavos", () => {
    expect(amountToPortugueseWords(1452047.65)).toBe(
      "Um milhão, quatrocentos e cinquenta e dois mil e quarenta e sete reais e sessenta e cinco centavos",
    );
  });

  test.each([
    [{ owner_rg: "123", land_area: 500 }, 50],
    [{ owner_rg: "123", land_area: 500.01 }, 30],
    [{ owner_rg: "123", land_area: 1000 }, 30],
    [{ owner_rg: "123", land_area: 1000.01 }, 0],
    [{ owner_rg: null, land_area: 100 }, 0],
  ])("calcula o desconto conforme a área", (record, expected) => {
    expect(getCertificateDiscountPercentage(record)).toBe(expected);
  });
});
