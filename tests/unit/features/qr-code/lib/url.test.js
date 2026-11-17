import { normalizeUrl } from "@/features/qr-code/lib/url.js";

describe("features/qr-code/lib/url.js", () => {
  describe("normalizeUrl()", () => {
    test("Link vazio", () => {
      expect(normalizeUrl("   ")).toEqual({
        ok: false,
        error: "Digite o link que deseja codificar.",
      });
    });

    test("Valor indefinido", () => {
      expect(normalizeUrl(undefined).ok).toBe(false);
    });

    test("Link completo com https", () => {
      expect(normalizeUrl(" https://exemplo.com/pagina?a=1 ")).toEqual({
        ok: true,
        value: "https://exemplo.com/pagina?a=1",
      });
    });

    test("Link sem protocolo recebe https://", () => {
      expect(normalizeUrl("exemplo.com")).toEqual({
        ok: true,
        value: "https://exemplo.com",
      });
    });

    test("Texto que não é um endereço", () => {
      expect(normalizeUrl("texto qualquer").ok).toBe(false);
      expect(normalizeUrl("palavra").ok).toBe(false);
    });

    test("Protocolo não permitido", () => {
      expect(normalizeUrl("javascript://exemplo.com").ok).toBe(false);
      expect(normalizeUrl("ftp://exemplo.com").ok).toBe(false);
    });
  });
});
