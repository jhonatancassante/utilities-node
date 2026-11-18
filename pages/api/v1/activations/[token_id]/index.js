import controller from "@/infra/controller.js";
import activation from "@/models/activation.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    PATCH: [controller.canRequest("read:activation_token"), patchHandler],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const activationTokenId = request.query.token_id;

  await activation.findOneValidById(activationTokenId);

  const usedActivationToken = await activation.activate(activationTokenId);

  const secureOutputValues = authorization.filterOutput(
    userTryingToPatch,
    "read:activation_token",
    usedActivationToken,
  );

  return response.status(200).json(secureOutputValues);
}
