import controller from "@/infra/controller.js";
import assessedValue from "@/models/assessed-value.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:assessed_value"), getHandler],
    PATCH: [controller.canRequest("update:assessed_value"), patchHandler],
    DELETE: [controller.canRequest("delete:assessed_value"), deleteHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const record = await assessedValue.findOneById(request.query.id);
  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:assessed_value",
    record,
  );
  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToUpdate = request.context.user;
  const record = await assessedValue.update(request.query.id, request.body);
  const secureOutputValues = authorization.filterOutput(
    userTryingToUpdate,
    "read:assessed_value",
    record,
  );
  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const record = await assessedValue.delete(request.query.id);
  const secureOutputValues = authorization.filterOutput(
    userTryingToDelete,
    "read:assessed_value",
    record,
  );
  return response.status(200).json(secureOutputValues);
}
