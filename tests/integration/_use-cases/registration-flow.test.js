/* eslint-disable jest/expect-expect */
/* eslint-disable jest/no-disabled-tests */
import orchestrator from "@/tests/orchestrator";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmail();
});

describe("Caso de Uso: Fluxo de registro com sucesso", () => {
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

    const createUserRespondseBody = await createUserRespondse.json();

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
  });

  test.skip("Ativa a conta", async () => {});

  test.skip("Faz login", async () => {});

  test.skip("Recebe dados do usuário", async () => {});
});
