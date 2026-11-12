import controller from "@/infra/controller.js";
import authentication from "@/models/authentication.js";
import session from "@/models/session.js";
import authorization from "@/models/authorization.js";

import { ForbiddenError } from "@/infra/errors.js";

export default controller.createController(
  {
    POST: [controller.canRequest("create:session"), postHandler],
    DELETE: deleteHandler,
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function postHandler(request, response) {
  const userInputValues = request.body;

  const authenticatedUser = await authentication.getAuthenticatedUser(
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

  return response.status(201).json(newSession);
}

async function deleteHandler(request, response) {
  const sessionToken = request.cookies.session_id;

  const sessionObject = await session.findOneValidByToken(sessionToken);
  const expiredSession = await session.expireById(sessionObject.id);
  controller.clearSessionCookie(response);

  return response.status(200).json(expiredSession);
}
