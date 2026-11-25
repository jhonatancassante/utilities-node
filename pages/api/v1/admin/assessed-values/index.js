import controller from "@/infra/controller.js";
import assessedValue from "@/models/assessed-value.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:assessed_values"), getHandler],
    POST: [
      controller.canRequest("create:assessed_values"),
      controller.canRequest("read:assessed_values"),
      postHandler,
    ],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const currentUser = request.context.user;
  const records = await assessedValue.findAll();
  const output = authorization.filterOutput(currentUser, "read:assessed_values", records);
  return response.status(200).json(output);
}

async function postHandler(request, response) {
  const currentUser = request.context.user;
  const record = await assessedValue.create(request.body);
  const output = authorization.filterOutput(currentUser, "read:assessed_values", record);
  return response.status(201).json(output);
}
