import controller from "@/infra/controller.js";
import activation from "@/models/activation.js";
import user from "@/models/user.js";

export default controller.createController({
  POST: postHandler,
});

async function postHandler(request, response) {
  const userInputValues = request.body;

  const newUser = await user.create(userInputValues);

  const activationToken = await activation.create(newUser.id);
  await activation.sendEmailToUser(newUser, activationToken);

  return response.status(201).json(newUser);
}
