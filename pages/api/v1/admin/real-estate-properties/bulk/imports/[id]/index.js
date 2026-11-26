import controller from "@/infra/controller.js";
import realEstateProperty from "@/models/real-estate-property.js";

export default controller.createController(
  {
    DELETE: [controller.canRequest("create:real_estate_property"), deleteHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function deleteHandler(request, response) {
  const result = await realEstateProperty.cancelImport({
    importId: request.query.id,
    userId: request.context.user.id,
  });
  return response.status(200).json(result);
}
