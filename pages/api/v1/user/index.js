import controller from "@/infra/controller.js";
import session from "@/models/session.js";
import user from "@/models/user.js";

export default controller.createController({
  GET: getHandler,
});

async function getHandler(request, response) {
  const sessionToken = request.cookies.session_id;

  const sessionObject = await session.findOneValidByToken(sessionToken);

  const userFound = await user.findOneById(sessionObject.user_id);

  return response.status(200).json(userFound);
}
