import controller from "@/infra/controller.js";
import authorization from "@/models/authorization.js";
import position from "@/models/position.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:position"), getHandler],
    PATCH: [controller.canRequest("update:position"), patchHandler],
    DELETE: [controller.canRequest("delete:position"), deleteHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const record = await position.findOneById(request.query.id);
  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:position",
    record,
  );
  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToUpdate = request.context.user;
  const record = await position.update(request.query.id, request.body);
  const secureOutputValues = authorization.filterOutput(
    userTryingToUpdate,
    "read:position",
    record,
  );
  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const record = await position.delete(request.query.id);
  const secureOutputValues = authorization.filterOutput(
    userTryingToDelete,
    "read:position",
    record,
  );
  return response.status(200).json(secureOutputValues);
}
