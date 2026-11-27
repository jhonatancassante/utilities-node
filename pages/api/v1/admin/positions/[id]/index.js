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
  const currentUser = request.context.user;
  const record = await position.findOneById(request.query.id);
  const output = authorization.filterOutput(
    currentUser,
    "read:position",
    record,
  );
  return response.status(200).json(output);
}

async function patchHandler(request, response) {
  const currentUser = request.context.user;
  const record = await position.update(request.query.id, request.body);
  const output = authorization.filterOutput(
    currentUser,
    "read:position",
    record,
  );
  return response.status(200).json(output);
}

async function deleteHandler(request, response) {
  const currentUser = request.context.user;
  const record = await position.delete(request.query.id);
  const output = authorization.filterOutput(
    currentUser,
    "read:position",
    record,
  );
  return response.status(200).json(output);
}
