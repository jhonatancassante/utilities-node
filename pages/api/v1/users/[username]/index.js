import controller from "@/infra/controller.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";
import { ForbiddenError } from "@/infra/errors.js";

export default controller.createController(
  {
    GET: getHandler,
    PATCH: [controller.canRequest("update:user"), patchHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const username = request.query.username;

  const userFound = await user.findOneByUsername(username);

  return response.status(200).json(userFound);
}

async function patchHandler(request, response) {
  const username = request.query.username;
  const userInputValues = request.body;

  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsername(username);

  if (!authorization.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para executar esta ação.",
      action: 'Verifique se o seu usuário possui a feature "update:user".',
    });
  }

  const updatedUser = await user.update(username, userInputValues);

  return response.status(200).json(updatedUser);
}
