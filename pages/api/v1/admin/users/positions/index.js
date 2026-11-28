import controller from "@/infra/controller.js";
import authorization from "@/models/authorization.js";
import position from "@/models/position.js";

export default controller.createController(
  { GET: [controller.canRequest("update:user:others"), getHandler] },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const positions = await position.findAll();

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:position:options",
    positions,
  );

  return response.status(200).json(secureOutputValues);
}
