import orchestrator from "tests/orchestrator.js";
import database from "@/infra/database.js";
import user from "@/models/user.js";
import feature from "@/models/feature.js";
import session from "@/models/session.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

function adminUserUrl(username) {
  return orchestrator.API_URL + "/admin/users/" + username;
}

function adminUserBanUrl(username) {
  return adminUserUrl(username) + "/ban";
}

async function createPrivilegedSession() {
  const protectedFeatures = (await feature.findAll())
    .filter((item) => item.is_protected)
    .map((item) => item.name);
  const privilegedUser = await orchestrator.createUser();
  await orchestrator.activateUser(privilegedUser);
  await orchestrator.addFeaturesToUser(privilegedUser, [
    ...protectedFeatures,
    "create:user",
    "read:session",
    "read:audit",
    "update:user:status",
  ]);
  const sessionObject = await orchestrator.createSession(privilegedUser);
  return { privilegedUser, sessionObject };
}

async function createStatusManagerSession() {
  const statusManager = await orchestrator.createUser();
  await orchestrator.activateUser(statusManager);
  await orchestrator.addFeaturesToUser(statusManager, [
    "update:user:status",
    "read:user:others",
  ]);
  const sessionObject = await orchestrator.createSession(statusManager);
  return { statusManager, sessionObject };
}

async function createLegacyAdminSession() {
  const legacyAdmin = await orchestrator.createUser();
  await orchestrator.activateUser(legacyAdmin);
  await orchestrator.addFeaturesToUser(legacyAdmin, [
    "update:user:others",
    "read:user:others",
  ]);
  const sessionObject = await orchestrator.createSession(legacyAdmin);
  return { legacyAdmin, sessionObject };
}

async function createStandardSession() {
  const standardUser = await orchestrator.createUser();
  await orchestrator.activateUser(standardUser);
  const sessionObject = await orchestrator.createSession(standardUser);
  return { standardUser, sessionObject };
}

