import controller from "@/infra/controller.js";
import session from "@/models/session.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:session"), getHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const sessionToken = request.cookies.session_id;

  const sessionObject = await session.findOneValidByToken(sessionToken);

  const renewedSessionObject = await session.renew(sessionObject.id);

  controller.setSessionCookie(response, renewedSessionObject.token);

  const userFound = await user.findOneById(sessionObject.user_id);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:user:self",
    userFound,
  );

  return response.status(200).json(secureOutputValues);
}
