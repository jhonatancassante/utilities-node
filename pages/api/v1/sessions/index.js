import controller from "@/infra/controller.js";
import authentication from "@/models/authentication.js";
import session from "@/models/session.js";
import authorization from "@/models/authorization.js";

import { ForbiddenError, ValidationError } from "@/infra/errors.js";

export default controller.createController(
  {
    POST: [controller.canRequest("create:session"), postHandler],
    DELETE: deleteHandler,
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function postHandler(request, response) {
  const userInputValues = request.body;

  if (!userInputValues.email || !userInputValues.password) {
    throw new ValidationError({
      message: "Email e senha são obrigatórios para fazer login.",
      action:
        "Verifique se você enviou os campos corretamente e tente novamente.",
    });
  }

  const authenticatedUser = await authentication.getUser(
    userInputValues.email,
    userInputValues.password,
  );

  if (!authorization.can(authenticatedUser, "create:session")) {
    throw new ForbiddenError({
      message: "Você não possui permissão para fazer login.",
      action: "Contate o suporte caso você acredite que isso é um erro.",
    });
  }

  const newSession = await session.create(authenticatedUser.id);

  controller.setSessionCookie(response, newSession.token);

  const secureOutputValues = authorization.filterOutput(
    authenticatedUser,
    "read:session",
    newSession,
  );

  return response.status(201).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const sessionToken = request.cookies.session_id;

  const sessionObject = await session.findOneValidByToken(sessionToken);
  const expiredSession = await session.expireById(sessionObject.id);
  controller.clearSessionCookie(response);

  const secureOutputValues = authorization.filterOutput(
    userTryingToDelete,
    "read:session",
    expiredSession,
  );

  return response.status(200).json(secureOutputValues);
}
