import controller from "@/infra/controller.js";
import authorization from "@/models/authorization.js";
import position from "@/models/position.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:position"), getHandler],
    POST: [controller.canRequest("create:position"), postHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const records = await position.findAll();
  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:position",
    records,
  );
  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToCreate = request.context.user;
  const record = await position.create(request.body);
  const secureOutputValues = authorization.filterOutput(
    userTryingToCreate,
    "read:position",
    record,
  );
  return response.status(201).json(secureOutputValues);
}
