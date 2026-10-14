import { runner as migrationRunner } from "node-pg-migrate";
import { resolve } from "node:path";

import database from "@/infra/database.js";
import controller from "@/infra/controller.js";

export default controller.createController({
  GET: getHandler,
  POST: postHandler,
});

async function getHandler(request, response) {
  const pendingMigrations = await runMigrations({ dryRun: true });

  return response.status(200).json(pendingMigrations);
}

async function postHandler(request, response) {
  const appliedMigrations = await runMigrations({ dryRun: false });
  const statusCode = appliedMigrations.length > 0 ? 201 : 200;

  return response.status(statusCode).json(appliedMigrations);
}

async function runMigrations({ dryRun }) {
  let dbClient;

  try {
    dbClient = await database.getNewClient();

    return await migrationRunner({
      dbClient,
      dryRun,
      dir: resolve("infra", "migrations"),
      direction: "up",
      verbose: true,
      migrationsTable: "pgmigrations",
    });
  } finally {
    await dbClient?.end();
  }
}
