import controller from "@/infra/controller.js";
import certificate from "@/models/certificate.js";
import calculateVenalValue from "@/features/certificates/services/calculate-venal-value.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:certificate"), getHandler],
    POST: [controller.canRequest("create:certificate"), postHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const currentUser = request.context.user;
  const records = await certificate.findAll();
  const output = authorization.filterOutput(
    currentUser,
    "read:certificate",
    records,
  );
  return response.status(200).json(output);
}

async function postHandler(request, response) {
  const currentUser = request.context.user;
  const calculatedValues = await calculateVenalValue({
    physical_property_id: request.body.physical_property_id,
    year: request.body.year,
    owner_rg: request.body.owner_rg,
    is_updated: request.body.is_updated,
  });
  const record = await certificate.create(
    { ...request.body, ...calculatedValues },
    currentUser.id,
  );
  const output = authorization.filterOutput(
    currentUser,
    "read:certificate",
    record,
  );
  return response.status(201).json(output);
}
