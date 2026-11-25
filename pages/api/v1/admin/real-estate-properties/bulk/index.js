import controller from "@/infra/controller.js";
import realEstateProperty from "@/models/real-estate-property.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    POST: [
      controller.canRequest("create:real_estate_properties"),
      controller.canRequest("read:real_estate_properties"),
      postHandler,
    ],
    DELETE: [
      controller.canRequest("delete:real_estate_properties"),
      controller.canRequest("read:real_estate_properties"),
      deleteHandler,
    ],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function postHandler(request, response) {
  const currentUser = request.context.user;
  const records = await realEstateProperty.createMany(request.body?.records, {
    overwriteExisting: request.body?.overwriteExisting === true,
  });
  const output = authorization.filterOutput(
    currentUser,
    "read:real_estate_properties",
    records,
  );
  return response.status(201).json(output);
}

async function deleteHandler(request, response) {
  const currentUser = request.context.user;
  const records = await realEstateProperty.deleteMany(request.body?.ids);
  const output = authorization.filterOutput(
    currentUser,
    "read:real_estate_properties",
    records,
  );
  return response.status(200).json(output);
}
