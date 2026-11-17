import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import {
  addPdfFiles,
  buildOutputName,
  extractPages,
  splitPdfFiles,
  validateRange,
} from "@/features/divisor-pdf/lib/pdf.js";

async function createPdfFile(name, totalPages) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < totalPages; i++) doc.addPage();
  const bytes = await doc.save();

  return {
    name,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

async function countPages(bytes) {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe("features/divisor-pdf/lib/pdf.js", () => {
  describe("validateRange()", () => {
    test("Valores válidos, inclusive como texto", () => {
      expect(validateRange({ pageInit: "2", pageCount: 3 })).toEqual({
        ok: true,
        value: { pageInit: 2, pageCount: 3 },
      });
    });

    test.each([
      ["", "4"],
      ["0", "4"],
      ["-1", "4"],
      ["1.5", "4"],
      ["abc", "4"],
    ])("Página inicial inválida (%p)", (pageInit, pageCount) => {
      const result = validateRange({ pageInit, pageCount });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/página inicial/);
    });

    test.each(["", "0", "-2", "2.5", "x"])(
      "Número de páginas inválido (%p)",
      (pageCount) => {
        const result = validateRange({ pageInit: "1", pageCount });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/número de páginas/);
      },
    );
  });

  describe("addPdfFiles()", () => {
    test("Aceita só .pdf, em qualquer caixa", () => {
      const result = addPdfFiles(
        [],
        [{ name: "a.PDF" }, { name: "b.txt" }, { name: "c.pdf" }],
      );
      expect(result.ok).toBe(true);
      expect(result.files.map((file) => file.name)).toEqual(["a.PDF", "c.pdf"]);
    });

    test("Rejeita quando não há nenhum .pdf", () => {
      expect(addPdfFiles([], [{ name: "b.txt" }])).toEqual({
        ok: false,
        error: "Por favor, selecione apenas arquivos .pdf.",
      });
    });

    test("Não repete nomes já selecionados", () => {
      const current = [{ name: "a.pdf" }];
      const result = addPdfFiles(current, [
        { name: "a.pdf" },
        { name: "b.pdf" },
        { name: "b.pdf" },
      ]);
      expect(result.files.map((file) => file.name)).toEqual(["a.pdf", "b.pdf"]);
    });
  });

  describe("buildOutputName()", () => {
    test("Monta o nome do arquivo gerado", () => {
      expect(buildOutputName("doc.pdf", 2, 4)).toBe("4_pages_from_2_doc.pdf");
    });
  });

  describe("extractPages()", () => {
    test("Extrai o intervalo pedido", async () => {
      const file = await createPdfFile("doc.pdf", 10);
      const result = await extractPages(file, 3, 4);

      expect(result.ok).toBe(true);
      expect(await countPages(result.bytes)).toBe(4);
    });

    test("Aceita o intervalo que termina na última página", async () => {
      const file = await createPdfFile("doc.pdf", 5);
      const result = await extractPages(file, 2, 4);

      expect(result.ok).toBe(true);
      expect(await countPages(result.bytes)).toBe(4);
    });

    test("Rejeita intervalo maior que o documento", async () => {
      const file = await createPdfFile("doc.pdf", 5);

      expect(await extractPages(file, 3, 4)).toEqual({
        ok: false,
        error:
          'Intervalo inválido em "doc.pdf": o documento tem apenas 5 página(s).',
      });
    });

    test("Rejeita arquivo que não é PDF", async () => {
      const file = {
        name: "falso.pdf",
        arrayBuffer: async () => new TextEncoder().encode("não sou pdf").buffer,
      };
      const result = await extractPages(file, 1, 1);

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/falso\.pdf/);
    });
  });

  describe("splitPdfFiles()", () => {
    test("Um arquivo gera um PDF", async () => {
      const file = await createPdfFile("doc.pdf", 6);
      const result = await splitPdfFiles([file], { pageInit: 2, pageCount: 3 });

      expect(result.ok).toBe(true);
      expect(result.filename).toBe("3_pages_from_2_doc.pdf");
      expect(result.blob.type).toBe("application/pdf");
      expect(await countPages(await result.blob.arrayBuffer())).toBe(3);
    });

    test("Vários arquivos geram um ZIP com timestamp", async () => {
      const files = [
        await createPdfFile("a.pdf", 5),
        await createPdfFile("b.pdf", 8),
      ];
      const result = await splitPdfFiles(
        files,
        { pageInit: 1, pageCount: 2 },
        new Date(2026, 6, 30, 14, 5, 9),
      );

      expect(result.ok).toBe(true);
      expect(result.filename).toBe("20260730140509.zip");

      const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
      expect(Object.keys(zip.files).sort()).toEqual([
        "2_pages_from_1_a.pdf",
        "2_pages_from_1_b.pdf",
      ]);
    });

    test("Interrompe no primeiro arquivo com intervalo inválido", async () => {
      const files = [
        await createPdfFile("a.pdf", 5),
        await createPdfFile("curto.pdf", 1),
      ];
      const result = await splitPdfFiles(files, { pageInit: 1, pageCount: 3 });

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/curto\.pdf/);
    });
  });
});
