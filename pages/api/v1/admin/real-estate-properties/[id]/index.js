import controller from "@/infra/controller.js";
import realEstateProperty from "@/models/real-estate-property.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:real_estate_properties"), getHandler],
    PATCH: [
      controller.canRequest("update:real_estate_properties"),
      controller.canRequest("read:real_estate_properties"),
      patchHandler,
    ],
    DELETE: [
      controller.canRequest("delete:real_estate_properties"),
      controller.canRequest("read:real_estate_properties"),
      deleteHandler,
    ],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const currentUser = request.context.user;
  const record = await realEstateProperty.findOneById(request.query.id);
  const output = authorization.filterOutput(
    currentUser,
    "read:real_estate_properties",
    record,
  );
  return response.status(200).json(output);
}

async function patchHandler(request, response) {
  const currentUser = request.context.user;
  const record = await realEstateProperty.update(request.query.id, request.body);
  const output = authorization.filterOutput(
    currentUser,
    "read:real_estate_properties",
    record,
  );
  return response.status(200).json(output);
}

async function deleteHandler(request, response) {
  const currentUser = request.context.user;
  const record = await realEstateProperty.delete(request.query.id);
  const output = authorization.filterOutput(
    currentUser,
    "read:real_estate_properties",
    record,
  );
  return response.status(200).json(output);
}
