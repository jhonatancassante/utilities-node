import controller from "@/infra/controller.js";
import realEstateProperty from "@/models/real-estate-property.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    POST: [controller.canRequest("create:real_estate_property"), postHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function postHandler(request, response) {
  const currentUser = request.context.user;
  const records = await realEstateProperty.finalizeImport({
    importId: request.query.id,
    userId: currentUser.id,
    overwriteExisting: request.body?.overwriteExisting === true,
  });
  const output = authorization.filterOutput(
    currentUser,
    "read:real_estate_property",
    records,
  );
  return response.status(201).json(output);
}
