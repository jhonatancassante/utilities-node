import controller from "@/infra/controller.js";
import user from "@/models/user.js";
import { ValidationError } from "@/infra/errors.js";

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
  const userTryingToPatch = request.context.user;
  const targetUser = await user.findOneByUsername(request.query.username);

  if (userTryingToPatch.id === targetUser.id) {
    throw new ValidationError({
      message:
        "Não é permitido alterar a própria conta pelo painel administrativo.",
      action: "Utilize a página Meu perfil para alterar seus próprios dados.",
    });
  }

  const updatedUser = await user.update(request.query.username, request.body, {
    allowFeatures: true,
  });

  return response.status(200).json(filterUserOutput(updatedUser));
}

function filterUserOutput(userObject) {
  return {
    id: userObject.id,
    username: userObject.username,
    email: userObject.email,
    features: userObject.features,
    created_at: userObject.created_at,
    updated_at: userObject.updated_at,
  };
}
