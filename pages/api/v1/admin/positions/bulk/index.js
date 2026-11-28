import controller from "@/infra/controller.js";
import authorization from "@/models/authorization.js";
import position from "@/models/position.js";

export default controller.createController(
  {
    DELETE: [controller.canRequest("delete:position"), deleteHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const records = await position.deleteMany(request.body?.ids);
  const secureOutputValues = authorization.filterOutput(
    userTryingToDelete,
    "read:position",
    records,
  );
  return response.status(200).json(secureOutputValues);
}
