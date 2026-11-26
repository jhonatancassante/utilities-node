import controller from "@/infra/controller.js";
import certificate from "@/models/certificate.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:certificate"), getHandler],
    POST: [
      controller.canRequest("create:certificate"),
      controller.canRequest("read:certificate"),
      postHandler,
    ],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const currentUser = request.context.user;
  const records = await certificate.findAll();
  const output = authorization.filterOutput(currentUser, "read:certificate", records);
  return response.status(200).json(output);
}

async function postHandler(request, response) {
  const currentUser = request.context.user;
  const record = await certificate.create(request.body, currentUser.id);
  const output = authorization.filterOutput(currentUser, "read:certificate", record);
  return response.status(201).json(output);
}
