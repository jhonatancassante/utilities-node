import orchestrator from "tests/orchestrator.js";
import user from "@/models/user.js";
import feature from "@/models/feature.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

function adminUserUrl(username) {
  return `${orchestrator.API_URL}/admin/users/${username}`;
}

function adminUserBanUrl(username) {
  return `${adminUserUrl(username)}/ban`;
}

async function createPrivilegedSession() {
  const protectedFeatures = (await feature.findAll())
    .filter((item) => item.is_protected)
    .map((item) => item.name);
  const privilegedUser = await orchestrator.createUser();
  await orchestrator.activateUser(privilegedUser);
  await orchestrator.addFeaturesToUser(privilegedUser, [
    ...protectedFeatures,
    "read:session",
  ]);
  const sessionObject = await orchestrator.createSession(privilegedUser);
  return { privilegedUser, sessionObject };
}

describe("/api/v1/admin/users/[username]/ban", () => {
  test("Rejeita tentativa de banimento por usuário anônimo", async () => {
    const targetUser = await orchestrator.createUser();

    const response = await fetch(adminUserBanUrl(targetUser.username), {
      method: "POST",
    });

    expect(response.status).toBe(403);
  });

  test("Permite banir e desbanir outro usuário", async () => {
    const { sessionObject } = await createPrivilegedSession();
    const targetUser = await orchestrator.createUser();
    const headers = { Cookie: `session_id=${sessionObject.token}` };

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

    const searchResponse = await fetch(
      `${orchestrator.API_URL}/admin/users?search=${encodeURIComponent(targetUser.username)}`,
      { headers },
    );
    expect(searchResponse.status).toBe(200);
    const searchResults = await searchResponse.json();
    expect(searchResults[0].banned_at).toBe(bannedUser.banned_at);

    const unbanResponse = await fetch(adminUserBanUrl(targetUser.username), {
      method: "DELETE",
      headers,
    });

    expect(unbanResponse.status).toBe(200);
    const unbannedUser = await unbanResponse.json();
    expect(unbannedUser.banned_at).toBeNull();

    const persistedUnbannedUser = await user.findOneById(targetUser.id);
    expect(persistedUnbannedUser.banned_at).toBeNull();
  });

  test("Impede que o administrador bana a própria conta", async () => {
    const { privilegedUser, sessionObject } = await createPrivilegedSession();

    const response = await fetch(adminUserBanUrl(privilegedUser.username), {
      method: "POST",
      headers: { Cookie: `session_id=${sessionObject.token}` },
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
