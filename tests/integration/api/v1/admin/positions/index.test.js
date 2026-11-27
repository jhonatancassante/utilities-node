import { randomUUID } from "node:crypto";
import orchestrator from "tests/orchestrator.js";
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

function endpoint() {
  return `${orchestrator.API_URL}/admin/positions`;
}

describe("GET /api/v1/admin/positions", () => {
  test("Rejeitando usuário sem a feature correspondente", async () => {
    const sessionObject = await createSessionWithFeatures([]);
    const response = await fetch(endpoint(), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(403);
  });

  test("Consultando cargos ativos com saída filtrada", async () => {
    const sessionObject = await createSessionWithFeatures(["read:position"]);
    const created = await position.create({ name: "Escriturário" });
    const deleted = await position.create({ name: "Cargo excluído" });
    await position.delete(deleted.id);

    const response = await fetch(endpoint(), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([
      expect.objectContaining({
        id: created.id,
        name: "Escriturário",
      }),
    ]);
    expect(body[0]).not.toHaveProperty("deleted_at");
    expect(body[0]).not.toHaveProperty("password");
    expect(Date.parse(body[0].created_at)).not.toBeNaN();
    expect(Date.parse(body[0].updated_at)).not.toBeNaN();
  });
});

describe("POST /api/v1/admin/positions", () => {
  test("Rejeitando usuário sem a feature correspondente", async () => {
    const sessionObject = await createSessionWithFeatures(["read:position"]);
    const response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({ name: "Escriturário" }),
    });
    expect(response.status).toBe(403);
  });

  test("Cadastrando cargo com apenas a feature de criação", async () => {
    const sessionObject = await createSessionWithFeatures(["create:position"]);
    const response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({ name: "Fiscal de Tributos" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ name: "Fiscal de Tributos" });
    expect(body.id).toBeDefined();
    expect(body).not.toHaveProperty("deleted_at");
  });

  test("Rejeitando nome duplicado sem diferenciar maiúsculas", async () => {
    const sessionObject = await createSessionWithFeatures(["create:position"]);
    await position.create({ name: "Escriturário" });

    const response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({ name: "escriturário" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      name: "ValidationError",
      message: "Já existe um cargo cadastrado com este nome.",
    });
  });

  test("Rejeitando nome acima de 60 caracteres", async () => {
    const sessionObject = await createSessionWithFeatures(["create:position"]);
    const response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionObject.token}`,
      },
      body: JSON.stringify({ name: "C".repeat(61) }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      name: "ValidationError",
      message: "O campo name deve ser um texto entre 1 e 60 caracteres.",
    });
  });
});
