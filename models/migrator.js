import { runner as migrationRunner } from "node-pg-migrate";
import { resolve } from "node:path";

import { ConflictError } from "@/infra/errors.js";
import database from "@/infra/database.js";

const defaultMigrationOptions = {
  dryRun: true,
  dir: resolve("infra", "migrations"),
  direction: "up",
  log: () => {},
  migrationsTable: "pgmigrations",
};

const MIGRATION_LOCK_KEY = 73190421;

async function listPendingMigrations() {
  let dbClient;

  try {
    dbClient = await database.getNewClient();

    return await migrationRunner({
      dbClient,
      ...defaultMigrationOptions,
    });
  } finally {
    await dbClient?.end();
  }
}

async function runPendingMigrations() {
  let dbClient;
  let lockAcquired = false;

  try {
    dbClient = await database.getNewClient();

    const lockResult = await dbClient.query({
      text: "SELECT pg_try_advisory_lock($1) AS locked;",
      values: [MIGRATION_LOCK_KEY],
    });

    lockAcquired = lockResult.rows[0].locked;

    if (!lockAcquired) {
      throw new ConflictError({
        message: "Já existe uma execução de migrations em andamento.",
        action:
          "Aguarde a conclusão da execução atual e atualize a verificação.",
      });
    }

    return await migrationRunner({
      ...defaultMigrationOptions,
      dbClient,
      dryRun: false,
    });
  } finally {
    if (lockAcquired && dbClient) {
      await dbClient
        .query({
          text: "SELECT pg_advisory_unlock($1);",
          values: [MIGRATION_LOCK_KEY],
        })
        .catch((error) => {
          console.error(
            "Não foi possível liberar o bloqueio de migrations.",
            error,
          );
        });
    }

    await dbClient?.end();
  }
}

const migrator = {
  listPendingMigrations,
  runPendingMigrations,
};

export default migrator;
