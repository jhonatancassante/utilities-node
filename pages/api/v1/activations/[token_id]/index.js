import controller from "@/infra/controller.js";
import activation from "@/models/activation";

export default controller.createController({
  PATCH: patchHandler,
});

async function patchHandler(request, response) {
  const activationTokenId = request.query.token_id;

  const usedActivationToken =
    await activation.markTokenAsUsed(activationTokenId);
  await activation.activateUserByUserId(usedActivationToken.user_id);

  return response.status(200).json(usedActivationToken);
}
