import * as cookie from "cookie";
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

  const setCookie = cookie.stringifySetCookie({
    name: "session_id",
    value: newSession.token,
    path: "/",
    maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  response.setHeader("Set-Cookie", setCookie);

  return response.status(201).json(newSession);
}
