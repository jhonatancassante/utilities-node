import controller from "@/infra/controller.js";
import activation from "@/models/activation.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    POST: [controller.canRequest("create:user"), postHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function postHandler(request, response) {
  const userTryingToGet = request.context.user;
  const userInputValues = request.body;

  const newUser = await user.create(userInputValues);

  const activationToken = await activation.create(newUser.id);
  await activation.sendEmailToUser(newUser, activationToken);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:user",
    newUser,
  );

  return response.status(201).json(secureOutputValues);
}
