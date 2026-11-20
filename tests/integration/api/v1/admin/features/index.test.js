import orchestrator from "tests/orchestrator.js";
import { protectedFeatures } from "@/configs/features.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function createPrivilegedSession(features = protectedFeatures) {
  const privilegedUser = await orchestrator.createUser();
  await orchestrator.activateUser(privilegedUser);
  await orchestrator.addFeaturesToUser(privilegedUser, [
    ...features,
    "read:session",
  ]);
  const sessionObject = await orchestrator.createSession(privilegedUser);
  return { privilegedUser, sessionObject };
}

function featuresUrl() {
  return `${orchestrator.API_URL}/admin/features`;
}

describe("GET /api/v1/admin/features", () => {
  describe("Usuário anônimo", () => {
    test("Consultando as features", async () => {
      const response = await fetch(featuresUrl());

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action:
          'Verifique se o seu usuário possui a feature "read:feature".',
        status_code: 403,
      });
    });
  });

  describe("Usuário padrão", () => {
    test("Consultando as features", async () => {
      const standardUser = await orchestrator.createUser();
      await orchestrator.activateUser(standardUser);
      const sessionObject = await orchestrator.createSession(standardUser);

      const response = await fetch(featuresUrl(), {
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });

      expect(response.status).toBe(403);
    });
  });

  describe("Usuário privilegiado", () => {
    test("Consultando as features ativas sem expor dados internos", async () => {
      const { sessionObject } = await createPrivilegedSession();

      const response = await fetch(featuresUrl(), {
        headers: { Cookie: `session_id=${sessionObject.token}` },
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();

      expect(responseBody.length).toBeGreaterThan(0);
      expect(responseBody).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "create:feature",
            label: "Criar feature",
            group_name: "Privilégios",
            is_removable: true,
            is_privileged: true,
            is_protected: true,
          }),
        ]),
      );
      expect(responseBody[0]).not.toHaveProperty("deleted_at");
      expect(responseBody[0]).not.toHaveProperty("password");
      expect(Date.parse(responseBody[0].created_at)).not.toBeNaN();
      expect(Date.parse(responseBody[0].updated_at)).not.toBeNaN();
    });
  });
});

describe("POST /api/v1/admin/features", () => {
  const featureInput = {
    name: "read:reports",
    label: "Consultar relatórios",
    group_name: "Relatórios",
    description: "Permite consultar relatórios.",
  };

  describe("Usuário anônimo", () => {
    test("Cadastrando uma feature", async () => {
      const response = await fetch(featuresUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(featureInput),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("Usuário padrão", () => {
    test("Cadastrando uma feature", async () => {
      const standardUser = await orchestrator.createUser();
      await orchestrator.activateUser(standardUser);
      const sessionObject = await orchestrator.createSession(standardUser);

      const response = await fetch(featuresUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify(featureInput),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("Usuário privilegiado", () => {
    test("Cadastrando uma feature com flags padrão", async () => {
      const { sessionObject } = await createPrivilegedSession();

      const response = await fetch(featuresUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify(featureInput),
      });

      expect(response.status).toBe(201);
      const responseBody = await response.json();

      expect(responseBody).toMatchObject({
        ...featureInput,
        is_removable: true,
        is_privileged: false,
        is_protected: false,
      });
      expect(responseBody.id).toBeDefined();
      expect(responseBody).not.toHaveProperty("deleted_at");
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
    });

    test("Rejeitando o cadastro de uma feature com nome duplicado", async () => {
      const { sessionObject } = await createPrivilegedSession();

      const firstResponse = await fetch(featuresUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({ ...featureInput, name: "read:duplicatereports" }),
      });
      expect(firstResponse.status).toBe(201);

      const response = await fetch(featuresUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({ ...featureInput, name: "read:duplicatereports" }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        name: "ValidationError",
        message: "Já existe uma feature cadastrada com este nome.",
      });
    });

    test("Rejeitando dados inválidos", async () => {
      const { sessionObject } = await createPrivilegedSession();

      const response = await fetch(featuresUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObject.token}`,
        },
        body: JSON.stringify({ ...featureInput, name: "Read:invalidreports" }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        name: "ValidationError",
        message: "O nome da feature possui um formato inválido.",
      });
    });
  });
});
