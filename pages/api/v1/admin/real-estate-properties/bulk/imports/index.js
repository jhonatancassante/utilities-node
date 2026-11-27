import controller from "@/infra/controller.js";
import realEstateProperty from "@/models/real-estate-property.js";

export default controller.createController(
  {
    POST: [controller.canRequest("create:real_estate_property"), postHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function postHandler(request, response) {
  const result = await realEstateProperty.createImport({
    userId: request.context.user.id,
    totalRecords: request.body?.totalRecords,
    totalChunks: request.body?.totalChunks,
  });
  return response.status(201).json(result);
}
