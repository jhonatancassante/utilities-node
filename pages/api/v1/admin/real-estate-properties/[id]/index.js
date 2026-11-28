import controller from "@/infra/controller.js";
import realEstateProperty from "@/models/real-estate-property.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:real_estate_property"), getHandler],
    PATCH: [controller.canRequest("update:real_estate_property"), patchHandler],
    DELETE: [
      controller.canRequest("delete:real_estate_property"),
      deleteHandler,
    ],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const record = await realEstateProperty.findOneById(request.query.id);
  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:real_estate_property",
    record,
  );
  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToUpdate = request.context.user;
  const record = await realEstateProperty.update(
    request.query.id,
    request.body,
  );
  const secureOutputValues = authorization.filterOutput(
    userTryingToUpdate,
    "read:real_estate_property",
    record,
  );
  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const record = await realEstateProperty.delete(request.query.id);
  const secureOutputValues = authorization.filterOutput(
    userTryingToDelete,
    "read:real_estate_property",
    record,
  );
  return response.status(200).json(secureOutputValues);
}
