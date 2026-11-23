import orchestrator from "tests/orchestrator.js";
import database from "@/infra/database.js";
import user from "@/models/user.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

function auditUrl() {
  return orchestrator.API_URL + "/admin/audit/banned";
}

async function createAuditorSession() {
  const auditor = await orchestrator.createUser();
  await orchestrator.activateUser(auditor);
  await orchestrator.addFeaturesToUser(auditor, ["read:audit"]);
  const sessionObject = await orchestrator.createSession(auditor);
  return { auditor, sessionObject };
}

async function createStandardSession() {
  const standardUser = await orchestrator.createUser();
  await orchestrator.activateUser(standardUser);
  const sessionObject = await orchestrator.createSession(standardUser);
  return sessionObject;
}

describe("GET /api/v1/admin/audit/banned", () => {
  describe("Usuário anônimo", () => {
    test("Consultando a auditoria sem autenticação", async () => {
      const response = await fetch(auditUrl());

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
      });
    });
  });

  describe("Sessão inválida", () => {
    test("Rejeita a sessão e limpa o cookie", async () => {
      const response = await fetch(auditUrl(), {
        headers: { Cookie: "session_id=invalid-session-token" },
      });

      expect(response.status).toBe(401);
      expect(response.headers.get("Set-Cookie")).toContain("session_id=invalid");
      expect(await response.json()).toMatchObject({
        name: "UnauthorizedError",
        message: "Usuário não possui sessão ativa.",
      });
    });
  });

  describe("Usuário padrão", () => {
    test("Consultando a auditoria sem a feature read:audit", async () => {
      const sessionObject = await createStandardSession();

      const response = await fetch(auditUrl(), {
        headers: { Cookie: "session_id=" + sessionObject.token },
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação.",
      });
    });
  });

  describe("Usuário privilegiado", () => {
    test("Consultando eventos, preservando snapshots e sem expor dados internos", async () => {
      const { auditor, sessionObject } = await createAuditorSession();
      const retainedUser = await orchestrator.createUser();
      const deletedUser = await orchestrator.createUser();

      await user.setBanStatus(retainedUser.username, true, auditor.id);
      await user.setBanStatus(deletedUser.username, true, auditor.id);

      await database.query({
        text: "DELETE FROM users WHERE id = $1;",
        values: [deletedUser.id],
      });

      const response = await fetch(auditUrl(), {
        headers: { Cookie: "session_id=" + sessionObject.token },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");

      const events = await response.json();
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: retainedUser.id,
            actor_user_id: auditor.id,
            action: "ban",
            username: retainedUser.username,
            email: retainedUser.email,
            actor_username: auditor.username,
            actor_email: auditor.email,
            is_currently_banned: true,
          }),
          expect.objectContaining({
            user_id: deletedUser.id,
            actor_user_id: auditor.id,
            action: "ban",
            username: deletedUser.username,
            email: deletedUser.email,
            actor_username: auditor.username,
            actor_email: auditor.email,
            is_currently_banned: false,
            current_banned_at: null,
          }),
        ]),
      );

      const deletedEvent = events.find(
        (event) => event.user_id === deletedUser.id,
      );
      expect(deletedEvent.account_created_at).toBe(
        deletedUser.created_at.toISOString(),
      );
      expect(deletedEvent).not.toHaveProperty("password");
    });
  });
});
