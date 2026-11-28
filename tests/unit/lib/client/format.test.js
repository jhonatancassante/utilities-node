import { formatDate, formatDateTime } from "@/lib/client/format.js";

describe("lib/client/format.js", () => {
  describe(".formatDateTime()", () => {
    test.each([undefined, null, "", "não é data"])(
      "Valor vazio ou inválido (%p) vira travessão",
      (value) => {
        expect(formatDateTime(value)).toBe("—");
      },
    );

    test("Formata data e hora no padrão brasileiro", () => {
      expect(formatDateTime("2026-11-28T11:14:05")).toMatch(
        /^28\/11\/2026,? 11:14:05$/,
      );
    });
  });

  describe(".formatDate()", () => {
    test.each([undefined, null, "", "não é data"])(
      "Valor vazio ou inválido (%p) vira travessão",
      (value) => {
        expect(formatDate(value)).toBe("—");
      },
    );

    test("Formata somente a data no padrão brasileiro", () => {
      expect(formatDate("2026-11-28T11:14:05")).toBe("28/11/2026");
    });
  });
});
