import controller from "@/infra/controller.js";
import migrator from "@/models/migrator.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:migration"), getHandler],
    POST: [controller.canRequest("create:migration"), postHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const pendingMigrations = await migrator.listPendingMigrations();

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:migration",
    pendingMigrations,
  );

  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToCreate = request.context.user;
  const startedAt = new Date().toISOString();
  let appliedMigrations;

  try {
    appliedMigrations = await migrator.runPendingMigrations();

    console.info("Execução de migrations concluída.", {
      actor_user_id: userTryingToCreate.id,
      actor_username: userTryingToCreate.username,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: "success",
      migrations: appliedMigrations.map(({ name, path }) => ({ name, path })),
    });
  } catch (error) {
    let pendingMigrations = null;

    try {
      pendingMigrations = await migrator.listPendingMigrations();
    } catch (inspectionError) {
      console.error(
        "Não foi possível consultar as migrations após uma falha de execução.",
        inspectionError,
      );
    }

    console.error("Falha na execução de migrations.", {
      actor_user_id: userTryingToCreate.id,
      actor_username: userTryingToCreate.username,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: "failure",
      error_name: error.name,
      pending_migrations: pendingMigrations?.map(({ name, path }) => ({
        name,
        path,
      })),
    });

    throw error;
  }

  const statusCode = appliedMigrations.length > 0 ? 201 : 200;

  const secureOutputValues = authorization.filterOutput(
    userTryingToCreate,
    "read:migration",
    appliedMigrations,
  );

  return response.status(statusCode).json(secureOutputValues);
}
