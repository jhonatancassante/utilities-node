import controller from "@/infra/controller.js";
import certificate from "@/models/certificate.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    DELETE: [controller.canRequest("delete:certificate"), deleteHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function deleteHandler(request, response) {
  const currentUser = request.context.user;
  const records = await certificate.deleteMany(request.body?.ids);
  const output = authorization.filterOutput(
    currentUser,
    "read:certificate",
    records,
  );
  return response.status(200).json(output);
}
