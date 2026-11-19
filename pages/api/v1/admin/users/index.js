import controller from "@/infra/controller.js";
import user from "@/models/user.js";

export default controller.createController(
  {
    GET: [controller.canRequest("update:user:others"), getHandler],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function getHandler(request, response) {
  const searchTerm = request.query.search;
  const users = await user.search(searchTerm);

  const safeUsers = users
    .filter((userObject) => userObject.id !== request.context.user.id)
    .map((userObject) => ({
      id: userObject.id,
      username: userObject.username,
      email: userObject.email,
      features: userObject.features,
      created_at: userObject.created_at,
      updated_at: userObject.updated_at,
    }));

  return response.status(200).json(safeUsers);
}
