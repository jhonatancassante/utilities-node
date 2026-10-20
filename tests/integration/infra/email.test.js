import email from "@/infra/email";
import orchestrator from "@/tests/orchestrator";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("infra/email.js", () => {
  test("send()", async () => {
    await orchestrator.deleteAllEmail();
    await email.send({
      from: "Dev <dev@jhonatancassante.com.br>",
      to: "jhonatan.cassante@live.com",
      subject: "Teste de assunto",
      text: "Teste de corpo.",
    });

    await email.send({
      from: "Dev <dev@jhonatancassante.com.br>",
      to: "jhonatan.cassante@live.com",
      subject: "Último email",
      text: "Teste de corpo do ultimo email.",
    });

    const lastEmail = await orchestrator.getLastEmail();
    expect(lastEmail.sender).toBe("<dev@jhonatancassante.com.br>");
    expect(lastEmail.recipients[0]).toBe("<jhonatan.cassante@live.com>");
    expect(lastEmail.subject).toBe("Último email");
    expect(lastEmail.text).toBe("Teste de corpo do ultimo email.\n");
  });
});
