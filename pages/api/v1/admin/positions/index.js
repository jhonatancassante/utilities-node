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
  const currentUser = request.context.user;
  const records = await position.findAll();
  const output = authorization.filterOutput(
    currentUser,
    "read:position",
    records,
  );
  return response.status(200).json(output);
}

async function postHandler(request, response) {
  const currentUser = request.context.user;
  const record = await position.create(request.body);
  const output = authorization.filterOutput(
    currentUser,
    "read:position",
    record,
  );
  return response.status(201).json(output);
}
