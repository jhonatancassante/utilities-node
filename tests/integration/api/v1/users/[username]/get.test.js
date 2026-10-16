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
      const response1 = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "MesmoCase",
          email: "MesmoCase@jhonatancassante.com.br",
          password: "senha123",
        }),
      });
      expect(response1.status).toBe(201);

      const response2 = await fetch(
        "http://localhost:3000/api/v1/users/MesmoCase",
      );
      expect(response2.status).toBe(200);

      const response2Body = await response2.json();

      expect(response2Body).toEqual({
        id: response2Body.id,
        username: "MesmoCase",
        email: "MesmoCase@jhonatancassante.com.br",
        password: response2Body.password,
        createdAt: response2Body.createdAt,
        updatedAt: response2Body.updatedAt,
      });

      expect(uuidVersion(response2Body.id)).toBe(4);
      expect(Date.parse(response2Body.createdAt)).not.toBeNaN();
      expect(Date.parse(response2Body.updatedAt)).not.toBeNaN();
    });

    test("Com 'case mismatch'", async () => {
      const response1 = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "CaseDiferente",
          email: "CaseDiferente@jhonatancassante.com.br",
          password: "senha123",
        }),
      });
      expect(response1.status).toBe(201);

      const response2 = await fetch(
        "http://localhost:3000/api/v1/users/casediferente",
      );
      expect(response2.status).toBe(200);

      const response2Body = await response2.json();

      expect(response2Body).toEqual({
        id: response2Body.id,
        username: "CaseDiferente",
        email: "CaseDiferente@jhonatancassante.com.br",
        password: response2Body.password,
        createdAt: response2Body.createdAt,
        updatedAt: response2Body.updatedAt,
      });

      expect(uuidVersion(response2Body.id)).toBe(4);
      expect(Date.parse(response2Body.createdAt)).not.toBeNaN();
      expect(Date.parse(response2Body.updatedAt)).not.toBeNaN();
    });

    test("Com usuário inexistente", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/users/UsuarioInexistente",
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
