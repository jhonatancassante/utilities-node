import controller from "@/infra/controller.js";
import feature from "@/models/feature.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:feature"), getHandler],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const features = await feature.findAll();

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:feature",
    features,
  );

  return response.status(200).json(secureOutputValues);
}
