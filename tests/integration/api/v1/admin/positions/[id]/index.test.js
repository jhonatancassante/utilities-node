import { randomUUID } from "node:crypto";
import orchestrator from "tests/orchestrator.js";
import database from "@/infra/database.js";
import position from "@/models/position.js";

function uniquePositionName() {
  return `Cargo ${randomUUID()}`;
}

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
  return `${orchestrator.API_URL}/admin/positions/${id}`;
}

describe("GET /api/v1/admin/positions/[id]", () => {
  test("Rejeitando usuário sem a feature correspondente", async () => {
    const sessionObject = await createSessionWithFeatures([]);
    const record = await position.create({ name: uniquePositionName() });
    const response = await fetch(endpoint(record.id), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(403);
  });

  test("Consultando cargo com saída filtrada", async () => {
    const sessionObject = await createSessionWithFeatures(["read:position"]);
    const record = await position.create({ name: uniquePositionName() });
    const response = await fetch(endpoint(record.id), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ id: record.id, name: record.name });
    expect(body).not.toHaveProperty("deleted_at");
  });

  test("Retornando 404 para cargo inexistente", async () => {
    const sessionObject = await createSessionWithFeatures(["read:position"]);
    const response = await fetch(
      endpoint("99999999-9999-4999-8999-999999999999"),
      {
        headers: { Cookie: `session_id=${sessionObject.token}` },
      },
    );
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/admin/positions/[id]", () => {
  test("Rejeitando usuário sem a feature correspondente", async () => {
    const sessionObject = await createSessionWithFeatures(["read:position"]);
    const record = await position.create({ name: uniquePositionName() });
    const response = await fetch(endpoint(record.id), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({ name: "Analista Administrativo" }),
    });
    expect(response.status).toBe(403);
  });

  test("Atualizando cargo com apenas a feature de atualização", async () => {
    const sessionObject = await createSessionWithFeatures(["update:position"]);
    const record = await position.create({ name: uniquePositionName() });
    const response = await fetch(endpoint(record.id), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({ name: "Analista Administrativo" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: record.id,
      name: "Analista Administrativo",
    });
  });

  test("Rejeitando atualização sem campos", async () => {
    const sessionObject = await createSessionWithFeatures(["update:position"]);
    const record = await position.create({ name: uniquePositionName() });
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

describe("DELETE /api/v1/admin/positions/[id]", () => {
  test("Rejeitando usuário sem a feature correspondente", async () => {
    const sessionObject = await createSessionWithFeatures(["read:position"]);
    const record = await position.create({ name: uniquePositionName() });
    const response = await fetch(endpoint(record.id), {
      method: "DELETE",
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(403);
  });

  test("Excluindo logicamente com apenas a feature de exclusão", async () => {
    const sessionObject = await createSessionWithFeatures(["delete:position"]);
    const record = await position.create({ name: uniquePositionName() });
    const response = await fetch(endpoint(record.id), {
      method: "DELETE",
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: record.id,
      name: record.name,
    });
    await expect(position.findOneById(record.id)).rejects.toThrow(
      "O cargo informado não foi encontrado.",
    );

    const result = await database.query({
      text: "SELECT deleted_at FROM positions WHERE id = $1;",
      values: [record.id],
    });
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].deleted_at).not.toBeNull();
  });
});
