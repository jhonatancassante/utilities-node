import database from "@/infra/database.js";
import { ServiceError } from "@/infra/errors.js";
import activation from "@/models/activation.js";
import user from "@/models/user.js";
import orchestrator from "@/tests/orchestrator";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function findTokenById(id) {
  const results = await database.query({
    text: "SELECT * FROM user_activation_tokens WHERE id = $1;",
    values: [id],
  });
  return results.rows[0];
}

describe("models/activation.js", () => {
  describe(".activate()", () => {
    test("Consome o token e ativa o usuário juntos", async () => {
      const createdUser = await orchestrator.createUser();
      const token = await activation.create(createdUser.id);

      const usedToken = await activation.activate(token.id);

      expect(usedToken.used_at).not.toBeNull();
      expect((await findTokenById(token.id)).used_at).not.toBeNull();
      expect((await user.findOneById(createdUser.id)).features).toEqual([
        "create:session",
        "read:session",
        "update:user",
      ]);
    });

    test("Se a ativação do usuário falhar, o token continua sem uso", async () => {
      const createdUser = await orchestrator.createUser();
      const token = await activation.create(createdUser.id);

      // Falha real do banco no segundo passo (ativar o usuário): uma constraint
      // temporária recusa a feature `update:user`.
      await database.query(`
      ALTER TABLE users
        ADD CONSTRAINT tmp_recusa_usuario_ativo
        CHECK (NOT ('update:user' = ANY(features))) NOT VALID;
    `);

      let error;
      try {
        error = await activation.activate(token.id).catch((e) => e);
      } finally {
        await database.query(
          "ALTER TABLE users DROP CONSTRAINT tmp_recusa_usuario_ativo;",
        );
      }

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.cause.code).toBe("23514");

      expect((await findTokenById(token.id)).used_at).toBeNull();
      expect((await user.findOneById(createdUser.id)).features).toEqual([
        "read:activation_token",
      ]);
    });

    test("Usuário já ativo: o token continua sem uso", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const token = await activation.create(createdUser.id);

      await expect(activation.activate(token.id)).rejects.toThrow(
        "Você não pode mais utilizar tokens de ativação.",
      );

      expect((await findTokenById(token.id)).used_at).toBeNull();
    });

    test("Duas ativações simultâneas: só uma tem sucesso", async () => {
      const createdUser = await orchestrator.createUser();
      const token = await activation.create(createdUser.id);

      const results = await Promise.allSettled([
        activation.activate(token.id),
        activation.activate(token.id),
      ]);

      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual(["fulfilled", "rejected"]);

      const [rejected] = results.filter((r) => r.status === "rejected");
      expect(rejected.reason.statusCode).toBe(404);
    });
  });
});
