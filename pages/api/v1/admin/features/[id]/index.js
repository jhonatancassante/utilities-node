import controller from "@/infra/controller.js";
import feature from "@/models/feature.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    PATCH: [
      controller.canRequest("update:feature"),
      controller.canRequest("read:feature"),
      patchHandler,
    ],
    DELETE: [
      controller.canRequest("delete:feature"),
      controller.canRequest("read:feature"),
      deleteHandler,
    ],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function patchHandler(request, response) {
  const userTryingToUpdate = request.context.user;
  const updatedFeature = await feature.update(request.query.id, request.body);

  const secureOutputValues = authorization.filterOutput(
    userTryingToUpdate,
    "read:feature",
    updatedFeature,
  );

  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const deletedFeature = await feature.delete(request.query.id);

  const secureOutputValues = authorization.filterOutput(
    userTryingToDelete,
    "read:feature",
    deletedFeature,
  );

  return response.status(200).json(secureOutputValues);
}
