import database from "@/infra/database.js";
import controller from "@/infra/controller.js";

export default controller.createController({ GET: getHandler });

async function getHandler(request, response) {
  const updatedAt = new Date().toISOString();

  const result = await database.query(`
    SELECT
      current_setting('server_version') AS version,
      current_setting('max_connections')::int AS max_connections,
      (
        SELECT COUNT(*)::int
        FROM pg_stat_activity
        WHERE datname = current_database()
      ) AS opened_connections;
  `);

  const { version, max_connections, opened_connections } = result.rows[0];

  return response.status(200).json({
    updated_at: updatedAt,
    dependencies: {
      database: { version, max_connections, opened_connections },
    },
  });
}
