import orchestrator from "tests/orchestrator.js";
import user from "@/models/user.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("DELETE /api/v1/admin/users/[username]/photo", () => {
  test("Remove a referência da foto de perfil com permissão administrativa", async () => {
    const adminUser = await orchestrator.createUser();
    await orchestrator.activateUser(adminUser);
    await orchestrator.addFeaturesToUser(adminUser, [
      "update:user:others",
      "read:user:others",
    ]);
    const sessionObject = await orchestrator.createSession(adminUser);
    const targetUser = await orchestrator.createUser();

    const response = await fetch(
      `${orchestrator.API_URL}/admin/users/${targetUser.username}/photo`,
      {
        method: "DELETE",
        headers: { Cookie: `session_id=${sessionObject.token}` },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: targetUser.id,
      username: targetUser.username,
    });
    const updatedUser = await user.findOneById(targetUser.id);
    expect(updatedUser.profile_photo_url).toBeNull();
    expect(updatedUser.profile_photo_public_id).toBeNull();
  });
});
