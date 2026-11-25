import orchestrator from "tests/orchestrator.js";
import assessedValue from "@/models/assessed-value.js";

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

function endpoint() {
  return `${orchestrator.API_URL}/admin/assessed-values`;
}

describe("GET /api/v1/admin/assessed-values", () => {
  test("Rejeitando usuário sem a feature correspondente", async () => {
    const sessionObject = await createSessionWithFeatures([]);
    const response = await fetch(endpoint(), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(403);
  });

  test("Consultando registros ativos com saída filtrada", async () => {
    const sessionObject = await createSessionWithFeatures([
      "read:assessed_values",
    ]);
    const created = await assessedValue.create({
      year: 2026,
      decree: "12345",
      sector_1: 123.45,
    });
    const removed = await assessedValue.create({ year: 2025 });
    await assessedValue.delete(removed.id);
    const response = await fetch(endpoint(), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.map((item) => item.id)).not.toContain(removed.id);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.id,
          year: 2026,
          decree: "12345",
          sector_1: "123.45",
        }),
      ]),
    );
    expect(body[0]).not.toHaveProperty("deleted_at");
    expect(Date.parse(body[0].created_at)).not.toBeNaN();
    expect(Date.parse(body[0].updated_at)).not.toBeNaN();
  });
});

describe("POST /api/v1/admin/assessed-values", () => {
  const input = {
    year: 2027,
    decree: "67890",
    sector_1: 150.75,
    residential_regular: 230.5,
  };

  test("Rejeitando usuário sem a feature correspondente", async () => {
    const sessionObject = await createSessionWithFeatures([
      "read:assessed_values",
    ]);
    const response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify(input),
    });
    expect(response.status).toBe(403);
  });

  test("Cadastrando registro e filtrando a resposta", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:assessed_values",
      "read:assessed_values",
    ]);
    const response = await fetch(endpoint(), {
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
      sector_1: "150.75",
      residential_regular: "230.50",
    });
    expect(body.id).toBeDefined();
    expect(body).not.toHaveProperty("deleted_at");
  });

  test("Rejeitando ano inválido", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:assessed_values",
      "read:assessed_values",
    ]);
    const response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({ ...input, year: "2027" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      name: "ValidationError",
      message: "O campo year deve ser um número inteiro entre 1 e 9999.",
    });
  });

  test("Rejeitando valor numérico negativo", async () => {
    const sessionObject = await createSessionWithFeatures([
      "create:assessed_values",
      "read:assessed_values",
    ]);
    const response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({ ...input, sector_1: -1 }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      name: "ValidationError",
      message:
        "O campo sector_1 deve ser um número não negativo com até duas casas decimais ou nulo.",
    });
  });
});
