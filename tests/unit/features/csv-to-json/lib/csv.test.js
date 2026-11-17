import {
  createJson,
  parseCsv,
} from "@/features/csv-to-json/lib/csv.js";

describe("features/csv-to-json/lib/csv.js", () => {
  describe("parseCsv()", () => {
    test("Interpreta CSV separado por ponto e vírgula", () => {
      const result = parseCsv(
        "nome;idade\nAna;30\nBruno;25",
        ";",
      );

      expect(result).toEqual({
        data: [
          { nome: "Ana", idade: "30" },
          { nome: "Bruno", idade: "25" },
        ],
        fields: ["nome", "idade"],
        error: "",
      });
    });

    test("Detecta automaticamente o delimitador", () => {
      const result = parseCsv("nome,idade\nAna,30");

      expect(result.fields).toEqual(["nome", "idade"]);
      expect(result.data).toEqual([{ nome: "Ana", idade: "30" }]);
    });

    test("Interpreta campos entre aspas que contêm delimitadores", () => {
      const result = parseCsv('nome;observacao\nAna;"São Paulo; SP"', ";");

      expect(result.data).toEqual([
        { nome: "Ana", observacao: "São Paulo; SP" },
      ]);
    });

    test("Preserva quebras de linha dentro de campos entre aspas", () => {
      const result = parseCsv('nome;observacao\nAna;"Linha 1\nLinha 2"', ";");

      expect(result.data).toEqual([
        { nome: "Ana", observacao: "Linha 1\nLinha 2" },
      ]);
    });

    test("Interpreta arquivos separados por tabulação", () => {
      const result = parseCsv("nome\tidade\nAna\t30", "\t");

      expect(result.fields).toEqual(["nome", "idade"]);
      expect(result.data).toEqual([{ nome: "Ana", idade: "30" }]);
    });

    test("Ignora linhas vazias", () => {
      const result = parseCsv("nome;idade\nAna;30\n\n");

      expect(result.data).toEqual([{ nome: "Ana", idade: "30" }]);
    });
  });

  describe("createJson()", () => {
    test("Gera JSON somente com as colunas selecionadas", () => {
      const json = createJson(
        [
          { nome: " Ana ", idade: "30", cidade: "Campinas" },
          { nome: "Bruno", idade: "25", cidade: "Sumaré" },
        ],
        ["nome", "cidade"],
      );

      expect(JSON.parse(json)).toEqual([
        { nome: "Ana", cidade: "Campinas" },
        { nome: "Bruno", cidade: "Sumaré" },
      ]);
    });

    test("Retorna string vazia sem registros ou colunas", () => {
      expect(createJson([], ["nome"])).toBe("");
      expect(createJson([{ nome: "Ana" }], [])).toBe("");
    });

    test("Substitui valores nulos por string vazia", () => {
      const json = createJson([{ nome: null }], ["nome"]);

      expect(JSON.parse(json)).toEqual([{ nome: "" }]);
    });
  });
});
