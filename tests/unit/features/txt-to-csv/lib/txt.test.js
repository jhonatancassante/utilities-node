import {
  decodeBuffer,
  formatValue,
  parseFixedWidth,
  toCsv,
} from "@/features/txt-to-csv/lib/txt.js";

describe("features/txt-to-csv/lib/txt.js", () => {
  describe("decodeBuffer()", () => {
    test("Decodifica arquivos UTF-8", () => {
      const buffer = new TextEncoder().encode("Relatório de São Paulo").buffer;

      expect(decodeBuffer(buffer)).toEqual({
        text: "Relatório de São Paulo",
        encoding: "UTF-8",
      });
    });

    test("Utiliza Windows-1252 quando o conteúdo não é UTF-8 válido", () => {
      const buffer = new Uint8Array([78, 227, 111]).buffer;

      expect(decodeBuffer(buffer)).toEqual({
        text: "Não",
        encoding: "Windows-1252",
      });
    });
  });

  describe("parseFixedWidth()", () => {
    test("Interpreta cabeçalho na primeira linha", () => {
      const result = parseFixedWidth(
        "Código    Nome        Valor\r\n001       Ana         123,45\r\n002       Bruno       67,89",
      );

      expect(result).toEqual({
        title: null,
        headers: ["Código", "Nome", "Valor"],
        rows: [
          ["001", "Ana", "123,45"],
          ["002", "Bruno", "67,89"],
        ],
        headerLineNumber: 1,
        misaligned: 0,
      });
    });

    test("Ignora título e identifica cabeçalho na segunda linha", () => {
      const result = parseFixedWidth(
        "REFISNO Relatório\nCódigo    Nome        Valor\n001       Ana         123,45",
      );

      expect(result.title).toBe("REFISNO Relatório");
      expect(result.headers).toEqual(["Código", "Nome", "Valor"]);
      expect(result.rows).toEqual([["001", "Ana", "123,45"]]);
      expect(result.headerLineNumber).toBe(2);
    });

    test("Ignora linhas vazias e espaços antes do conteúdo", () => {
      const result = parseFixedWidth(
        "\n  Relatório\nCódigo    Nome\n001       Ana\n\n",
      );

      expect(result.title).toBe("Relatório");
      expect(result.rows).toEqual([["001", "Ana"]]);
    });

    test("Identifica linhas com valores cruzando o limite de uma coluna", () => {
      const result = parseFixedWidth(
        "Código    Nome        Valor\n001234567XAna         123,45",
      );

      expect(result.misaligned).toBe(1);
    });

    test("Informa quando o arquivo está vazio", () => {
      expect(() => parseFixedWidth(" \r\n\n")).toThrow("O arquivo está vazio.");
    });

    test("Informa quando não encontra o cabeçalho nas duas primeiras linhas", () => {
      expect(() => parseFixedWidth("Relatório\nSem colunas\nDados")).toThrow(
        "Não encontrei a linha de colunas na 1ª nem na 2ª linha do arquivo.",
      );
    });

    test("Informa quando a linha não possui separação entre colunas", () => {
      expect(() => parseFixedWidth("Identificador único")).toThrow(
        "Não encontrei a linha de colunas na 1ª nem na 2ª linha do arquivo.",
      );
    });
  });

  describe("formatValue()", () => {
    test("Remove a hora de datas quando solicitado", () => {
      expect(formatValue("26/10/2026 00:00:00", { dateOnly: true })).toBe(
        "26/10/2026",
      );
    });

    test("Aceita datas sem segundos", () => {
      expect(formatValue("26/10/2026 09:35", { dateOnly: true })).toBe(
        "26/10/2026",
      );
    });

    test("Mantém a hora quando a opção está desativada", () => {
      expect(formatValue("26/10/2026 00:00:00")).toBe("26/10/2026 00:00:00");
    });

    test("Troca vírgula decimal por ponto sem alterar outros valores", () => {
      expect(formatValue("-1234,56", { decimalDot: true })).toBe("-1234.56");
      expect(formatValue("1.234,56", { decimalDot: true })).toBe("1.234,56");
      expect(formatValue("texto, livre", { decimalDot: true })).toBe(
        "texto, livre",
      );
    });
  });

  describe("toCsv()", () => {
    const headers = ["Código", "Nome", "Valor"];
    const rows = [["001", "Ana", "123,45"]];

    test("Gera CSV separado por ponto e vírgula por padrão", () => {
      expect(toCsv(headers, rows)).toBe(
        "Código;Nome;Valor\r\n001;Ana;123,45\r\n",
      );
    });

    test("Permite vírgula e tabulação como separadores", () => {
      expect(
        toCsv(["Nome", "Idade"], [["Ana", "30"]], { separator: "," }),
      ).toBe("Nome,Idade\r\nAna,30\r\n");
      expect(
        toCsv(["Nome", "Idade"], [["Ana", "30"]], { separator: "\t" }),
      ).toBe("Nome\tIdade\r\nAna\t30\r\n");
    });

    test("Aplica as opções de data e decimal ao conteúdo", () => {
      expect(
        toCsv(["Data", "Valor"], [["26/10/2026 00:00:00", "1234,56"]], {
          dateOnly: true,
          decimalDot: true,
        }),
      ).toBe("Data;Valor\r\n26/10/2026;1234.56\r\n");
    });

    test("Escapa delimitadores e aspas dentro das células", () => {
      expect(
        toCsv(["Nome", "Observação"], [["Ana", 'Texto; com "aspas"']]),
      ).toBe('Nome;Observação\r\nAna;"Texto; com ""aspas"""\r\n');
    });

    test("Escapa quebras de linha dentro das células", () => {
      expect(toCsv(["Nome", "Observação"], [["Ana", "Linha 1\nLinha 2"]])).toBe(
        'Nome;Observação\r\nAna;"Linha 1\nLinha 2"\r\n',
      );
    });
  });
});
