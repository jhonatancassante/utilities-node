import controller from "@/infra/controller.js";
import user from "@/models/user.js";
import { ValidationError } from "@/infra/errors.js";

export default controller.createController(
  {
    GET: [controller.canRequest("update:user:others"), getHandler],
    PATCH: [controller.canRequest("update:user:others"), patchHandler],
    DELETE: [controller.canRequest("update:user:others"), deleteHandler],
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

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const userFound = await user.findOneByUsername(request.query.username);

  if (userTryingToDelete.id === userFound.id) {
    throw new ValidationError({
      message:
        "Não é permitido remover a própria conta pelo painel administrativo.",
      action: "Utilize outra conta privilegiada para remover este usuário.",
    });
  }

  await user.deleteById(userFound.id);
  return response.status(204).end();
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
