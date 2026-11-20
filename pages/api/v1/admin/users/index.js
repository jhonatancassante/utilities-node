import controller from "@/infra/controller.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:user:others"), getHandler],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const searchTerm = request.query.search;
  const users = await user.search(searchTerm);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:user:others",
    users,
  );

  return response.status(200).json(secureOutputValues);
}
