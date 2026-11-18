import { ConfigurationError } from "@/infra/errors.js";
import password from "@/models/password.js";

describe("models/password.js", () => {
  const originalPepper = process.env.PASSWORD_PEPPER;

  afterEach(() => {
    if (originalPepper === undefined) {
      delete process.env.PASSWORD_PEPPER;
    } else {
      process.env.PASSWORD_PEPPER = originalPepper;
    }
  });

  test("Gera hash bcrypt diferente da senha original", async () => {
    process.env.PASSWORD_PEPPER = "pepper-de-teste";

    const hash = await password.hash("Senha-Segura-123");

    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toContain("Senha-Segura-123");
  });

  test("Gera hashes diferentes para a mesma senha (salt)", async () => {
    process.env.PASSWORD_PEPPER = "pepper-de-teste";

    const first = await password.hash("Senha-Segura-123");
    const second = await password.hash("Senha-Segura-123");

    expect(first).not.toBe(second);
  });

  test("Compara senha correta e incorreta", async () => {
    process.env.PASSWORD_PEPPER = "pepper-de-teste";
    const hash = await password.hash("Senha-Segura-123");

    await expect(password.compare("Senha-Segura-123", hash)).resolves.toBe(
      true,
    );
    await expect(password.compare("Senha-Errada-123", hash)).resolves.toBe(
      false,
    );
  });

  test("Hash gerado com um pepper não valida com outro pepper", async () => {
    process.env.PASSWORD_PEPPER = "pepper-a";
    const hash = await password.hash("Senha-Segura-123");

    process.env.PASSWORD_PEPPER = "pepper-b";

    await expect(password.compare("Senha-Segura-123", hash)).resolves.toBe(
      false,
    );
  });

  test("Normaliza a senha em Unicode (NFC) antes do hash", async () => {
    process.env.PASSWORD_PEPPER = "pepper-de-teste";
    const composed = "Sença-Segura-123";
    const decomposed = "Sença-Segura-123";
    const hash = await password.hash(composed);

    await expect(password.compare(decomposed, hash)).resolves.toBe(true);
  });

  test("Sem PASSWORD_PEPPER, lança ConfigurationError", async () => {
    delete process.env.PASSWORD_PEPPER;

    await expect(password.hash("Senha-Segura-123")).rejects.toThrow(
      ConfigurationError,
    );
    await expect(password.compare("Senha-Segura-123", "x")).rejects.toThrow(
      ConfigurationError,
    );
  });
});
