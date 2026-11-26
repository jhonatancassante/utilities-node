import orchestrator from "tests/orchestrator.js";
import certificate from "@/models/certificate.js";
import realEstateProperty from "@/models/real-estate-property.js";
import assessedValue from "@/models/assessed-value.js";

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
    grouping: "A",
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
  });

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
        physical_registration: `25.00003.0163.${suffix}`,
        ctm: "25.00003.0163",
        ctm_count: 5,
        land_area: suffix === "01" ? 1000 : 999,
        built_area: 10,
        ideal_fraction: 0.1,
        owner_name: suffix === "01" ? "Proprietário principal" : `Proprietário ${suffix}`,
        promissory_buyer: null,
        property_street: suffix === "01" ? "Rua do cadastro principal" : `Rua ${suffix}`,
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
      physical_registration: "25.00003.0163.01/02/03/04/05",
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
