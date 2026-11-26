import orchestrator from "tests/orchestrator.js";
import certificate from "@/models/certificate.js";
import realEstateProperty from "@/models/real-estate-property.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function createSessionWithFeatures(features) {
  const testUser = await orchestrator.createUser();
  await orchestrator.activateUser(testUser);
  if (features.length) await orchestrator.addFeaturesToUser(testUser, features);
  return orchestrator.createSession(testUser);
}

async function createProperty() {
  return realEstateProperty.create({
    year: 2026,
    physical_property_id: 987654,
    physical_registration: "001.002.003",
    ctm: "01.002.003.0001",
    ctm_count: 1,
    grouping: "A",
    land_area: 250,
    built_area: 100,
    property_neighborhood: "Centro",
    owner_name: "Proprietário de teste",
    land_sector: 1,
    property_street: "Rua de Teste",
  });
}

function collectionEndpoint() {
  return `${orchestrator.API_URL}/certificates`;
}

function itemEndpoint(id) {
  return `${collectionEndpoint()}/${id}`;
}

async function createCertificate(overrides = {}) {
  const property = await createProperty();
  return certificate.create({
    protocol_number: "123",
    protocol_year: 2026,
    applicant_name: "Requerente de teste",
    purpose: "Valor venal",
    real_estate_property_id: property.id,
    property_number: 123,
    ...overrides,
  });
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
    const session = await createSessionWithFeatures(["read:certificates"]);
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
      "create:certificates",
      "read:certificates",
    ]);
    const property = await createProperty();
    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        protocol_number: "456",
        protocol_year: 2026,
        applicant_name: "Novo requerente",
        purpose: "Valor venal",
        real_estate_property_id: property.id,
        property_number: 456,
      }),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      protocol_number: "456",
      protocol_year: 2026,
      applicant_name: "Novo requerente",
      validity_days: 30,
      is_updated: true,
    });
    expect(body).not.toHaveProperty("deleted_at");
  });

  test("Rejeitando criação sem a feature correspondente", async () => {
    const session = await createSessionWithFeatures(["read:certificates"]);
    const property = await createProperty();
    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({
        protocol_number: "789",
        protocol_year: 2026,
        applicant_name: "Requerente",
        purpose: "Valor venal",
        real_estate_property_id: property.id,
        property_number: 789,
      }),
    });
    expect(response.status).toBe(403);
  });
});

describe("GET, PATCH e DELETE /api/v1/certificates/[id]", () => {
  test("Consultando uma certidão", async () => {
    const session = await createSessionWithFeatures(["read:certificates"]);
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
      "update:certificates",
      "read:certificates",
    ]);
    const record = await createCertificate();
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
      "delete:certificates",
      "read:certificates",
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
