import controller from "@/infra/controller.js";
import feature from "@/models/feature.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:feature"), getHandler],
    POST: [controller.canRequest("create:feature"), postHandler],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function getHandler(request, response) {
  const features = await feature.findAll();
  return response.status(200).json(features.map(filterFeatureOutput));
}

async function postHandler(request, response) {
  const newFeature = await feature.create(request.body);
  return response.status(201).json(filterFeatureOutput(newFeature));
}

function filterFeatureOutput(featureObject) {
  return {
    id: featureObject.id,
    name: featureObject.name,
    label: featureObject.label,
    group_name: featureObject.group_name,
    description: featureObject.description,
    is_removable: featureObject.is_removable,
    is_privileged: featureObject.is_privileged,
    is_protected: featureObject.is_protected,
    created_at: featureObject.created_at,
    updated_at: featureObject.updated_at,
  };
}
