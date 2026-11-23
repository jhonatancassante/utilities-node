import controller from "@/infra/controller.js";
import audit from "@/models/audit.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:audit"), getHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const events = await audit.findMigrationEvents();
  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:audit",
    events,
  );

  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json(secureOutputValues);
}
