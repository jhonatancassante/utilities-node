import { PDFDocument } from "pdf-lib";
import { encodeCode128B, encodeCode128C, generateArPdf } from "@/features/ar-generator/lib/pdf.js";

function makeRecord(index) {
  return {
    nome: "DESTINATÁRIO " + index,
    cep: "13380-017",
    endereco: "AVENIDA JOÃO PESSOA",
    numero: String(index),
    complemento: "",
    bairro: "CENTRO",
    uf: "SP",
    cidade: "Nova Odessa",
    observacao: "",
    remetente: {
      nome: "MUNICÍPIO DE NOVA ODESSA - SETOR DE TRIBUTAÇÃO E DÍVIDA ATIVA",
      cep: "13380-017",
      endereco: "AVENIDA JOÃO PESSOA",
      numero: "777",
      complemento: "",
      bairro: "CENTRO",
      uf: "SP",
      cidade: "Nova Odessa",
    },
  };
}

// prettier-ignore
describe("features/ar-generator/lib/pdf.js", () => {
  describe("encodeCode128B()", () => {
    test("Codifica CEP em Code 128 conjunto B com checksum", () => {
      expect(encodeCode128B("13380017")).toEqual([
        104, 17, 19, 19, 24, 16, 16, 17, 23, 70, 106,
      ]);
    });

    test("Codifica CEP numérico no conjunto C, como o JsBarcode do gerador original", () => {
      expect(encodeCode128C("13380017")).toEqual([105, 13, 38, 0, 17, 56, 106]);
    });

    test("Rejeita conteúdo vazio, ímpar ou não numérico no conjunto C", () => {
      expect(encodeCode128C("")).toEqual([]);
      expect(encodeCode128C("1338001")).toEqual([]);
      expect(encodeCode128C("13380A17")).toEqual([]);
    });

    test("Rejeita conteúdo vazio ou fora do conjunto ASCII suportado", () => {
      expect(encodeCode128B("")).toEqual([]);
      expect(encodeCode128B("São Paulo")).toEqual([]);
    });
  });

  describe("generateArPdf()", () => {
    test("Gera ARs e etiquetas em páginas A4, incluindo etiqueta do remetente", async () => {
      const records = Array.from({ length: 5 }, (_, index) => makeRecord(index + 1));
      const result = await generateArPdf(
        records,
        true,
        null,
        new Date(2026, 10, 17, 13, 1, 2),
      );
      const document = await PDFDocument.load(result.bytes);

      expect(result.filename).toBe("AR_e_Etiquetas_20261117130102.pdf");
      expect(result.pageCount).toBe(5);
      expect(document.getPageCount()).toBe(5);
      document.getPages().forEach((page) => {
        expect(page.getWidth()).toBeCloseTo((210 * 72) / 25.4, 2);
        expect(page.getHeight()).toBeCloseTo((297 * 72) / 25.4, 2);
      });
    });

    test("Gera uma única página de etiquetas quando há até oito destinatários", async () => {
      const records = Array.from({ length: 5 }, (_, index) => makeRecord(index + 1));
      const result = await generateArPdf(records, false, null);

      expect(result.pageCount).toBe(4);
      expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(4);
    });

    test("Retorna PDF sem páginas para uma lista vazia", async () => {
      const result = await generateArPdf([], false, null);

      expect(result.pageCount).toBe(0);
      expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(0);
    });
  });
});
