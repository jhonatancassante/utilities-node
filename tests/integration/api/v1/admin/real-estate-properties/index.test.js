import orchestrator from "tests/orchestrator.js";
import database from "@/infra/database.js";
import realEstateProperty from "@/models/real-estate-property.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function createSessionWithFeatures(features) {
  const testUser = await orchestrator.createUser();
  await orchestrator.activateUser(testUser);
  if (features.length > 0)
    await orchestrator.addFeaturesToUser(testUser, features);
  return await orchestrator.createSession(testUser);
}

function collectionEndpoint() {
  return `${orchestrator.API_URL}/admin/real-estate-properties`;
}

function itemEndpoint(id) {
  return collectionEndpoint() + "/" + id;
}

function bulkEndpoint() {
  return collectionEndpoint() + "/bulk";
}

function createPropertyInput(overrides = {}) {
  return {
    year: 2026,
    physical_property_id: 12345,
    physical_registration: "001.002.003",
    ctm: "01.002.003.0001",
    ctm_count: 1,
    grouping: "A",
    land_area: 250.5,
    built_area: 100,
    property_neighborhood: "Centro",
    owner_name: "Proprietário de teste",
    land_sector: 1,
    property_street: "Rua de Teste",
    ...overrides,
  };
}

describe("GET /api/v1/admin/real-estate-properties", () => {
  test("Rejeitando usuário sem a feature correspondente", async () => {
    const sessionObject = await createSessionWithFeatures([]);
    const response = await fetch(collectionEndpoint(), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(403);
  });

  test("Consultando imóveis ativos com saída filtrada", async () => {
    const sessionObject = await createSessionWithFeatures([
      "read:real_estate_properties",
    ]);
    const created = await realEstateProperty.create(createPropertyInput());
    const removed = await realEstateProperty.create(
      createPropertyInput({
        physical_property_id: 12346,
        physical_registration: "001.002.004",
        ctm: "01.002.004.0001",
      }),
    );
    await realEstateProperty.delete(removed.id);

    const response = await fetch(collectionEndpoint(), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.map((item) => item.id)).toContain(created.id);
    expect(body.map((item) => item.id)).not.toContain(removed.id);
    expect(body[0]).not.toHaveProperty("deleted_at");
    expect(body[0]).toHaveProperty("physical_registration");
  });
});

describe("POST /api/v1/admin/real-estate-properties", () => {
  test("Cadastrando imóvel e filtrando a resposta", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:real_estate_properties",
      "read:real_estate_properties",
    ]);
    const input = createPropertyInput();
    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify(input),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      ...input,
      land_area: "250.50",
      built_area: "100.00",
    });
    expect(body.id).toBeDefined();
    expect(body).not.toHaveProperty("deleted_at");
  });

  test("Rejeitando cadastro sem campo obrigatório", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:real_estate_properties",
      "read:real_estate_properties",
    ]);
    const input = createPropertyInput();
    delete input.owner_name;
    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify(input),
    });
    expect(response.status).toBe(400);
  });
});

describe("GET, PATCH e DELETE /api/v1/admin/real-estate-properties/[id]", () => {
  test("Consultando um imóvel", async () => {
    const sessionObject = await createSessionWithFeatures([
      "read:real_estate_properties",
    ]);
    const record = await realEstateProperty.create(createPropertyInput());
    const response = await fetch(itemEndpoint(record.id), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: record.id,
      physical_registration: "001.002.003",
    });
  });

  test("Atualizando um imóvel", async () => {
    const sessionObject = await createSessionWithFeatures([
      "update:real_estate_properties",
      "read:real_estate_properties",
    ]);
    const record = await realEstateProperty.create(createPropertyInput());
    const response = await fetch(itemEndpoint(record.id), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({
        owner_name: "Novo proprietário",
        built_area: 125.75,
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: record.id,
      owner_name: "Novo proprietário",
      built_area: "125.75",
    });
  });

  test("Excluindo logicamente um imóvel", async () => {
    const sessionObject = await createSessionWithFeatures([
      "delete:real_estate_properties",
      "read:real_estate_properties",
    ]);
    const record = await realEstateProperty.create(createPropertyInput());
    const response = await fetch(itemEndpoint(record.id), {
      method: "DELETE",
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(200);
    await expect(realEstateProperty.findOneById(record.id)).rejects.toThrow(
      "O imóvel informado não foi encontrado.",
    );
    const result = await database.query({
      text: "SELECT deleted_at FROM real_estate_properties WHERE id = $1;",
      values: [record.id],
    });
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].deleted_at).not.toBeNull();
  });
});

describe("POST e DELETE /api/v1/admin/real-estate-properties/bulk", () => {
  test("Cadastrando imóveis em lote", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:real_estate_properties",
      "read:real_estate_properties",
    ]);
    const records = [
      createPropertyInput({
        physical_property_id: 20001,
        physical_registration: "002.001",
        ctm: "02.001",
      }),
      createPropertyInput({
        physical_property_id: 20002,
        physical_registration: "002.002",
        ctm: "02.002",
      }),
    ];
    const response = await fetch(bulkEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({ records }),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toHaveLength(2);
    expect(body.map((item) => item.physical_property_id)).toEqual([
      20001, 20002,
    ]);
    expect(body.every((item) => !("deleted_at" in item))).toBe(true);
  });

  test("Excluindo vários imóveis em uma única operação", async () => {
    const sessionObject = await createSessionWithFeatures([
      "delete:real_estate_properties",
      "read:real_estate_properties",
    ]);
    const records = await realEstateProperty.createMany([
      createPropertyInput({
        physical_property_id: 30001,
        physical_registration: "003.001",
        ctm: "03.001",
      }),
      createPropertyInput({
        physical_property_id: 30002,
        physical_registration: "003.002",
        ctm: "03.002",
      }),
    ]);
    const response = await fetch(bulkEndpoint(), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({ ids: records.map((record) => record.id) }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(2);
    for (const record of records) {
      await expect(realEstateProperty.findOneById(record.id)).rejects.toThrow(
        "O imóvel informado não foi encontrado.",
      );
    }
  });
});
