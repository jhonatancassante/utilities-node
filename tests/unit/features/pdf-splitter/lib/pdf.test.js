import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import {
  addPdfFiles,
  buildOutputName,
  extractPages,
  splitPdfFiles,
  validateRange,
} from "@/features/pdf-splitter/lib/pdf.js";

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

describe("features/pdf-splitter/lib/pdf.js", () => {
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

      expect(result).toMatchObject({
        ok: true,
        status: "extracted",
        totalPages: 10,
        extractedCount: 4,
      });
      expect(await countPages(result.bytes)).toBe(4);
    });

    test("Aceita o intervalo que termina na última página", async () => {
      const file = await createPdfFile("doc.pdf", 5);
      const result = await extractPages(file, 2, 4);

      expect(result.extractedCount).toBe(4);
      expect(await countPages(result.bytes)).toBe(4);
    });

    test("Extrai até a última página quando o documento é mais curto", async () => {
      const file = await createPdfFile("doc.pdf", 11);
      const result = await extractPages(file, 10, 10);

      expect(result).toMatchObject({
        ok: true,
        status: "extracted",
        totalPages: 11,
        extractedCount: 2,
      });
      expect(await countPages(result.bytes)).toBe(2);
    });

    test("Ignora o arquivo que não chega à página inicial", async () => {
      const file = await createPdfFile("doc.pdf", 5);

      expect(await extractPages(file, 6, 2)).toEqual({
        ok: true,
        status: "skipped",
        totalPages: 5,
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
      expect(result.warnings).toEqual([]);
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
      expect(result.warnings).toEqual([]);

      const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
      expect(Object.keys(zip.files).sort()).toEqual([
        "2_pages_from_1_a.pdf",
        "2_pages_from_1_b.pdf",
      ]);
    });

    test("Arquivo mais curto é extraído até o fim e gera aviso", async () => {
      const files = [
        await createPdfFile("onze.pdf", 11),
        await createPdfFile("vinte.pdf", 20),
      ];
      const result = await splitPdfFiles(files, {
        pageInit: 10,
        pageCount: 10,
      });

      expect(result.ok).toBe(true);
      expect(result.warnings).toEqual([
        '"onze.pdf" tem apenas 11 páginas: foram extraídas as páginas 10 a 11.',
      ]);

      const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
      const pageCounts = {};
      for (const [name, entry] of Object.entries(zip.files)) {
        pageCounts[name] = await countPages(await entry.async("uint8array"));
      }
      expect(pageCounts).toEqual({
        "10_pages_from_10_onze.pdf": 2,
        "10_pages_from_10_vinte.pdf": 10,
      });
    });

    test("Aviso no singular quando sobra só uma página", async () => {
      const file = await createPdfFile("doc.pdf", 10);
      const result = await splitPdfFiles([file], {
        pageInit: 10,
        pageCount: 3,
      });

      expect(result.warnings).toEqual([
        '"doc.pdf" tem apenas 10 páginas: foi extraída a página 10.',
      ]);
    });

    test("Arquivo que não chega à página inicial é ignorado com aviso", async () => {
      const files = [
        await createPdfFile("curto.pdf", 5),
        await createPdfFile("longo.pdf", 20),
      ];
      const result = await splitPdfFiles(files, { pageInit: 10, pageCount: 2 });

      expect(result.ok).toBe(true);
      // Só sobrou um arquivo: o resultado é um PDF, não um ZIP.
      expect(result.filename).toBe("2_pages_from_10_longo.pdf");
      expect(result.warnings).toEqual([
        '"curto.pdf" tem apenas 5 páginas e não chega à página 10: foi ignorado.',
      ]);
    });

    test("Erro quando nenhum arquivo chega à página inicial", async () => {
      const files = [
        await createPdfFile("a.pdf", 3),
        await createPdfFile("b.pdf", 4),
      ];

      expect(
        await splitPdfFiles(files, { pageInit: 10, pageCount: 2 }),
      ).toEqual({
        ok: false,
        error:
          "Nenhum dos arquivos tem a página 10. Informe uma página inicial menor.",
      });
    });

    test("Interrompe no primeiro arquivo que não é um PDF válido", async () => {
      const files = [
        await createPdfFile("a.pdf", 5),
        {
          name: "falso.pdf",
          arrayBuffer: async () => new TextEncoder().encode("x").buffer,
        },
      ];
      const result = await splitPdfFiles(files, { pageInit: 1, pageCount: 3 });

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/falso\.pdf/);
    });
  });
});