describe("POST /api/v1/admin/users/[username]/ban", () => {
  describe("Usuário anônimo", () => {
    test("Tentando banir outro usuário", async () => {
      const targetUser = await orchestrator.createUser();

      const response = await fetch(adminUserBanUrl(targetUser.username), {
        method: "POST",
      });

      expect(response.status).toBe(403);
    });
  });

  describe("Usuário padrão", () => {
    test("Tentando banir outro usuário sem permissões administrativas", async () => {
      const { sessionObject } = await createStandardSession();
      const targetUser = await orchestrator.createUser();

      const response = await fetch(adminUserBanUrl(targetUser.username), {
        method: "POST",
        headers: { Cookie: "session_id=" + sessionObject.token },
      });

      expect(response.status).toBe(403);
    });
  });

  describe("Permissão específica de status", () => {
    test("Não permite banir usando apenas update:user:others", async () => {
      const { sessionObject } = await createLegacyAdminSession();
      const targetUser = await orchestrator.createUser();

      const response = await fetch(adminUserBanUrl(targetUser.username), {
        method: "POST",
        headers: { Cookie: "session_id=" + sessionObject.token },
      });

      expect(response.status).toBe(403);
      expect((await user.findOneById(targetUser.id)).banned_at).toBeNull();
    });

    test("Permite banir sem update:user:others quando possui update:user:status", async () => {
      const { statusManager, sessionObject } =
        await createStatusManagerSession();
      const targetUser = await orchestrator.createUser();
      const headers = { Cookie: "session_id=" + sessionObject.token };

      expect(statusManager.features).not.toContain("update:user:others");

      const banResponse = await fetch(adminUserBanUrl(targetUser.username), {
        method: "POST",
        headers,
      });
      expect(banResponse.status).toBe(200);
      expect(Date.parse((await banResponse.json()).banned_at)).not.toBeNaN();

      const unbanResponse = await fetch(adminUserBanUrl(targetUser.username), {
        method: "DELETE",
        headers,
      });
      expect(unbanResponse.status).toBe(200);
      expect((await unbanResponse.json()).banned_at).toBeNull();
    });
  });

  describe("Usuário privilegiado", () => {
    test("Banindo outro usuário, encerrando suas sessões e bloqueando o login", async () => {
      const { privilegedUser, sessionObject } = await createPrivilegedSession();
      const targetUser = await orchestrator.createUser();
      await orchestrator.activateUser(targetUser);
      const targetSessions = await Promise.all([
        orchestrator.createSession(targetUser),
        orchestrator.createSession(targetUser),
      ]);
      const headers = { Cookie: "session_id=" + sessionObject.token };

      const banResponse = await fetch(adminUserBanUrl(targetUser.username), {
        method: "POST",
        headers,
      });

      expect(banResponse.status).toBe(200);
      const bannedUser = await banResponse.json();
      expect(bannedUser.id).toBe(targetUser.id);
      expect(Date.parse(bannedUser.banned_at)).not.toBeNaN();

      const persistedBannedUser = await user.findOneById(targetUser.id);
      expect(Date.parse(persistedBannedUser.banned_at)).not.toBeNaN();

      const expiredSessions = await database.query({
        text: "SELECT expires_at FROM sessions WHERE user_id = $1;",
        values: [targetUser.id],
      });
      expect(expiredSessions.rows).toHaveLength(targetSessions.length);
      expect(
        expiredSessions.rows.every(
          (item) => new Date(item.expires_at) < new Date(),
        ),
      ).toBe(true);

      for (const targetSession of targetSessions) {
        await expect(
          session.findOneValidByToken(targetSession.token),
        ).rejects.toThrow("Usuário não possui sessão ativa.");

        const existingSessionResponse = await fetch(
          orchestrator.API_URL + "/user",
          { headers: { Cookie: "session_id=" + targetSession.token } },
        );
        expect(existingSessionResponse.status).toBe(401);
      }

      const loginResponse = await fetch(orchestrator.API_URL + "/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetUser.email,
          password: "Senha_Padrao_V@l1d@_1234",
        }),
      });
      expect(loginResponse.status).toBe(403);
      expect(await loginResponse.json()).toMatchObject({
        name: "BannedUserError",
        message: "Esta conta foi banida e não pode acessar o sistema.",
        action:
          "Entre em contato com a administração do sistema caso acredite que isso seja um engano.",
        status_code: 403,
      });

      const searchResponse = await fetch(
        orchestrator.API_URL +
          "/admin/users?search=" +
          encodeURIComponent(targetUser.username),
        { headers },
      );
      expect(searchResponse.status).toBe(200);
      const searchResults = await searchResponse.json();
      expect(searchResults[0].banned_at).toBe(bannedUser.banned_at);

      const auditResponse = await fetch(
        orchestrator.API_URL + "/admin/audit/banned",
        { headers },
      );
      expect(auditResponse.status).toBe(200);
      const banEvents = await auditResponse.json();
      expect(banEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: targetUser.id,
            action: "ban",
            username: targetUser.username,
            email: targetUser.email,
            actor_user_id: privilegedUser.id,
            actor_username: privilegedUser.username,
            is_currently_banned: true,
          }),
        ]),
      );
    });

    test("Impedindo a reutilização do username ou e-mail de uma conta banida", async () => {
      const { sessionObject } = await createPrivilegedSession();
      const targetUser = await orchestrator.createUser();
      const headers = {
        "Content-Type": "application/json",
        Cookie: "session_id=" + sessionObject.token,
      };

      const banResponse = await fetch(adminUserBanUrl(targetUser.username), {
        method: "POST",
        headers,
      });
      expect(banResponse.status).toBe(200);

      const duplicateUsernameResponse = await fetch(
        orchestrator.API_URL + "/users",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            username: targetUser.username.toUpperCase(),
            email: "outro.email@example.com",
            password: "Senha_Padrao_V@l1d@_1234",
          }),
        },
      );
      expect(duplicateUsernameResponse.status).toBe(400);
      expect(await duplicateUsernameResponse.json()).toMatchObject({
        message: "O nome de usuário informado já está sendo utilizado.",
      });

      const duplicateEmailResponse = await fetch(
        orchestrator.API_URL + "/users",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            username: "outro-usuario",
            email: targetUser.email.toUpperCase(),
            password: "Senha_Padrao_V@l1d@_1234",
          }),
        },
      );
      expect(duplicateEmailResponse.status).toBe(400);
      expect(await duplicateEmailResponse.json()).toMatchObject({
        message: "O email informado já está sendo utilizado.",
      });
    });

    test("Impedindo que o administrador bana a própria conta", async () => {
      const { privilegedUser, sessionObject } = await createPrivilegedSession();

      const response = await fetch(adminUserBanUrl(privilegedUser.username), {
        method: "POST",
        headers: { Cookie: "session_id=" + sessionObject.token },
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        name: "ForbiddenError",
        message: "Não é permitido banir a própria conta administrativa.",
      });

      const unchangedUser = await user.findOneById(privilegedUser.id);
      expect(unchangedUser.banned_at).toBeNull();
    });
  });
});

