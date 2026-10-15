import controller from "@/infra/controller.js";
import user from "@/models/user.js";

export default controller.createController({
  POST: postHandler,
});

async function postHandler(request, response) {
  const userInputValues = request.body;

  const newUser = await user.create(userInputValues);
  return response.status(201).json(newUser);
}
