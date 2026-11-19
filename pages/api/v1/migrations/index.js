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
  const userTryingToPost = request.context.user;
  const appliedMigrations = await migrator.runPendingMigrations();
  const statusCode = appliedMigrations.length > 0 ? 201 : 200;

  const secureOutputValues = authorization.filterOutput(
    userTryingToPost,
    "read:migration",
    appliedMigrations,
  );

  return response.status(statusCode).json(secureOutputValues);
}
