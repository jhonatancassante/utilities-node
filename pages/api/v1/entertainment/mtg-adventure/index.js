import controller from "@/infra/controller.js";
import { getAdventureCards } from "@/features/mtg-adventure-creator/lib/scryfall.js";

export default controller.createController(
  { GET: getHandler },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function getHandler(request, response) {
  const cards = await getAdventureCards();

  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({ cards });
}
