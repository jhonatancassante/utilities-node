import controller from "@/infra/controller.js";
import feature from "@/models/feature.js";

export default controller.createController(
  {
    PATCH: [controller.canRequest("update:feature"), patchHandler],
    DELETE: [controller.canRequest("delete:feature"), deleteHandler],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function patchHandler(request, response) {
  const updatedFeature = await feature.update(request.query.id, request.body);
  return response.status(200).json(filterFeatureOutput(updatedFeature));
}

async function deleteHandler(request, response) {
  const deletedFeature = await feature.delete(request.query.id);
  return response.status(200).json(filterFeatureOutput(deletedFeature));
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
