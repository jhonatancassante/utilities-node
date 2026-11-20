import controller from "@/infra/controller.js";
import feature from "@/models/feature.js";

export default controller.createController(
  {
    GET: [controller.canRequest("update:user:others"), getHandler],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function getHandler(request, response) {
  const features = await feature.findAll();

  return response.status(200).json(
    features.map((featureObject) => ({
      name: featureObject.name,
      label: featureObject.label,
      group_name: featureObject.group_name,
      description: featureObject.description,
      is_removable: featureObject.is_removable,
      is_privileged: featureObject.is_privileged,
      is_protected: featureObject.is_protected,
    })),
  );
}
