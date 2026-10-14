import controller from "@/infra/controller.js";
import migrator from "@/models/migrator";

export default controller.createController({
  GET: getHandler,
  POST: postHandler,
});

async function getHandler(request, response) {
  const pendingMigrations = await migrator.listPendingMigrations();

  return response.status(200).json(pendingMigrations);
}

async function postHandler(request, response) {
  const appliedMigrations = await migrator.runPendingMigrations();
  const statusCode = appliedMigrations.length > 0 ? 201 : 200;

  return response.status(statusCode).json(appliedMigrations);
}
