import controller from "@/infra/controller.js";
import assessedValue from "@/models/assessed-value.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    POST: [
      controller.canRequest("create:assessed_values"),
      controller.canRequest("read:assessed_values"),
      postHandler,
    ],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function postHandler(request, response) {
  const currentUser = request.context.user;
  const records = await assessedValue.createMany(request.body?.records);
  const output = authorization.filterOutput(
    currentUser,
    "read:assessed_values",
    records,
  );
  return response.status(201).json(output);
}
