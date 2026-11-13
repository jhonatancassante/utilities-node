import controller from "@/infra/controller.js";
import activation from "@/models/activation.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    PATCH: [controller.canRequest("read:activation_token"), patchHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const activationTokenId = request.query.token_id;

  const validActivationToken =
    await activation.findOneValidById(activationTokenId);

  await activation.activateUserByUserId(validActivationToken.user_id);

  const usedActivationToken =
    await activation.markTokenAsUsed(activationTokenId);

  const secureOutputValues = authorization.filterOutput(
    userTryingToPatch,
    "read:activation_token",
    usedActivationToken,
  );

  return response.status(200).json(secureOutputValues);
}
