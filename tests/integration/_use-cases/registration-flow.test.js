/* eslint-disable jest/expect-expect */
/* eslint-disable jest/no-disabled-tests */
import webserver from "@/infra/webserver";
import activation from "@/models/activation";
import user from "@/models/user";
import orchestrator from "@/tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmail();
});

describe("Caso de Uso: Fluxo de registro com sucesso", () => {
  let createUserRespondseBody;
  let activationTokenId;

  test("Cria um usuário", async () => {
    const createUserRespondse = await fetch(`${orchestrator.API_URL}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "registrationFlow",
        email: "registrationFlow@jhonatancassante.com.br",
        password: "senha123",
      }),
    });
    expect(createUserRespondse.status).toBe(201);

    createUserRespondseBody = await createUserRespondse.json();

    expect(createUserRespondseBody).toEqual({
      id: createUserRespondseBody.id,
      username: "registrationFlow",
      email: "registrationFlow@jhonatancassante.com.br",
      password: createUserRespondseBody.password,
      features: ["read:activation_token"],
      created_at: createUserRespondseBody.created_at,
      updated_at: createUserRespondseBody.updated_at,
    });
  });

  test("Recebe um email de ativação", async () => {
    const lastEmail = await orchestrator.getLastEmail();

    expect(lastEmail.sender).toBe("<contato@jhonatancassante.com.br>");
    expect(lastEmail.recipients[0]).toBe(
      "<registrationFlow@jhonatancassante.com.br>",
    );
    expect(lastEmail.subject).toBe(
      "Ative seu cadastro no site jhonatancassante.com.br",
    );
    expect(lastEmail.text).toContain("registrationFlow");

    activationTokenId = orchestrator.extractUUID(lastEmail.text);
    expect(lastEmail.text).toContain(
      `${webserver.origin}/cadastro/ativar/${activationTokenId}`,
    );

    const activationTokenObject =
      await activation.findOneValidById(activationTokenId);
    expect(activationTokenObject.user_id).toBe(createUserRespondseBody.id);
    expect(activationTokenObject.used_at).toBe(null);
  });

  test("Ativa a conta", async () => {
    const activationResponse = await fetch(
      `${orchestrator.API_URL}/activations/${activationTokenId}`,
      {
        method: "PATCH",
      },
    );
    expect(activationResponse.status).toBe(200);

    const activationResponseBody = await activationResponse.json();
    expect(Date.parse(activationResponseBody.used_at)).not.toBeNaN();

    const activatedUser = await user.findOneByUsername(
      createUserRespondseBody.username,
    );
    expect(activatedUser.features).toEqual(["create:session"]);
  });

  test.skip("Faz login", async () => {});

  test.skip("Recebe dados do usuário", async () => {});
});
