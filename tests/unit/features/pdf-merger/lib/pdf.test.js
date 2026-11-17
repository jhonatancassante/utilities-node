import { PDFDocument } from "pdf-lib";
import {
  addPdfFiles,
  mergePdfFiles,
  sortPdfFiles,
} from "@/features/pdf-merger/lib/pdf.js";

async function createPdfFile(name, pageSizes) {
  const doc = await PDFDocument.create();
  pageSizes.forEach(([width, height]) => doc.addPage([width, height]));
  const bytes = await doc.save();

  return {
    name,
    size: bytes.byteLength,
    lastModified: 1,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

async function getPdfPageSizes(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => page.getSize());
}

describe("features/pdf-merger/lib/pdf.js", () => {
  describe("addPdfFiles()", () => {
    test("Aceita arquivos PDF com extensão em qualquer caixa", () => {
      const result = addPdfFiles(
        [],
        [{ name: "a.PDF" }, { name: "b.txt" }, { name: "c.pdf" }],
      );

      expect(result.ok).toBe(true);
      expect(result.files.map((file) => file.name)).toEqual(["a.PDF", "c.pdf"]);
    });

    test("Rejeita uma seleção sem arquivos PDF", () => {
      expect(addPdfFiles([], [{ name: "arquivo.txt" }])).toEqual({
        ok: false,
        error: "Por favor, selecione apenas arquivos .pdf.",
      });
    });

    test("Não adiciona novamente o mesmo arquivo", () => {
      const current = [{ name: "arquivo.pdf", size: 100, lastModified: 10 }];
      const result = addPdfFiles(current, [
        { name: "arquivo.pdf", size: 100, lastModified: 10 },
        { name: "outro.pdf", size: 200, lastModified: 10 },
      ]);

      expect(result.files).toHaveLength(2);
    });

    test("Permite arquivos diferentes com o mesmo nome", () => {
      const result = addPdfFiles(
        [{ name: "arquivo.pdf", size: 100, lastModified: 10 }],
        [{ name: "arquivo.pdf", size: 200, lastModified: 10 }],
      );

      expect(result.files).toHaveLength(2);
    });
  });

  describe("sortPdfFiles()", () => {
    test("Ordena nomes alfabeticamente com comparação numérica natural", () => {
      const files = [
        { name: "arquivo10.pdf" },
        { name: "Arquivo2.pdf" },
        { name: "arquivo1.pdf" },
      ];

      expect(sortPdfFiles(files).map((file) => file.name)).toEqual([
        "arquivo1.pdf",
        "Arquivo2.pdf",
        "arquivo10.pdf",
      ]);
      expect(files[0].name).toBe("arquivo10.pdf");
    });
  });

  describe("mergePdfFiles()", () => {
    test("Unifica PDFs em ordem natural e adiciona páginas em branco por arquivo ímpar", async () => {
      const files = [
        await createPdfFile("arquivo10.pdf", [[300, 400]]),
        await createPdfFile("arquivo2.pdf", [
          [200, 300],
          [200, 300],
          [200, 300],
        ]),
        await createPdfFile("arquivo1.pdf", [
          [100, 150],
          [100, 150],
        ]),
      ];

      const result = await mergePdfFiles(
        files,
        true,
        new Date(2026, 6, 30, 14, 5, 9),
      );

      expect(result.ok).toBe(true);
      expect(result.filename).toBe("20260730140509.pdf");
      expect(result.pageCount).toBe(8);
      expect(await getPdfPageSizes(result.bytes)).toEqual([
        { width: 100, height: 150 },
        { width: 100, height: 150 },
        { width: 200, height: 300 },
        { width: 200, height: 300 },
        { width: 200, height: 300 },
        { width: 200, height: 300 },
        { width: 300, height: 400 },
        { width: 300, height: 400 },
      ]);
    });

    test("Não adiciona páginas em branco quando a opção está desativada", async () => {
      const files = [
        await createPdfFile("a.pdf", [[100, 150]]),
        await createPdfFile("b.pdf", [[200, 300], [200, 300]]),
      ];
      const result = await mergePdfFiles(files, false);

      expect(result.ok).toBe(true);
      expect(result.pageCount).toBe(3);
    });

    test("Retorna erro quando há menos de dois arquivos", async () => {
      const file = await createPdfFile("a.pdf", [[100, 150]]);

      expect(await mergePdfFiles([file])).toEqual({
        ok: false,
        error: "Selecione pelo menos dois arquivos PDF para unificar.",
      });
    });

    test("Identifica PDF inválido ou protegido por senha", async () => {
      const files = [
        await createPdfFile("a.pdf", [[100, 150]]),
        {
          name: "invalido.pdf",
          arrayBuffer: async () => new TextEncoder().encode("não é PDF").buffer,
        },
      ];

      const result = await mergePdfFiles(files);

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/invalido\.pdf/);
    });
  });
});
