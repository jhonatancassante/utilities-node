const ScryfallApi = "https://api.scryfall.com";
const RequestInterval = 100;

export const ADVENTURE_SLOTS = Object.freeze([
  {
    id: "problem",
    title: "O problema",
    description:
      "Algo que sempre existiu nesta região finalmente saiu do controle — ou surgiu de repente, sem que ninguém consiga explicar como.",
    query: "(t:creature OR t:enchantment)",
  },
  {
    id: "setting",
    title: "O cenário",
    description:
      "O lugar onde tudo acontece. Que segredos este território guarda e por que a aventura chegou até aqui?",
    query: "t:land -t:basic",
  },
  {
    id: "solution",
    title: "A solução",
    description:
      "Um objeto ou poder capaz de resolver a situação. Talvez ninguém precise dele de verdade, mas convenhamos: ir buscá-lo é muito mais interessante.",
    query: "(t:artifact OR t:sorcery)",
  },
  {
    id: "helper",
    title: "O ajudante",
    description:
      "Alguém que deseja ver o problema resolvido e pode oferecer ajuda — embora seus motivos nem sempre sejam tão simples.",
    query: "t:creature",
  },
  {
    id: "antagonist",
    title: "O antagonista",
    description:
      "Alguém que prefere que tudo continue como está — ou que tem muito a perder caso a situação seja resolvida.",
    query: "t:creature",
  },
]);

export function buildScryfallQuery(slot, language, excludedOracleIds = []) {
  const exclusions = excludedOracleIds
    .filter(Boolean)
    .map((oracleId) => "-oracleid:" + oracleId)
    .join(" ");

  return [slot.query, "lang:" + language, exclusions]
    .filter(Boolean)
    .join(" ");
}

export function getCardImageUris(card) {
  if (card.image_uris) return card.image_uris;

  const firstFace = card.card_faces?.find((face) => face.image_uris);
  return firstFace?.image_uris || null;
}

export function normalizeScryfallCard(card, slot) {
  const imageUris = getCardImageUris(card);
  const useWebp = new Date() >= new Date("2027-01-01T00:00:00Z");
  const image = useWebp
    ? imageUris?.display || imageUris?.large || imageUris?.normal
    : imageUris?.large || imageUris?.normal || imageUris?.jpeg;

  if (!image) {
    throw new Error("A Scryfall não retornou uma imagem para esta carta.");
  }

  return {
    id: card.id,
    oracleId: card.oracle_id,
    name: card.printed_name || card.name,
    typeLine: card.printed_type_line || card.type_line,
    image,
    scryfallUri: card.scryfall_uri,
    language: card.lang,
    slotId: slot.id,
  };
}

async function waitForNextRequest() {
  await new Promise((resolve) => setTimeout(resolve, RequestInterval));
}

async function requestRandomCard(query) {
  const url = ScryfallApi + "/cards/random?q=" + encodeURIComponent(query);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Utilities-MTG-Adventure-Creator/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = new Error("A Scryfall não encontrou uma carta para esta seleção.");
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function getRandomCardForSlot(slot, excludedOracleIds) {
  const portugueseQuery = buildScryfallQuery(slot, "pt", excludedOracleIds);

  try {
    const card = await requestRandomCard(portugueseQuery);
    return normalizeScryfallCard(card, slot);
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  await waitForNextRequest();
  const englishQuery = buildScryfallQuery(slot, "en", excludedOracleIds);
  const card = await requestRandomCard(englishQuery);
  return normalizeScryfallCard(card, slot);
}

export async function getAdventureCards() {
  const cards = [];
  const excludedOracleIds = [];

  for (const slot of ADVENTURE_SLOTS) {
    if (cards.length > 0) await waitForNextRequest();

    const card = await getRandomCardForSlot(slot, excludedOracleIds);
    cards.push(card);

    if (card.oracleId) excludedOracleIds.push(card.oracleId);
  }

  return cards;
}
