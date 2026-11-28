import controller from "@/infra/controller.js";
import assessedValue from "@/models/assessed-value.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    POST: [controller.canRequest("create:assessed_value"), postHandler],
    DELETE: [controller.canRequest("delete:assessed_value"), deleteHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function postHandler(request, response) {
  const userTryingToCreate = request.context.user;
  const records = await assessedValue.createMany(request.body?.records);
  const secureOutputValues = authorization.filterOutput(
    userTryingToCreate,
    "read:assessed_value",
    records,
  );
  return response.status(201).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const records = await assessedValue.deleteMany(request.body?.ids);
  const secureOutputValues = authorization.filterOutput(
    userTryingToDelete,
    "read:assessed_value",
    records,
  );
  return response.status(200).json(secureOutputValues);
}
