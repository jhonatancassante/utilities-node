import {
  cellToText,
  collectOrderedFields,
  createCsv,
  normalizeToRows,
  stringToLatin1Bytes,
} from "@/features/json-to-csv/lib/json.js";

describe("features/json-to-csv/lib/json.js", () => {
  describe("normalizeToRows()", () => {
    test("Mantém uma lista de objetos como registros", () => {
      const rows = normalizeToRows([
        { nome: "Ana", idade: 30 },
        { nome: "Bruno", idade: 25 },
      ]);

      expect(rows).toEqual([
        { nome: "Ana", idade: 30 },
        { nome: "Bruno", idade: 25 },
      ]);
    });

    test("Converte valores simples de uma lista para a coluna value", () => {
      expect(normalizeToRows(["Ana", 30, true, null])).toEqual([
        { value: "Ana" },
        { value: 30 },
        { value: true },
        { value: null },
      ]);
    });

    test("Utiliza a única propriedade array de um objeto como origem dos registros", () => {
      expect(
        normalizeToRows({
          resultado: [{ nome: "Ana" }, { nome: "Bruno" }],
        }),
      ).toEqual([{ nome: "Ana" }, { nome: "Bruno" }]);
    });

    test("Trata um objeto simples como um único registro", () => {
      expect(normalizeToRows({ nome: "Ana", idade: 30 })).toEqual([
        { nome: "Ana", idade: 30 },
      ]);
    });

    test("Retorna null para valores que não podem ser tabulados", () => {
      expect(normalizeToRows("Ana")).toBeNull();
      expect(normalizeToRows(30)).toBeNull();
      expect(normalizeToRows(null)).toBeNull();
      expect(normalizeToRows([])).toEqual([]);
    });
  });

  describe("collectOrderedFields()", () => {
    test("Preserva a ordem em que as propriedades aparecem pela primeira vez", () => {
      expect(
        collectOrderedFields([
          { nome: "Ana", idade: 30 },
          { cidade: "Campinas", nome: "Bruno" },
        ]),
      ).toEqual(["nome", "idade", "cidade"]);
    });
  });

  describe("cellToText()", () => {
    test("Converte valores simples, nulos e estruturas em texto", () => {
      expect(cellToText("Ana")).toBe("Ana");
      expect(cellToText(30)).toBe("30");
      expect(cellToText(false)).toBe("false");
      expect(cellToText(null)).toBe("");
      expect(cellToText(undefined)).toBe("");
      expect(cellToText({ ativo: true })).toBe('{"ativo":true}');
      expect(cellToText(["A", "B"])).toBe('["A","B"]');
    });
  });

  describe("createCsv()", () => {
    test("Gera CSV com ponto e vírgula e cabeçalho", () => {
      expect(
        createCsv(
          [
            { nome: "Ana", idade: 30 },
            { nome: "Bruno", idade: 25 },
          ],
          ["nome", "idade"],
        ),
      ).toBe("nome;idade\r\nAna;30\r\nBruno;25");
    });

    test("Permite escolher vírgula ou tabulação como delimitador", () => {
      const rows = [{ nome: "Ana", idade: 30 }];

      expect(createCsv(rows, ["nome", "idade"], ",")).toBe(
        "nome,idade\r\nAna,30",
      );
      expect(createCsv(rows, ["nome", "idade"], "\t")).toBe(
        "nome\tidade\r\nAna\t30",
      );
    });

    test("Inclui somente as colunas selecionadas e mantém a ordem escolhida", () => {
      expect(
        createCsv(
          [{ nome: "Ana", idade: 30, cidade: "Campinas" }],
          ["cidade", "nome"],
        ),
      ).toBe("cidade;nome\r\nCampinas;Ana");
    });

    test("Serializa objetos e listas e deixa valores ausentes vazios", () => {
      expect(
        createCsv(
          [
            {
              nome: "Ana",
              endereco: { cidade: "Campinas" },
              telefones: ["11", "19"],
            },
            { nome: "Bruno" },
          ],
          ["nome", "endereco", "telefones"],
        ),
      ).toBe(
        'nome;endereco;telefones\r\nAna;"{""cidade"":""Campinas""}";"[""11"",""19""]"\r\nBruno;;',
      );
    });

    test("Retorna string vazia sem registros ou colunas", () => {
      expect(createCsv([], ["nome"])).toBe("");
      expect(createCsv([{ nome: "Ana" }], [])).toBe("");
    });
  });

  describe("stringToLatin1Bytes()", () => {
    test("Codifica caracteres ISO-8859-1 e substitui os não suportados", () => {
      expect(Array.from(stringToLatin1Bytes("Ação € 😀"))).toEqual([
        65, 231, 227, 111, 32, 63, 32, 63,
      ]);
    });
  });
});
