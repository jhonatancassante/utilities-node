import controller from "@/infra/controller.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    POST: [controller.canRequest("update:user:status"), postHandler],
    DELETE: [controller.canRequest("update:user:status"), deleteHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function postHandler(request, response) {
  return updateBanStatus(request, response, true);
}

async function deleteHandler(request, response) {
  return updateBanStatus(request, response, false);
}

async function updateBanStatus(request, response, isBanned) {
  const userTryingToUpdate = request.context.user;
  const updatedUser = await user.setBanStatus(
    request.query.username,
    isBanned,
    userTryingToUpdate.id,
  );
  const updatedUserWithPrivileges = await user.findOneById(updatedUser.id);

  const secureOutputValues = authorization.filterOutput(
    userTryingToUpdate,
    "read:user:others",
    updatedUserWithPrivileges,
  );

  return response.status(200).json(secureOutputValues);
}
