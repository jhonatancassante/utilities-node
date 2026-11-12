import controller from "@/infra/controller.js";
import activation from "@/models/activation";

export default controller.createController(
  {
    PATCH: [controller.canRequest("read:activation_token"), patchHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function patchHandler(request, response) {
  const activationTokenId = request.query.token_id;

  const validActivationToken =
    await activation.findOneValidById(activationTokenId);

  await activation.activateUserByUserId(validActivationToken.user_id);

  const usedActivationToken =
    await activation.markTokenAsUsed(activationTokenId);

  return response.status(200).json(usedActivationToken);
}
