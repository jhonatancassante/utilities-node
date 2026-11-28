import controller from "@/infra/controller.js";
import realEstateProperty from "@/models/real-estate-property.js";
import authorization from "@/models/authorization.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "100mb",
    },
  },
};

export default controller.createController(
  {
    POST: [controller.canRequest("create:real_estate_property"), postHandler],
    DELETE: [
      controller.canRequest("delete:real_estate_property"),
      deleteHandler,
    ],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function postHandler(request, response) {
  const userTryingToCreate = request.context.user;
  const records = await realEstateProperty.createMany(request.body?.records, {
    overwriteExisting: request.body?.overwriteExisting === true,
  });
  const secureOutputValues = authorization.filterOutput(
    userTryingToCreate,
    "read:real_estate_property",
    records,
  );
  return response.status(201).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const records = await realEstateProperty.deleteMany(request.body?.ids);
  const secureOutputValues = authorization.filterOutput(
    userTryingToDelete,
    "read:real_estate_property",
    records,
  );
  return response.status(200).json(secureOutputValues);
}
