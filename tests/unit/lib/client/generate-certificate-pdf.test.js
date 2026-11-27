import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  buildCertificatePdf,
  createCertificateFileName,
  wrapText,
} from "@/lib/client/generate-certificate-pdf.js";

const baseRecord = {
  id: "5021305c-85a3-4371-b1af-5c430097d7f2",
  created_at: "2026-11-25T15:00:00Z",
  validity_days: 30,
  year: 2026,
  issuer_name: "Jhonatan Cassante de Brito",
  issuer_position: "Escriturário",
  applicant_name: "João Gabriel Val",
  purpose: "lavrar escritura",
  protocol_number: 8871,
  protocol_year: 2026,
  physical_registration: "25.00003.0163.01/02/03/04/05",
  physical_property_id: 5,
  owner_name: "Antonio Scaliche",
  promissory_buyer: "Antonio Scaliche",
  property_block: "Cadastro 00003",
  property_lots: "Cadastro 0163",
  property_street: "Avenida Carlos Botelho",
  property_number: 87,
  property_neighborhood: "Centro",
  land_area: 110.37,
  built_area: 1530.28,
  land_value: 261925.49,
  building_value: 1190122.16,
  total_value: 1452047.65,
};

async function loadPages(bytes) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages();
}

describe("lib/client/generate-certificate-pdf.js", () => {
  describe("createCertificateFileName()", () => {
    test("Gera o nome individual com timestamp no horário de São Paulo", () => {
      expect(
        createCertificateFileName(
          [baseRecord],
          new Date("2026-11-27T14:34:26.000Z"),
        ),
      ).toBe("cvv-5-2026-20261127113426.pdf");
    });

    test("Identifica arquivos com várias certidões como lote", () => {
      expect(
        createCertificateFileName(
          [baseRecord, baseRecord],
          new Date("2026-11-27T14:34:26.000Z"),
        ),
      ).toBe("cvv-lote-20261127113426.pdf");
    });
  });

  describe("wrapText()", () => {
    let font;

    beforeAll(async () => {
      const pdf = await PDFDocument.create();
      font = await pdf.embedFont(StandardFonts.Helvetica);
    });

    test("Quebra o texto sem ultrapassar a largura máxima", () => {
      const text = "um texto um pouco mais longo que a largura disponível";
      const lines = wrapText(font, text, 10, 100);

      expect(lines.length).toBeGreaterThan(1);
      lines.forEach((line) => {
        expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(100);
      });
      expect(lines.join(" ")).toBe(text);
    });

    test("Não quebra no espaço inseparável", () => {
      const lines = wrapText(font, "valor R$ 1.000,00 total", 10, 45);

      expect(lines.some((line) => line.includes("R$ 1.000,00"))).toBe(true);
    });

    test("Respeita as quebras de linha do texto", () => {
      expect(wrapText(font, "primeira\nsegunda", 10, 300)).toEqual([
        "primeira",
        "segunda",
      ]);
    });
  });

  describe("buildCertificatePdf()", () => {
    test("Sem certidões", async () => {
      await expect(buildCertificatePdf([])).rejects.toThrow(
        "Selecione ao menos uma certidão para gerar o PDF.",
      );
    });

    test("Com uma certidão", async () => {
      const pages = await loadPages(await buildCertificatePdf([baseRecord]));

      expect(pages).toHaveLength(1);
      expect(pages[0].getWidth()).toBeCloseTo(595.32, 1);
      expect(pages[0].getHeight()).toBeCloseTo(841.92, 1);
    });

    test("Com várias certidões, uma página por certidão", async () => {
      const bytes = await buildCertificatePdf([
        baseRecord,
        { ...baseRecord, building_value: 0 },
        { ...baseRecord, owner_rg: "46817019" },
      ]);

      expect(await loadPages(bytes)).toHaveLength(3);
    });

    test("Com RG, observação e desconto", async () => {
      const bytes = await buildCertificatePdf([
        {
          ...baseRecord,
          owner_rg: "46817019",
          observations: "Observação do formulário. ".repeat(12),
        },
      ]);

      expect(await loadPages(bytes)).toHaveLength(1);
    });

    test("Com observação muito longa, mantém uma única página", async () => {
      const bytes = await buildCertificatePdf([
        {
          ...baseRecord,
          owner_rg: "46817019",
          observations: "texto de observação muito longo ".repeat(60),
        },
      ]);

      expect(await loadPages(bytes)).toHaveLength(1);
    });

    test("Com caracteres que a fonte do PDF não suporta", async () => {
      const bytes = await buildCertificatePdf([
        {
          ...baseRecord,
          owner_name: "Łukasz Żółć 日本",
          observations: "Observação com emoji 😀",
        },
      ]);

      expect(await loadPages(bytes)).toHaveLength(1);
    });
  });
});
