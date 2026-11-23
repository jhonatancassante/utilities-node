import controller from "@/infra/controller.js";
import feature from "@/models/feature.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:feature"), getHandler],
    POST: [
      controller.canRequest("create:feature"),
      controller.canRequest("read:feature"),
      postHandler,
    ],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
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

async function postHandler(request, response) {
  const userTryingToCreate = request.context.user;
  const newFeature = await feature.create(request.body);

  const secureOutputValues = authorization.filterOutput(
    userTryingToCreate,
    "read:feature",
    newFeature,
  );

  return response.status(201).json(secureOutputValues);
}
