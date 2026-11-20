import controller from "@/infra/controller.js";
import user from "@/models/user.js";

export default controller.createController(
  {
    GET: [controller.canRequest("update:user:others"), getHandler],
    PATCH: [controller.canRequest("update:user:others"), patchHandler],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function getHandler(request, response) {
  const userFound = await user.findOneByUsername(request.query.username);
  return response.status(200).json(filterUserOutput(userFound));
}

async function patchHandler(request, response) {
  const updatedUser = await user.update(request.query.username, request.body, {
    allowFeatures: true,
  });
  const updatedUserWithPrivileges = await user.findOneById(updatedUser.id);

  return response.status(200).json(filterUserOutput(updatedUserWithPrivileges));
}

function filterUserOutput(userObject) {
  return {
    id: userObject.id,
    username: userObject.username,
    email: userObject.email,
    features: userObject.features,
    privileged_features: userObject.privileged_features ?? [],
    created_at: userObject.created_at,
    updated_at: userObject.updated_at,
  };
}
