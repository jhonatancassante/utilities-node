import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/users/[username]", () => {
  describe("Usuário anônimo", () => {
    test("Com exato 'case match'", async () => {
      await orchestrator.createUser({
        username: "MesmoCase",
        email: "MesmoCase@jhonatancassante.com.br",
        password: "senha123",
      });

      const response2 = await fetch(`${orchestrator.API_URL}/users/MesmoCase`);
      expect(response2.status).toBe(200);

      const response2Body = await response2.json();

      expect(response2Body).toEqual({
        id: response2Body.id,
        username: "MesmoCase",
        email: "MesmoCase@jhonatancassante.com.br",
        password: response2Body.password,
        created_at: response2Body.created_at,
        updated_at: response2Body.updated_at,
      });

      expect(uuidVersion(response2Body.id)).toBe(4);
      expect(Date.parse(response2Body.created_at)).not.toBeNaN();
      expect(Date.parse(response2Body.updated_at)).not.toBeNaN();
    });

    test("Com 'case mismatch'", async () => {
      await orchestrator.createUser({
        username: "CaseDiferente",
        email: "CaseDiferente@jhonatancassante.com.br",
        password: "senha123",
      });

      const response2 = await fetch(
        `${orchestrator.API_URL}/users/casediferente`,
      );
      expect(response2.status).toBe(200);

      const response2Body = await response2.json();

      expect(response2Body).toEqual({
        id: response2Body.id,
        username: "CaseDiferente",
        email: "CaseDiferente@jhonatancassante.com.br",
        password: response2Body.password,
        created_at: response2Body.created_at,
        updated_at: response2Body.updated_at,
      });

      expect(uuidVersion(response2Body.id)).toBe(4);
      expect(Date.parse(response2Body.created_at)).not.toBeNaN();
      expect(Date.parse(response2Body.updated_at)).not.toBeNaN();
    });

    test("Com usuário inexistente", async () => {
      const response = await fetch(
        `${orchestrator.API_URL}/users/UsuarioInexistente`,
      );
      expect(response.status).toBe(404);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "NotFoundError",
        message: "O nome de usuário informado não foi encontrado no sistema.",
        action:
          "Verifique se digitou o nome de usuário corretamente e tente novamente.",
        status_code: 404,
      });
    });
  });
});
