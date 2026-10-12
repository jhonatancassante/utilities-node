import migrationRunner from "node-pg-migrate";
import { join } from "node:path";
import database from "@/infra/database.js";

export default async function migrations(request, response) {
  const allowedMethods = ["GET", "POST"];

  if (!allowedMethods.includes(request.method)) {
    return response
      .status(405)
      .json({ error: `Método "${request.method}" não permitido.` });
  }

  let dbClient;

  try {
    dbClient = await database.getNewClient();
    const isDryRun = request.method === "GET";

    const migrations = await migrationRunner({
      dbClient,
      dryRun: isDryRun,
      dir: join("infra", "migrations"),
      direction: "up",
      verbose: true,
      migrationsTable: "pgmigrations",
    });

    const statusCode =
      request.method === "POST" && migrations.length > 0 ? 201 : 200;

    return response.status(statusCode).json(migrations);
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await dbClient.end();
  }
}
