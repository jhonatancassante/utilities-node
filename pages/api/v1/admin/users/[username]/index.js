import controller from "@/infra/controller.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:user:others"), getHandler],
    PATCH: [
      controller.canRequest("update:user:others"),
      controller.canRequest("read:user:others"),
      patchHandler,
    ],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const userFound = await user.findOneByUsername(request.query.username);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:user:others",
    userFound,
  );

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToUpdate = request.context.user;
  const updatedUser = await user.update(request.query.username, request.body, {
    allowFeatures: true,
    actorUserId: userTryingToUpdate.id,
  });
  const updatedUserWithPrivileges = await user.findOneById(updatedUser.id);

  const secureOutputValues = authorization.filterOutput(
    userTryingToUpdate,
    "read:user:others",
    updatedUserWithPrivileges,
  );

  return response.status(200).json(secureOutputValues);
}
