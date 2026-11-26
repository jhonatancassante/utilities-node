import orchestrator from "tests/orchestrator.js";
import database from "@/infra/database.js";
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

function endpoint(id) {
  return `${orchestrator.API_URL}/admin/assessed-values/${id}`;
}

async function createRecord(overrides = {}) {
  return await assessedValue.create({
    year: 2028,
    decree: "98765",
    sector_1: 100,
    ...overrides,
  });
}

describe("GET /api/v1/admin/assessed-values/[id]", () => {
  test("Rejeitando usuário sem a feature correspondente", async () => {
    const sessionObject = await createSessionWithFeatures([]);
    const record = await createRecord();
    const response = await fetch(endpoint(record.id), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(403);
  });

  test("Consultando registro com saída filtrada", async () => {
    const sessionObject = await createSessionWithFeatures([
      "read:assessed_value",
    ]);
    const record = await createRecord();
    const response = await fetch(endpoint(record.id), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      id: record.id,
      year: 2028,
      decree: "98765",
      sector_1: "100.00",
    });
    expect(body).not.toHaveProperty("deleted_at");
  });

  test("Retornando 404 para registro inexistente", async () => {
    const sessionObject = await createSessionWithFeatures([
      "read:assessed_value",
    ]);
    const response = await fetch(
      endpoint("99999999-9999-4999-8999-999999999999"),
      {
        headers: { Cookie: `session_id=${sessionObject.token}` },
      },
    );
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/admin/assessed-values/[id]", () => {
  test("Rejeitando usuário sem a feature correspondente", async () => {
    const sessionObject = await createSessionWithFeatures([
      "read:assessed_value",
    ]);
    const record = await createRecord();
    const response = await fetch(endpoint(record.id), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({ sector_1: 200 }),
    });
    expect(response.status).toBe(403);
  });

  test("Atualizando registro", async () => {
    const sessionObject = await createSessionWithFeatures([
      "update:assessed_value",
      "read:assessed_value",
    ]);
    const record = await createRecord();
    const response = await fetch(endpoint(record.id), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({ year: 2029, decree: null, sector_1: 250.25 }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: record.id,
      year: 2029,
      decree: null,
      sector_1: "250.25",
    });
  });

  test("Rejeitando atualização sem campos", async () => {
    const sessionObject = await createSessionWithFeatures([
      "update:assessed_value",
      "read:assessed_value",
    ]);
    const record = await createRecord();
    const response = await fetch(endpoint(record.id), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      name: "ValidationError",
      message: "Nenhum dado foi informado para atualização.",
    });
  });
});

describe("DELETE /api/v1/admin/assessed-values/[id]", () => {
  test("Rejeitando usuário sem a feature correspondente", async () => {
    const sessionObject = await createSessionWithFeatures([
      "read:assessed_value",
    ]);
    const record = await createRecord();
    const response = await fetch(endpoint(record.id), {
      method: "DELETE",
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(403);
  });

  test("Excluindo logicamente sem remover a linha do banco", async () => {
    const sessionObject = await createSessionWithFeatures([
      "delete:assessed_value",
      "read:assessed_value",
    ]);
    const record = await createRecord();
    const response = await fetch(endpoint(record.id), {
      method: "DELETE",
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: record.id, year: 2028 });
    await expect(assessedValue.findOneById(record.id)).rejects.toThrow(
      "O registro de valores venais informado não foi encontrado.",
    );
    const result = await database.query({
      text: "SELECT deleted_at FROM assessed_values WHERE id = $1;",
      values: [record.id],
    });
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].deleted_at).not.toBeNull();
  });
});
