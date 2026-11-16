import database from "@/infra/database.js";
import controller from "@/infra/controller.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  { GET: getHandler },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const updatedAt = new Date().toISOString();

  const databaseVersionResult = await database.query(`
    SHOW server_version;
  `);
  const databaseVersionValue = databaseVersionResult.rows[0].server_version;

  const connectionsResult = await database.query(`
    SELECT
      current_setting('max_connections')::int AS max_connections,
      (
        SELECT COUNT(*)::int
        FROM pg_stat_activity
        WHERE datname = current_database()
      ) AS opened_connections;
  `);

  const { max_connections, opened_connections } = connectionsResult.rows[0];

  const statusObject = {
    updated_at: updatedAt,
    dependencies: {
      database: {
        version: databaseVersionValue,
        max_connections,
        opened_connections,
      },
    },
  };

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:status",
    statusObject,
  );

  return response.status(200).json(secureOutputValues);
}
