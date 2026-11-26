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
    land_sector: "1",
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
      "read:real_estate_property",
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
      "create:real_estate_property",
      "read:real_estate_property",
    ]);
    const input = createPropertyInput({ land_sector: "0001" });
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

  test("Normalizando o CTM para o formato 12.12345.1234", async () => {
    const record = await realEstateProperty.create(
      createPropertyInput({
        physical_property_id: 12348,
        ctm: "13.005.640.228",
      }),
    );
    expect(record.ctm).toBe("13.00564.0228");
  });

  test("Preenchendo a fração ideal com a área do terreno quando não informada", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:real_estate_property",
      "read:real_estate_property",
    ]);
    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify(
        createPropertyInput({
          physical_property_id: 12347,
          ideal_fraction: null,
          land_area: 375.25,
        }),
      ),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      land_area: "375.25",
      ideal_fraction: "375.25",
    });
  });

  test("Aceitando bairro com até 70 caracteres", async () => {
    const input = createPropertyInput({
      property_neighborhood: "B".repeat(70),
    });
    const record = await realEstateProperty.create(input);
    expect(record.property_neighborhood).toBe("B".repeat(70));
  });

  test("Rejeitando bairro com mais de 70 caracteres", async () => {
    await expect(
      realEstateProperty.create(
        createPropertyInput({
          property_neighborhood: "B".repeat(71),
        }),
      ),
    ).rejects.toThrow(
      "O campo property_neighborhood deve ser um texto válido de até 70 caracteres.",
    );
  });

  test("Rejeitando cadastro sem campo obrigatório", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:real_estate_property",
      "read:real_estate_property",
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
      "read:real_estate_property",
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
      "update:real_estate_property",
      "read:real_estate_property",
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
      "delete:real_estate_property",
      "read:real_estate_property",
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

describe("Regras de cadastro atualizado e anual", () => {
  test("Atualizando o cadastro annual=false pelo código físico", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:real_estate_property",
      "read:real_estate_property",
    ]);
    const first = await realEstateProperty.create(
      createPropertyInput({ physical_property_id: 41001, annual: false }),
    );
    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify(
        createPropertyInput({
          physical_property_id: 41001,
          year: 2027,
          owner_name: "Proprietário atualizado",
          annual: false,
        }),
      ),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBe(first.id);
    expect(body.year).toBe(2027);
    expect(body.owner_name).toBe("Proprietário atualizado");
  });

  test("Rejeitando cadastro annual=true quando o código físico e o ano já existem", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:real_estate_property",
      "read:real_estate_property",
    ]);
    await realEstateProperty.create(
      createPropertyInput({ physical_property_id: 41002, annual: true }),
    );
    const response = await fetch(collectionEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify(
        createPropertyInput({
          physical_property_id: 41002,
          year: 2026,
          annual: true,
        }),
      ),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      name: "ConflictError",
    });
  });

  test("Excluindo fisicamente todos os annual=false antes da importação em lote", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:real_estate_property",
      "read:real_estate_property",
    ]);
    const previousCurrent = await realEstateProperty.create(
      createPropertyInput({ physical_property_id: 41003, annual: false }),
    );
    const annualRecord = await realEstateProperty.create(
      createPropertyInput({ physical_property_id: 41004, annual: true }),
    );
    const response = await fetch(bulkEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({
        records: [
          createPropertyInput({
            physical_property_id: 41005,
            annual: false,
          }),
        ],
      }),
    });
    expect(response.status).toBe(201);
    const deleted = await database.query({
      text: "SELECT id FROM real_estate_properties WHERE id = $1;",
      values: [previousCurrent.id],
    });
    expect(deleted.rowCount).toBe(0);
    await expect(
      realEstateProperty.findOneById(annualRecord.id),
    ).resolves.toBeDefined();
  });

  test("Solicitando confirmação e atualizando annual=true em lote", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:real_estate_property",
      "read:real_estate_property",
    ]);
    const existing = await realEstateProperty.create(
      createPropertyInput({
        physical_property_id: 41006,
        annual: true,
      }),
    );
    const records = [
      createPropertyInput({
        physical_property_id: 41006,
        owner_name: "Proprietário substituído",
        annual: true,
      }),
      createPropertyInput({
        physical_property_id: 41007,
        annual: true,
      }),
    ];
    const headers = {
      "Content-Type": "application/json",
      Cookie: `session_id=${sessionObject.token}`,
    };
    const firstResponse = await fetch(bulkEndpoint(), {
      method: "POST",
      headers,
      body: JSON.stringify({ records }),
    });
    expect(firstResponse.status).toBe(409);
    const confirmedResponse = await fetch(bulkEndpoint(), {
      method: "POST",
      headers,
      body: JSON.stringify({ records, overwriteExisting: true }),
    });
    expect(confirmedResponse.status).toBe(201);
    const body = await confirmedResponse.json();
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe(existing.id);
    expect(body[0].owner_name).toBe("Proprietário substituído");
    expect(body.map((record) => record.physical_property_id)).toEqual([
      41006, 41007,
    ]);
  });
});

describe("POST e DELETE /api/v1/admin/real-estate-properties/bulk", () => {
  test("Cadastrando imóveis em lote", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:real_estate_property",
      "read:real_estate_property",
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

  test("Preenchendo a fração ideal com a área do terreno na importação em lote", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:real_estate_property",
      "read:real_estate_property",
    ]);
    const response = await fetch(bulkEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({
        records: [
          createPropertyInput({
            physical_property_id: 20003,
            physical_registration: "002.003",
            ctm: "02.003",
            land_area: 420,
            ideal_fraction: null,
          }),
        ],
      }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject([
      { land_area: "420.00", ideal_fraction: "420.00" },
    ]);
  });

  test("Excluindo vários imóveis em uma única operação", async () => {
    const sessionObject = await createSessionWithFeatures([
      "delete:real_estate_property",
      "read:real_estate_property",
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
