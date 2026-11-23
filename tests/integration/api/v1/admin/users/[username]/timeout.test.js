import { jest } from "@jest/globals";

import orchestrator from "tests/orchestrator.js";
import user from "@/models/user.js";
import feature from "@/models/feature.js";
import database from "@/infra/database.js";
import session from "@/models/session.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

function getFutureTimeout() {
  jest.useFakeTimers({ now: new Date("2099-01-01T00:00:00.908Z") });
  const timeoutUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  jest.useRealTimers();
  return timeoutUntil;
}

function adminUserTimeoutUrl(username) {
  return (
    orchestrator.API_URL +
    "/admin/users/" +
    encodeURIComponent(username) +
    "/timeout"
  );
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

describe("GET /api/v1/admin/users/[username]/timeout", () => {
  test("permite abrir o modal quando o usuário pode receber suspensão", async () => {
    const { sessionObject } = await createStatusManagerSession();
    const targetUser = await orchestrator.createUser();

    const response = await fetch(adminUserTimeoutUrl(targetUser.username), {
      headers: { Cookie: "session_id=" + sessionObject.token },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ allowed: true });
  });

  test("impede abrir o modal para o único titular de permissões privilegiadas", async () => {
    const { sessionObject } = await createStatusManagerSession();
    const protectedFeatures = (await feature.findAll())
      .filter((item) => item.is_protected)
      .map((item) => item.name);
    const lastPrivilegedUser = await orchestrator.createUser();
    await orchestrator.addFeaturesToUser(
      lastPrivilegedUser,
      protectedFeatures,
    );

    const response = await fetch(
      adminUserTimeoutUrl(lastPrivilegedUser.username),
      { headers: { Cookie: "session_id=" + sessionObject.token } },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      name: "ConflictError",
    });
  });
});

