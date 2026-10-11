import migrationRunner from 'node-pg-migrate';
import { join } from 'node:path';
import database from '@/infra/database.js';

export default async function migrations(request, response) {
  const methods = ["GET", "POST"];

  if (methods.includes(request.method)) {
    const dbClient = await database.getNewClient();

    const migrations = await migrationRunner({
      dbClient,
      dryRun: request.method === "GET",
      dir: join("infra", "migrations"),
      direction: "up",
      verbose: true,
      migrationsTable: "pgmigrations",
    });

    await dbClient.end();

    const statusCode =
      request.method === "POST"
        && migrations.length > 0
        ? 201
        : 200;

    response.status(statusCode).json(migrations);
  }

  response.status(405).end();
}
