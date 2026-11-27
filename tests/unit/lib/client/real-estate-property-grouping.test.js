import getGroupingIssues from "@/lib/client/real-estate-property-grouping.js";

function createProperty(physicalRegistration, grouping, physicalPropertyId) {
  return {
    physical_property_id: physicalPropertyId,
    physical_registration: physicalRegistration,
    ctm: "123456",
    grouping,
  };
}

describe("getGroupingIssues", () => {
  test("aceitando um conjunto totalmente individual", () => {
    const records = [
      createProperty("123456.01", "I", 1),
      createProperty("123456.02", "I", 2),
    ];

    expect(getGroupingIssues(records)).toEqual([]);
  });

  test("aceitando um conjunto com um principal e agregados", () => {
    const records = [
      createProperty("123456.01", "P", 1),
      createProperty("123456.02", "A", 2),
      createProperty("123456.03", "A", 3),
    ];

    expect(getGroupingIssues(records)).toEqual([]);
  });

  test("identificando ausência de cadastro principal", () => {
    const records = [
      createProperty("123456.01", "A", 1),
      createProperty("123456.02", "A", 2),
    ];

    expect(getGroupingIssues(records)[0].issues).toEqual(
      expect.arrayContaining([
        "O conjunto deve possuir exatamente um cadastro principal (P).",
        "O cadastro terminado em .01 não pode estar classificado como agregado (A).",
      ]),
    );
  });

  test("identificando principal fora do cadastro terminado em .01", () => {
    const records = [
      createProperty("123456.01", "A", 1),
      createProperty("123456.02", "P", 2),
    ];

    expect(getGroupingIssues(records)[0].issues).toEqual(
      expect.arrayContaining([
        "O cadastro terminado em .01 não pode estar classificado como agregado (A).",
        "Somente o cadastro terminado em .01 pode ser principal (P).",
      ]),
    );
  });

  test("identificando mais de um cadastro principal", () => {
    const records = [
      createProperty("123456.01", "P", 1),
      createProperty("123456.02", "P", 2),
    ];

    expect(getGroupingIssues(records)[0].issues).toEqual(
      expect.arrayContaining([
        "O conjunto deve possuir exatamente um cadastro principal (P).",
        "Somente o cadastro terminado em .01 pode ser principal (P).",
      ]),
    );
  });

  test("identificando mistura de cadastros individuais e englobados", () => {
    const records = [
      createProperty("123456.01", "P", 1),
      createProperty("123456.02", "A", 2),
      createProperty("123456.03", "I", 3),
    ];

    expect(getGroupingIssues(records)[0].issues).toContain(
      "O CTM mistura cadastros individuais (I) com cadastros englobados (P/A).",
    );
  });
});
