import controller from "@/infra/controller.js";
import user from "@/models/user.js";

export default controller.createController({
  GET: getHandler,
});

async function getHandler(request, response) {
  const username = request.query.username;

  const userFound = await user.findOneByUsername(username);

  return response.status(200).json(userFound);
}
