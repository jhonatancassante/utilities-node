import controller from "@/infra/controller.js";
import position from "@/models/position.js";

export default controller.createController(
  { GET: [controller.canRequest("update:user:others"), getHandler] },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const positions = await position.findAll();
  return response.status(200).json(positions.map(({ name }) => ({ name })));
}
