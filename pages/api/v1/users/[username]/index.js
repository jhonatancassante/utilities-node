import controller from "@/infra/controller.js";
import user from "@/models/user.js";

export default controller.createController({
  GET: getHandler,
  PATCH: patchHandler,
});

async function getHandler(request, response) {
  const username = request.query.username;

  const userFound = await user.findOneByUsername(username);

  return response.status(200).json(userFound);
}

async function patchHandler(request, response) {
  const username = request.query.username;
  const userInputValues = request.body;

  const updatedUser = await user.update(username, userInputValues);

  return response.status(200).json(updatedUser);
}