describe("DELETE /api/v1/admin/users/[username]/ban", () => {
  describe("Usuário anônimo", () => {
    test("Tentando desbanir outro usuário", async () => {
      const targetUser = await orchestrator.createUser();

      const response = await fetch(adminUserBanUrl(targetUser.username), {
        method: "DELETE",
      });

      expect(response.status).toBe(403);
    });
  });

  describe("Usuário padrão", () => {
    test("Tentando desbanir outro usuário sem permissões administrativas", async () => {
      const { sessionObject } = await createStandardSession();
      const targetUser = await orchestrator.createUser();

      const response = await fetch(adminUserBanUrl(targetUser.username), {
        method: "DELETE",
        headers: { Cookie: "session_id=" + sessionObject.token },
      });

      expect(response.status).toBe(403);
    });
  });

  describe("Permissão específica de status", () => {
    test("Não permite desbanir usando apenas update:user:others", async () => {
      const { sessionObject } = await createLegacyAdminSession();
      const targetUser = await orchestrator.createUser();
      await user.setBanStatus(targetUser.username, true);

      const response = await fetch(adminUserBanUrl(targetUser.username), {
        method: "DELETE",
        headers: { Cookie: "session_id=" + sessionObject.token },
      });

      expect(response.status).toBe(403);
      expect(Date.parse((await user.findOneById(targetUser.id)).banned_at)).not.toBeNaN();
    });
  });

  describe("Usuário privilegiado", () => {
    test("Desbanindo outro usuário sem reativar sessões anteriores", async () => {
      const { privilegedUser, sessionObject } = await createPrivilegedSession();
      const targetUser = await orchestrator.createUser({
        password: "Senha_Padrao_V@l1d@_1234",
      });
      await orchestrator.activateUser(targetUser);
      const targetSessions = await Promise.all([
        orchestrator.createSession(targetUser),
        orchestrator.createSession(targetUser),
      ]);

      await user.setBanStatus(targetUser.username, true, privilegedUser.id);

      const response = await fetch(adminUserBanUrl(targetUser.username), {
        method: "DELETE",
        headers: { Cookie: "session_id=" + sessionObject.token },
      });

      expect(response.status).toBe(200);
      const unbannedUser = await response.json();
      expect(unbannedUser.banned_at).toBeNull();

      const persistedUnbannedUser = await user.findOneById(targetUser.id);
      expect(persistedUnbannedUser.banned_at).toBeNull();

      for (const targetSession of targetSessions) {
        await expect(
          session.findOneValidByToken(targetSession.token),
        ).rejects.toThrow("Usuário não possui sessão ativa.");
      }

      const historyResponse = await fetch(
        orchestrator.API_URL + "/admin/audit/banned",
        { headers: { Cookie: "session_id=" + sessionObject.token } },
      );
      expect(historyResponse.status).toBe(200);
      const history = await historyResponse.json();
      expect(
        history
          .filter((event) => event.user_id === targetUser.id)
          .map((event) => event.action),
      ).toEqual(["unban", "ban"]);
      expect(
        history
          .filter((event) => event.user_id === targetUser.id)
          .every((event) => event.actor_user_id === privilegedUser.id),
      ).toBe(true);

      const loginResponse = await fetch(orchestrator.API_URL + "/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetUser.email,
          password: "Senha_Padrao_V@l1d@_1234",
        }),
      });
      expect(loginResponse.status).toBe(201);
    });
  });
});
