import controller from "@/infra/controller.js";
import certificate from "@/models/certificate.js";
import calculateVenalValue from "@/features/certificates/services/calculate-venal-value.js";
import authorization from "@/models/authorization.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:certificate"), getHandler],
    POST: [
      controller.canRequest("create:certificate"),
      controller.requireJsonObjectBody({
        message: "Os dados da certidão devem ser enviados em um objeto.",
        action: "Envie um objeto com os campos da certidão.",
      }),
      postHandler,
    ],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const records = await certificate.findAll();
  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:certificate",
    records,
  );
  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToCreate = request.context.user;
  const { is_updated: isUpdated = true, ...certificateInput } = request.body;
  const calculatedValues = await calculateVenalValue({
    physical_property_id: certificateInput.physical_property_id,
    year: certificateInput.year,
    owner_rg: certificateInput.owner_rg,
    is_updated: isUpdated,
  });
  const record = await certificate.create(
    { ...certificateInput, ...calculatedValues },
    userTryingToCreate.id,
  );
  const secureOutputValues = authorization.filterOutput(
    userTryingToCreate,
    "read:certificate",
    record,
  );
  return response.status(201).json(secureOutputValues);
}
