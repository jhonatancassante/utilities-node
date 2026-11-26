import controller from "@/infra/controller.js";
import realEstateProperty from "@/models/real-estate-property.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:real_estate_property"), getHandler],
    POST: [
      controller.canRequest("create:real_estate_property"),
      controller.canRequest("read:real_estate_property"),
      postHandler,
    ],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const currentUser = request.context.user;
  const records = await realEstateProperty.findAll();
  const output = authorization.filterOutput(
    currentUser,
    "read:real_estate_property",
    records,
  );
  return response.status(200).json(output);
}

async function postHandler(request, response) {
  const currentUser = request.context.user;
  const record = await realEstateProperty.create(request.body);
  const output = authorization.filterOutput(
    currentUser,
    "read:real_estate_property",
    record,
  );
  return response.status(201).json(output);
}
