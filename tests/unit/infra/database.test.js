import database from "@/infra/database.js";
import { ConfigurationError, ServiceError } from "@/infra/errors.js";

describe("infra/database.js", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  describe(".query()", () => {
    test("Sem DATABASE_URL em produção, a causa é um ConfigurationError", async () => {
      process.env.NODE_ENV = "production";
      delete process.env.DATABASE_URL;

      const error = await database.query("SELECT 1;").catch((e) => e);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.cause).toBeInstanceOf(ConfigurationError);
      expect(error.cause.message).toBe(
        "DATABASE_URL não definida (ambiente: production).",
      );
      expect(error.cause.action).toBe(
        "Defina a variável de ambiente DATABASE_URL no servidor.",
      );
    });
  });
});
