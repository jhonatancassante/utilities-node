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
  const userTryingToUpdate = request.context.user;
  const activationTokenId = request.query.token_id;

  const usedActivationToken = await activation.activate(activationTokenId);

  const secureOutputValues = authorization.filterOutput(
    userTryingToUpdate,
    "read:activation_token",
    usedActivationToken,
  );

  return response.status(200).json(secureOutputValues);
}
