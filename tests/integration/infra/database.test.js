import database from "@/infra/database.js";
import { NotFoundError, ServiceError } from "@/infra/errors.js";
import orchestrator from "@/tests/orchestrator";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function insertUser(client, email) {
  return await client.query({
    text: `INSERT INTO users (username, name, position, email, password) VALUES ($1, $1, 'Não informado', $2, 'x') RETURNING id;`,
    values: [email.split("@")[0], email],
  });
}

async function countUsersByEmail(email) {
  const results = await database.query({
    text: "SELECT id FROM users WHERE email = $1;",
    values: [email],
  });
  return results.rowCount;
}

describe("infra/database.js", () => {
  describe(".transaction()", () => {
    test("Confirma (COMMIT) quando o callback termina sem erro", async () => {
      const result = await database.transaction(async (client) => {
        await insertUser(client, "commit@example.com");
        return "ok";
      });

      expect(result).toBe("ok");
      expect(await countUsersByEmail("commit@example.com")).toBe(1);
    });

    test("Desfaz (ROLLBACK) e repassa o erro da aplicação como está", async () => {
      const error = await database
        .transaction(async (client) => {
          await insertUser(client, "rollback@example.com");
          throw new NotFoundError({ message: "falha de negócio" });
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe("falha de negócio");
      expect(await countUsersByEmail("rollback@example.com")).toBe(0);
    });

    test("Desfaz tudo e lança ServiceError quando o banco falha", async () => {
      const error = await database
        .transaction(async (client) => {
          await insertUser(client, "falha.banco@example.com");
          await client.query("SELECT * FROM tabela_que_nao_existe;");
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.cause.code).toBe("42P01");
      expect(await countUsersByEmail("falha.banco@example.com")).toBe(0);
    });
  });
});
