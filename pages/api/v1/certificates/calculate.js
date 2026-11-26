import controller from "@/infra/controller.js";
import calculateVenalValue from "@/features/certificates/services/calculate-venal-value.js";

export default controller.createController(
  {
    POST: [controller.canRequest("create:certificate"), postHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function postHandler(request, response) {
  const calculatedValues = await calculateVenalValue(request.body);
  return response.status(200).json(calculatedValues);
}
