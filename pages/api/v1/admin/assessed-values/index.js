import controller from "@/infra/controller.js";
import assessedValue from "@/models/assessed-value.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:assessed_value"), getHandler],
    POST: [controller.canRequest("create:assessed_value"), postHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const records = await assessedValue.findAll();
  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:assessed_value",
    records,
  );
  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToCreate = request.context.user;
  const record = await assessedValue.create(request.body);
  const secureOutputValues = authorization.filterOutput(
    userTryingToCreate,
    "read:assessed_value",
    record,
  );
  return response.status(201).json(secureOutputValues);
}