describe("POST /api/v1/admin/users/[username]/timeout", () => {
  test("aplica timeout, encerra sessões existentes e bloqueia novo login", async () => {
    const { sessionObject } = await createStatusManagerSession();
    const targetUser = await orchestrator.createUser({
      password: "Senha_Padrao_V@l1d@_1234",
    });
    await orchestrator.activateUser(targetUser);
    const targetSession = await orchestrator.createSession(targetUser);
    const timeoutUntil = getFutureTimeout();

    const response = await fetch(adminUserTimeoutUrl(targetUser.username), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "session_id=" + sessionObject.token,
      },
      body: JSON.stringify({ timeout_until: timeoutUntil }),
    });

    expect(response.status).toBe(200);
    const timedOutUser = await response.json();
    expect(timedOutUser.id).toBe(targetUser.id);
    expect(Date.parse(timedOutUser.timeout_until)).toBe(
      Date.parse(timeoutUntil),
    );

    const persistedTimeout = await database.query({
      text: "SELECT EXTRACT(EPOCH FROM timeout_until) * 1000 AS timeout_until_ms FROM users WHERE id = $1;",
      values: [targetUser.id],
    });
    expect(Number(persistedTimeout.rows[0].timeout_until_ms)).toBe(
      Date.parse(timeoutUntil),
    );

    await expect(
      session.findOneValidByToken(targetSession.token),
    ).rejects.toThrow("Usuário não possui sessão ativa.");

    const existingSessionResponse = await fetch(
      orchestrator.API_URL + "/user",
      { headers: { Cookie: "session_id=" + targetSession.token } },
    );
    expect(existingSessionResponse.status).toBe(401);

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
      name: "TimedOutUserError",
      status_code: 403,
    });
  });

  test("não permite timeout usando apenas update:user:others", async () => {
    const { sessionObject } = await createLegacyAdminSession();
    const targetUser = await orchestrator.createUser();
    const response = await fetch(adminUserTimeoutUrl(targetUser.username), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "session_id=" + sessionObject.token,
      },
      body: JSON.stringify({
        timeout_until: getFutureTimeout(),
      }),
    });

    expect(response.status).toBe(403);
    expect((await user.findOneById(targetUser.id)).timeout_until).toBeNull();
  });

  test("rejeita prazo inválido ou vencido", async () => {
    const { sessionObject } = await createStatusManagerSession();
    const targetUser = await orchestrator.createUser();
    const response = await fetch(adminUserTimeoutUrl(targetUser.username), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "session_id=" + sessionObject.token,
      },
      body: JSON.stringify({ timeout_until: "ontem" }),
    });

    expect(response.status).toBe(400);
  });

  test("libera novo login automaticamente quando o prazo já terminou", async () => {
    const targetUser = await orchestrator.createUser({
      password: "Senha_Padrao_V@l1d@_1234",
    });
    await orchestrator.activateUser(targetUser);
    await database.query({
      text: "UPDATE users SET timeout_until = '2020-01-01T00:00:00.000Z' WHERE id = $1;",
      values: [targetUser.id],
    });

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

  test("Impede suspender o último administrador com todas as permissões protegidas", async () => {
    const { sessionObject } = await createStatusManagerSession();
    const protectedFeatures = (await feature.findAll())
      .filter((item) => item.is_protected)
      .map((item) => item.name);
    const lastPrivilegedUser = await orchestrator.createUser();
    await orchestrator.addFeaturesToUser(
      lastPrivilegedUser,
      protectedFeatures,
    );

    const response = await fetch(
      adminUserTimeoutUrl(lastPrivilegedUser.username),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "session_id=" + sessionObject.token,
        },
        body: JSON.stringify({
          timeout_until: getFutureTimeout(),
        }),
      },
    );

    expect(response.status).toBe(409);
    expect(
      (await user.findOneById(lastPrivilegedUser.id)).timeout_until,
    ).toBeNull();
  });

  test("não permite suspender a própria conta administrativa", async () => {
    const { statusManager, sessionObject } = await createStatusManagerSession();
    const response = await fetch(adminUserTimeoutUrl(statusManager.username), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "session_id=" + sessionObject.token,
      },
      body: JSON.stringify({
        timeout_until: getFutureTimeout(),
      }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      name: "ForbiddenError",
    });
    expect((await user.findOneById(statusManager.id)).timeout_until).toBeNull();
  });

  test("não permite aplicar timeout a uma conta já banida", async () => {
    const { sessionObject } = await createStatusManagerSession();
    const targetUser = await orchestrator.createUser();
    await user.setBanStatus(targetUser.username, true);

    const response = await fetch(adminUserTimeoutUrl(targetUser.username), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "session_id=" + sessionObject.token,
      },
      body: JSON.stringify({
        timeout_until: getFutureTimeout(),
      }),
    });

    expect(response.status).toBe(403);
    expect((await user.findOneById(targetUser.id)).timeout_until).toBeNull();
  });
});

describe("DELETE /api/v1/admin/users/[username]/timeout", () => {
  test("remove timeout e não reativa sessões encerradas", async () => {
    const { sessionObject } = await createStatusManagerSession();
    const targetUser = await orchestrator.createUser({
      password: "Senha_Padrao_V@l1d@_1234",
    });
    await orchestrator.activateUser(targetUser);
    const targetSession = await orchestrator.createSession(targetUser);

    const applyResponse = await fetch(
      adminUserTimeoutUrl(targetUser.username),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "session_id=" + sessionObject.token,
        },
        body: JSON.stringify({
          timeout_until: getFutureTimeout(),
        }),
      },
    );
    expect(applyResponse.status).toBe(200);

    const removeResponse = await fetch(
      adminUserTimeoutUrl(targetUser.username),
      {
        method: "DELETE",
        headers: { Cookie: "session_id=" + sessionObject.token },
      },
    );

    expect(removeResponse.status).toBe(200);
    expect((await removeResponse.json()).timeout_until).toBeNull();
    expect((await user.findOneById(targetUser.id)).timeout_until).toBeNull();

    await expect(
      session.findOneValidByToken(targetSession.token),
    ).rejects.toThrow("Usuário não possui sessão ativa.");

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

  test("exige as permissões de gerenciamento de status e leitura administrativa", async () => {
    const targetUser = await orchestrator.createUser();
    const response = await fetch(adminUserTimeoutUrl(targetUser.username), {
      method: "DELETE",
    });

    expect(response.status).toBe(403);
  });
});
