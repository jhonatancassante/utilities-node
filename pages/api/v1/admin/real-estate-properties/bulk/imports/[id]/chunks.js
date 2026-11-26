import controller from "@/infra/controller.js";
import realEstateProperty from "@/models/real-estate-property.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

export default controller.createController(
  {
    POST: [controller.canRequest("create:real_estate_property"), postHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function postHandler(request, response) {
  const result = await realEstateProperty.addImportChunk({
    importId: request.query.id,
    userId: request.context.user.id,
    chunkIndex: request.body?.chunkIndex,
    records: request.body?.records,
  });
  return response.status(200).json(result);
}
