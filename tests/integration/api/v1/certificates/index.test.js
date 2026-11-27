import orchestrator from "tests/orchestrator.js";
import database from "@/infra/database.js";
import certificate from "@/models/certificate.js";
import realEstateProperty from "@/models/real-estate-property.js";
import assessedValue from "@/models/assessed-value.js";
import {
  calculateSimple,
  getPropertyClassification,
} from "@/features/certificates/services/calculators/calculate-simple.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function createSessionWithFeatures(features) {
  const testUser = await orchestrator.createUser();
  await orchestrator.activateUser(testUser);
  if (features.length) await orchestrator.addFeaturesToUser(testUser, features);
  const session = await orchestrator.createSession(testUser);
  session.userId = testUser.id;
  return session;
}

async function createProperty(overrides = {}) {
  return realEstateProperty.create({
    year: 2026,
    physical_property_id: 987654,
    physical_registration: "001.002.003",
    ctm: "01.002.003.0001",
    ctm_count: 1,
    grouping: "I",
    land_area: 250,
    built_area: 100,
    construction_type: 10,
    points: 70,
    property_neighborhood: "Centro",
    owner_name: "Proprietário de teste",
    promissory_buyer: "Compromissário de teste",
    land_sector: "1",
    property_street: "Rua de Teste",
    ...overrides,
  });
}

function collectionEndpoint() {
  return `${orchestrator.API_URL}/certificates`;
}

function itemEndpoint(id) {
  return `${collectionEndpoint()}/${id}`;
}

async function createCertificate(overrides = {}, userId) {
  const property = await createProperty();
  return certificate.create(
    {
      protocol_number: 123,
      protocol_year: 2026,
      applicant_name: "Requerente de teste",
      purpose: "Valor venal",
      physical_property_id: property.physical_property_id,
      physical_registration: property.physical_registration,
      owner_name: property.owner_name,
      promissory_buyer: property.promissory_buyer,
      property_street: property.property_street,
      property_number: 123,
      property_neighborhood: property.property_neighborhood,
      property_block: null,
      property_lots: null,
      property_complement: null,
      owner_rg: null,
      land_area: 250,
      built_area: 100,
      land_value: 50000,
      building_value: 120000,
      total_value: 170000,
      observations: "Certidão emitida para teste.",
      ...overrides,
    },
    userId ?? (await orchestrator.createUser()).id,
  );
}

describe("Cálculo simples e classificação construtiva", () => {
  test.each([
    [2015, "residential", 35, "precarious"],
    [2015, "commercial", 36, "simple"],
    [2015, "industrial", 46, "regular"],
    [2015, "residential", 66, "medium"],
    [2015, "commercial", 96, "good"],
    [2015, "industrial", 141, "sophisticated"],
    [2016, "residential", 35, "precarious"],
    [2016, "residential", 36, "simple"],
    [2016, "residential", 46, "medium"],
    [2016, "residential", 96, "good"],
    [2016, "residential", 141, "sophisticated"],
    [2016, "commercial", 45, "simple"],
    [2016, "industrial", 46, "medium"],
    [2016, "commercial", 96, "good"],
  ])(
    "Classificando %s, %s, %s pontos como %s",
    (year, category, points, expected) => {
      expect(getPropertyClassification(points, year, category)).toBe(expected);
    },
  );

  test("Calculando o terreno com o setor especial 9a", () => {
    const result = calculateSimple(
      {
        land_sector: "9a",
        ideal_fraction: 0.5,
        built_area: 0,
        construction_type: null,
        points: null,
      },
      { sector_9a: 100 },
      2026,
    );

    expect(result).toEqual({
      land_value: 50,
      building_value: 0,
      total_value: 50,
    });
  });

  test("Zerando a construção quando não há área construída", () => {
    const result = calculateSimple(
      {
        land_sector: "1",
        ideal_fraction: 0.5,
        built_area: 0,
        construction_type: 10,
        points: null,
      },
      { sector_1: 200 },
      2026,
    );

    expect(result).toEqual({
      land_value: 100,
      building_value: 0,
      total_value: 100,
    });
  });

  test("Zerando a construção quando o tipo construtivo está vazio", () => {
    const result = calculateSimple(
      {
        land_sector: "1",
        ideal_fraction: 0.5,
        built_area: 100,
        construction_type: null,
        points: null,
      },
      { sector_1: 200 },
      2026,
    );

    expect(result).toEqual({
      land_value: 100,
      building_value: 0,
      total_value: 100,
    });
  });

  test("Rejeitando cálculo quando falta pontuação para uma construção", () => {
    expect(() =>
      calculateSimple(
        {
          land_sector: "1",
          ideal_fraction: 0.5,
          built_area: 100,
          construction_type: 10,
          points: null,
        },
        { sector_1: 200 },
        2026,
      ),
    ).toThrow(
      "A pontuação do imóvel é necessária para calcular o valor da construção.",
    );
  });

  test("Rejeitando cálculo quando falta o valor venal do setor", () => {
    expect(() =>
      calculateSimple(
        {
          land_sector: "1",
          ideal_fraction: 0.5,
          built_area: 0,
          construction_type: null,
          points: null,
        },
        {},
        2026,
      ),
    ).toThrow(
      "O valor venal do terreno para o setor 1 não está cadastrado em 2026.",
    );
  });
});

