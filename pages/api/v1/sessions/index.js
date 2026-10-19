import controller from "@/infra/controller.js";
import authentication from "@/models/authentication.js";
import session from "@/models/session.js";

export default controller.createController({
  POST: postHandler,
});

async function postHandler(request, response) {
  const userInputValues = request.body;

  const authenticatedUser = await authentication.getAuthenticatedUser(
    userInputValues.email,
    userInputValues.password,
  );

  const newSession = await session.create(authenticatedUser.id);

  await controller.setSessionCookie(response, newSession.token);

  return response.status(201).json(newSession);
}
