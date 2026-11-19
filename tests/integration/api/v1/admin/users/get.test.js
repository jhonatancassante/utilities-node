import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/admin/users", () => {
  describe("Usuário anônimo", () => {
    test("Pesquisando usuários", async () => {
      const response = await fetch(
        `${orchestrator.API_URL}/admin/users?search=usuario`,
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
        action:
          'Verifique se o seu usuário possui a feature "update:user:others".',
        status_code: 403,
      });
    });
  });

  describe("Usuário padrão", () => {
    test("Pesquisando usuários", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const sessionObject = await orchestrator.createSession(createdUser);

      const response = await fetch(
        `${orchestrator.API_URL}/admin/users?search=usuario`,
        {
          headers: { Cookie: `session_id=${sessionObject.token}` },
        },
      );

      expect(response.status).toBe(403);
    });
  });

  describe("Usuário privilegiado", () => {
    test("Pesquisando pelo nome de usuário", async () => {
      const privilegedUser = await orchestrator.createUser();
      await orchestrator.activateUser(privilegedUser);
      await orchestrator.addFeaturesToUser(privilegedUser, [
        "update:user:others",
      ]);
      const sessionObject = await orchestrator.createSession(privilegedUser);
      const targetUser = await orchestrator.createUser({
        username: "adminSearchUsername",
        email: "admin-search@example.com",
      });

      const response = await fetch(
        `${orchestrator.API_URL}/admin/users?search=adminSearchUser`,
        {
          headers: { Cookie: `session_id=${sessionObject.token}` },
        },
      );

      expect(response.status).toBe(200);
      const responseBody = await response.json();

      expect(responseBody).toHaveLength(1);
      expect(responseBody[0]).toMatchObject({
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        features: targetUser.features,
      });
      expect(Date.parse(responseBody[0].created_at)).not.toBeNaN();
      expect(Date.parse(responseBody[0].updated_at)).not.toBeNaN();
      expect(responseBody[0]).not.toHaveProperty("password");
    });

    test("Pesquisando pelo e-mail", async () => {
      const privilegedUser = await orchestrator.createUser();
      await orchestrator.activateUser(privilegedUser);
      await orchestrator.addFeaturesToUser(privilegedUser, [
        "update:user:others",
      ]);
      const sessionObject = await orchestrator.createSession(privilegedUser);
      const targetUser = await orchestrator.createUser({
        username: "adminSearchEmail",
        email: "find-this-email@example.com",
      });

      const response = await fetch(
        `${orchestrator.API_URL}/admin/users?search=FIND-THIS-EMAIL`,
        {
          headers: { Cookie: `session_id=${sessionObject.token}` },
        },
      );

      expect(response.status).toBe(200);
      const responseBody = await response.json();

      expect(responseBody).toHaveLength(1);
      expect(responseBody[0].id).toBe(targetUser.id);
      expect(responseBody[0].email).toBe(targetUser.email);
    });

    test("Não inclui a própria conta nos resultados", async () => {
      const privilegedUser = await orchestrator.createUser({
        username: "privilegedSearchSelf",
      });
      await orchestrator.activateUser(privilegedUser);
      await orchestrator.addFeaturesToUser(privilegedUser, [
        "update:user:others",
      ]);
      const sessionObject = await orchestrator.createSession(privilegedUser);

      const response = await fetch(
        `${orchestrator.API_URL}/admin/users?search=privilegedSearchSelf`,
        {
          headers: { Cookie: `session_id=${sessionObject.token}` },
        },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    });

    test("Com termo de pesquisa menor que dois caracteres", async () => {
      const privilegedUser = await orchestrator.createUser();
      await orchestrator.activateUser(privilegedUser);
      await orchestrator.addFeaturesToUser(privilegedUser, [
        "update:user:others",
      ]);
      const sessionObject = await orchestrator.createSession(privilegedUser);

      const response = await fetch(
        `${orchestrator.API_URL}/admin/users?search=a`,
        {
          headers: { Cookie: `session_id=${sessionObject.token}` },
        },
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        name: "ValidationError",
        message: "Informe ao menos dois caracteres para pesquisar um usuário.",
        action: "Pesquise pelo nome de usuário ou pelo e-mail.",
        status_code: 400,
      });
    });
  });
});