describe("GET e POST /api/v1/certificates", () => {
  test("Rejeitando consulta sem a feature correspondente", async () => {
    const session = await createSessionWithFeatures([]);
    const response = await fetch(collectionEndpoint(), {
      headers: { Cookie: `session_id=${session.token}` },
    });
    expect(response.status).toBe(403);
  });

  test("Consultando certidões ativas com saída filtrada", async () => {
    const session = await createSessionWithFeatures(["read:certificate"]);
    const record = await createCertificate();
    const response = await fetch(collectionEndpoint(), {
      headers: { Cookie: `session_id=${session.token}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.map((item) => item.id)).toContain(record.id);
    expect(body[0]).not.toHaveProperty("deleted_at");
  });

  test("Cadastrando uma certidão e filtrando a resposta", async () => {
    const session = await createSessionWithFeatures([
      "create:certificate",
      "read:certificate",
    ]);
    await database.query({
      text: "UPDATE users SET name = $2, position = $3 WHERE id = $1;",
      values: [session.userId, "Jhonatan de Teste", "Escriturário"],
    });
    const property = await createProperty();
    await assessedValue.create({
      year: 2026,
      sector_1: 200,
      residential_medium: 1200,
    });
    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        protocol_number: 456,
        protocol_year: 2026,
        applicant_name: "Novo requerente",
        purpose: "Valor venal",
        physical_property_id: property.physical_property_id,
        year: 2026,
        owner_rg: null,
        observations: "Certidão emitida para teste.",
      }),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      protocol_number: 456,
      protocol_year: 2026,
      applicant_name: "Novo requerente",
      validity_days: 30,
      year: 2026,
      physical_property_id: 987654,
      land_value: "50000.00",
      building_value: "120000.00",
      total_value: "170000.00",
    });
    expect(body).not.toHaveProperty("is_updated");
    expect(body).not.toHaveProperty("deleted_at");
    expect(body).toHaveProperty("user_id");
    expect(body.issuer_name).toBe("Jhonatan de Teste");
    expect(body.issuer_position).toBe("Escriturário");
  });

  test.each([
    [true, "50000.00", "12000.00", "62000.00"],
    [false, "60000.00", "24000.00", "84000.00"],
  ])(
    "Selecionando a versão correta do imóvel quando Atualizado é %s",
    async (
      isUpdated,
      expectedLandValue,
      expectedBuildingValue,
      expectedTotalValue,
    ) => {
      const session = await createSessionWithFeatures([
        "create:certificate",
        "read:certificate",
      ]);
      const physicalPropertyId = isUpdated ? 987659 : 987658;
      await createProperty({
        physical_property_id: physicalPropertyId,
        land_area: 250,
        ideal_fraction: 250,
        built_area: 10,
      });
      await createProperty({
        physical_property_id: physicalPropertyId,
        annual: true,
        land_area: 300,
        ideal_fraction: 300,
        built_area: 20,
      });
      await assessedValue.create({
        year: 2026,
        sector_1: 200,
        residential_medium: 1200,
      });

      const response = await fetch(collectionEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({
          applicant_name: "Requerente de teste",
          purpose: "Valor venal",
          physical_property_id: physicalPropertyId,
          year: 2026,
          is_updated: isUpdated,
        }),
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        land_value: expectedLandValue,
        building_value: expectedBuildingValue,
        total_value: expectedTotalValue,
      });
    },
  );

  test.each([
    [null, 250, "50000.00", "120000.00", "170000.00"],
    ["12.345.678-9", 0, "25000.00", "60000.00", "85000.00"],
    ["12.345.678-9", 500, "25000.00", "60000.00", "85000.00"],
    ["12.345.678-9", 500.01, "35000.00", "84000.00", "119000.00"],
    ["12.345.678-9", 1000, "35000.00", "84000.00", "119000.00"],
    ["12.345.678-9", 1000.01, "50000.00", "120000.00", "170000.00"],
  ])(
    "Aplicando o desconto por RG no cenário %#",
    async (
      ownerRg,
      landArea,
      expectedLandValue,
      expectedBuildingValue,
      expectedTotalValue,
    ) => {
      const session = await createSessionWithFeatures([
        "create:certificate",
        "read:certificate",
      ]);
      const physicalPropertyId = 987680 + Math.round(landArea * 100);
      const property = await createProperty({
        physical_property_id: physicalPropertyId,
        land_area: landArea,
        ideal_fraction: 250,
      });
      await assessedValue.create({
        year: 2026,
        sector_1: 200,
        residential_medium: 1200,
      });

      const response = await fetch(collectionEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({
          applicant_name: "Requerente de teste",
          purpose: "Valor venal",
          physical_property_id: property.physical_property_id,
          year: 2026,
          owner_rg: ownerRg,
        }),
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        land_value: expectedLandValue,
        building_value: expectedBuildingValue,
        total_value: expectedTotalValue,
      });
    },
  );

  test("Calculando imóveis englobados a partir do cadastro terminado em 01", async () => {
    const session = await createSessionWithFeatures([
      "create:certificate",
      "read:certificate",
    ]);
    const registrations = ["01", "02", "03", "04", "05"];
    let requestedProperty;

    for (const [index, suffix] of registrations.entries()) {
      const property = await createProperty({
        physical_property_id: 987660 + index,
        physical_registration:
          suffix === "01" ? "2500003016301" : `25.00003.0163.${suffix}`,
        ctm: suffix === "02" ? "25000030163" : "25.00003.0163",
        ctm_count: 5,
        grouping: suffix === "01" ? "P" : "A",
        land_area: suffix === "01" ? 1000 : 999,
        built_area: 10,
        ideal_fraction: 0.1,
        owner_name:
          suffix === "01" ? "Proprietário principal" : `Proprietário ${suffix}`,
        promissory_buyer: null,
        property_street:
          suffix === "01" ? "Rua do cadastro principal" : `Rua ${suffix}`,
      });
      if (suffix === "03") requestedProperty = property;
    }

    await assessedValue.create({
      year: 2026,
      sector_1: 200,
      residential_medium: 1200,
    });

    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        applicant_name: "Requerente de teste",
        purpose: "Valor venal",
        physical_property_id: requestedProperty.physical_property_id,
        year: 2026,
        observations: "Certidão de imóvel englobado.",
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      physical_registration: "2500003016301/02/03/04/05",
      owner_name: "Proprietário principal",
      promissory_buyer: "Proprietário principal",
      property_street: "Rua do cadastro principal",
      land_area: "1000.00",
      built_area: "50.00",
      land_value: "100.00",
      building_value: "60000.00",
      total_value: "60100.00",
    });
  });

  test("Aplicando o desconto por RG ao cálculo de imóvel englobado", async () => {
    const session = await createSessionWithFeatures([
      "create:certificate",
      "read:certificate",
    ]);
    const physicalPropertyId = 987690;
    const ctm = "25.00003.0166";

    await createProperty({
      physical_property_id: physicalPropertyId,
      physical_registration: `${ctm}.01`,
      ctm,
      ctm_count: 2,
      grouping: "P",
      land_area: 500,
      built_area: 10,
      ideal_fraction: 0.1,
    });
    await createProperty({
      physical_property_id: physicalPropertyId + 1,
      physical_registration: `${ctm}.02`,
      ctm,
      ctm_count: 2,
      grouping: "A",
      land_area: 999,
      built_area: 10,
      ideal_fraction: 0.1,
    });
    await assessedValue.create({
      year: 2026,
      sector_1: 200,
      residential_medium: 1200,
    });

    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        applicant_name: "Requerente de teste",
        purpose: "Valor venal",
        physical_property_id: physicalPropertyId,
        year: 2026,
        owner_rg: "12.345.678-9",
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      land_area: "500.00",
      land_value: "20.00",
      building_value: "12000.00",
      total_value: "12020.00",
    });
  });

  test("Calculando individualmente quando todos os cadastros do CTM são I", async () => {
    const session = await createSessionWithFeatures([
      "create:certificate",
      "read:certificate",
    ]);
    const physicalPropertyId = 987665;
    await createProperty({
      physical_property_id: physicalPropertyId,
      physical_registration: "25.00003.0165.01",
      ctm: "25.00003.0165",
      ctm_count: 2,
      grouping: "I",
      land_area: 100,
      ideal_fraction: 100,
      built_area: 10,
    });
    await createProperty({
      physical_property_id: physicalPropertyId + 1,
      physical_registration: "25.00003.0165.02",
      ctm: "25.00003.0165",
      ctm_count: 2,
      grouping: "I",
      land_area: 200,
      ideal_fraction: 200,
      built_area: 20,
    });
    await assessedValue.create({
      year: 2026,
      sector_1: 200,
      residential_medium: 1200,
    });

    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        applicant_name: "Requerente de teste",
        purpose: "Valor venal",
        physical_property_id: physicalPropertyId + 1,
        year: 2026,
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      physical_registration: "25.00003.0165.02",
      land_area: "200.00",
      built_area: "20.00",
      land_value: "40000.00",
      building_value: "24000.00",
      total_value: "64000.00",
    });
  });

  test("Rejeitando contagem de CTM igual a zero", async () => {
    const session = await createSessionWithFeatures([
      "create:certificate",
      "read:certificate",
    ]);
    const property = await createProperty({
      physical_property_id: 987670,
      ctm: "25.00003.0170",
      ctm_count: 0,
      grouping: "I",
    });
    await assessedValue.create({
      year: 2026,
      sector_1: 200,
      residential_medium: 1200,
    });

    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        applicant_name: "Requerente de teste",
        purpose: "Valor venal",
        physical_property_id: property.physical_property_id,
        year: 2026,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: expect.stringContaining("25.00003.0170"),
    });
  });

  test.each([
    ["25.00003.0171", "A", "A"],
    ["25.00003.0172", "A", "P"],
    ["25.00003.0173", "P", "P"],
    ["25.00003.0174", "I", "A"],
  ])(
    "Rejeitando englobamento inválido para o CTM %s",
    async (ctm, mainGrouping, secondGrouping) => {
      const session = await createSessionWithFeatures([
        "create:certificate",
        "read:certificate",
      ]);
      const physicalPropertyId = 987671 + Number(ctm.slice(-1));
      await createProperty({
        physical_property_id: physicalPropertyId,
        physical_registration: `${ctm}.01`,
        ctm,
        ctm_count: 2,
        grouping: mainGrouping,
      });
      await createProperty({
        physical_property_id: physicalPropertyId + 1,
        physical_registration: `${ctm}.02`,
        ctm,
        ctm_count: 2,
        grouping: secondGrouping,
      });
      await assessedValue.create({
        year: 2026,
        sector_1: 200,
        residential_medium: 1200,
      });

      const response = await fetch(collectionEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({
          applicant_name: "Requerente de teste",
          purpose: "Valor venal",
          physical_property_id: physicalPropertyId,
          year: 2026,
        }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        message: expect.stringContaining(ctm),
      });
    },
  );

  test("Rejeitando contagens divergentes entre cadastros do mesmo CTM", async () => {
    const session = await createSessionWithFeatures([
      "create:certificate",
      "read:certificate",
    ]);
    const physicalPropertyId = 987676;
    const ctm = "25.00003.0175";
    await createProperty({
      physical_property_id: physicalPropertyId,
      physical_registration: `${ctm}.01`,
      ctm,
      ctm_count: 2,
      grouping: "P",
    });
    await createProperty({
      physical_property_id: physicalPropertyId + 1,
      physical_registration: `${ctm}.02`,
      ctm,
      ctm_count: 3,
      grouping: "A",
    });
    await assessedValue.create({
      year: 2026,
      sector_1: 200,
      residential_medium: 1200,
    });

    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        applicant_name: "Requerente de teste",
        purpose: "Valor venal",
        physical_property_id: physicalPropertyId,
        year: 2026,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: expect.stringContaining(ctm),
    });
  });

  test("Rejeitando mistura de I com P ou A no mesmo CTM", async () => {
    const session = await createSessionWithFeatures([
      "create:certificate",
      "read:certificate",
    ]);
    const physicalPropertyId = 987667;
    await createProperty({
      physical_property_id: physicalPropertyId,
      physical_registration: "25.00003.0164.01",
      ctm: "25.00003.0164",
      ctm_count: 2,
      grouping: "P",
    });
    await createProperty({
      physical_property_id: physicalPropertyId + 1,
      physical_registration: "25.00003.0164.02",
      ctm: "25.00003.0164",
      ctm_count: 2,
      grouping: "I",
    });
    await assessedValue.create({
      year: 2026,
      sector_1: 200,
      residential_medium: 1200,
    });

    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        applicant_name: "Requerente de teste",
        purpose: "Valor venal",
        physical_property_id: physicalPropertyId,
        year: 2026,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: expect.stringContaining("25.00003.0164"),
    });
  });

  test("Usando o cadastro físico atual sem alterar o exercício solicitado", async () => {
    const session = await createSessionWithFeatures([
      "create:certificate",
      "read:certificate",
    ]);
    const property = await createProperty();
    await assessedValue.create({
      year: 2024,
      sector_1: 100,
      residential_medium: 500,
    });
    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        applicant_name: "Requerente de teste",
        purpose: "Valor venal",
        physical_property_id: property.physical_property_id,
        year: 2024,
        observations: "Certidão emitida para teste.",
      }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      year: 2024,
      physical_property_id: property.physical_property_id,
      land_value: "25000.00",
      building_value: "50000.00",
      total_value: "75000.00",
    });
  });

  test("Rejeitando criação sem a feature correspondente", async () => {
    const session = await createSessionWithFeatures(["read:certificate"]);
    const property = await createProperty();
    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        applicant_name: "Requerente",
        purpose: "Valor venal",
        physical_property_id: property.physical_property_id,
        physical_registration: property.physical_registration,
        owner_name: property.owner_name,
        promissory_buyer: property.promissory_buyer,
        property_street: property.property_street,
        property_neighborhood: property.property_neighborhood,
        land_area: 250,
        built_area: 100,
        land_value: 50000,
        building_value: 120000,
        total_value: 170000,
        observations: "Certidão emitida para teste.",
      }),
    });
    expect(response.status).toBe(403);
  });
});

describe("GET, PATCH e DELETE /api/v1/certificates/[id]", () => {
  test("Consultando uma certidão", async () => {
    const session = await createSessionWithFeatures(["read:certificate"]);
    const record = await createCertificate();
    const response = await fetch(itemEndpoint(record.id), {
      headers: { Cookie: `session_id=${session.token}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: record.id,
      applicant_name: "Requerente de teste",
    });
  });

  test("Atualizando uma única certidão", async () => {
    const session = await createSessionWithFeatures([
      "update:certificate",
      "read:certificate",
    ]);
    const record = await createCertificate({}, session.userId);
    const response = await fetch(itemEndpoint(record.id), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({ applicant_name: "Requerente atualizado" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: record.id,
      applicant_name: "Requerente atualizado",
    });
  });

  test("Atualizando e limpando número e ano opcionais do protocolo", async () => {
    const session = await createSessionWithFeatures([
      "update:certificate",
      "read:certificate",
    ]);
    const record = await createCertificate({}, session.userId);

    const updateResponse = await fetch(itemEndpoint(record.id), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        protocol_number: 456,
        protocol_year: 2026,
      }),
    });

    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toMatchObject({
      protocol_number: 456,
      protocol_year: 2026,
    });

    const clearResponse = await fetch(itemEndpoint(record.id), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        protocol_number: null,
        protocol_year: null,
      }),
    });

    expect(clearResponse.status).toBe(200);
    expect(await clearResponse.json()).toMatchObject({
      protocol_number: null,
      protocol_year: null,
    });
  });

  test("Excluindo logicamente uma única certidão", async () => {
    const session = await createSessionWithFeatures([
      "delete:certificate",
      "read:certificate",
    ]);
    const record = await createCertificate();
    const response = await fetch(itemEndpoint(record.id), {
      method: "DELETE",
      headers: { Cookie: `session_id=${session.token}` },
    });
    expect(response.status).toBe(200);
    await expect(certificate.findOneById(record.id)).rejects.toThrow(
      "A certidão informada não foi encontrada.",
    );
  });
});
