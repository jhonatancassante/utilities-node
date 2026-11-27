import orchestrator from "tests/orchestrator.js";
import position from "@/models/position.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

const endpoint = () => `${orchestrator.API_URL}/admin/users/positions`;

describe("GET /api/v1/admin/users/positions", () => {
  test("Rejeita usuário sem update:user:others", async () => {
    const testUser = await orchestrator.createUser();
    await orchestrator.activateUser(testUser);
    const sessionObject = await orchestrator.createSession(testUser);
    const response = await fetch(endpoint(), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(403);
  });

  test("Retorna somente nomes de cargos ativos", async () => {
    const testUser = await orchestrator.createUser();
    await orchestrator.activateUser(testUser);
    await orchestrator.addFeaturesToUser(testUser, ["update:user:others"]);
    const sessionObject = await orchestrator.createSession(testUser);
    const active = await position.create({ name: "Escriturário" });
    const deleted = await position.create({ name: "Cargo excluído" });
    await position.delete(deleted.id);
    const response = await fetch(endpoint(), {
      headers: { Cookie: `session_id=${sessionObject.token}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ name: active.name }]);
  });
});
