import {
  ADVENTURE_SLOTS,
  buildScryfallQuery,
  getCardImageUris,
  normalizeScryfallCard,
} from "@/features/mtg-adventure-creator/lib/scryfall.js";

describe("features/mtg-adventure-creator/lib/scryfall.js", () => {
  describe("ADVENTURE_SLOTS", () => {
    it("define os cinco papéis na ordem da aventura", () => {
      expect(ADVENTURE_SLOTS.map((slot) => slot.id)).toEqual([
        "problem",
        "setting",
        "solution",
        "helper",
        "antagonist",
      ]);
    });
  });

  describe("buildScryfallQuery()", () => {
    it("filtra o problema por criatura ou encantamento e idioma", () => {
      expect(buildScryfallQuery(ADVENTURE_SLOTS[0], "pt")).toBe(
        "(t:creature OR t:enchantment) lang:pt",
      );
    });

    it("exclui cartas já escolhidas pelo identificador Oracle", () => {
      expect(
        buildScryfallQuery(ADVENTURE_SLOTS[3], "en", ["oracle-1", "oracle-2"]),
      ).toBe("t:creature lang:en -oracleid:oracle-1 -oracleid:oracle-2");
    });
  });

  describe("getCardImageUris()", () => {
    it("usa as imagens da primeira face quando a carta tem duas faces", () => {
      const imageUris = { large: "https://example.com/card.jpg" };
      const card = {
        card_faces: [{ image_uris: imageUris }, { image_uris: {} }],
      };

      expect(getCardImageUris(card)).toBe(imageUris);
    });
  });

  describe("normalizeScryfallCard()", () => {
    it("prioriza nome e tipo impressos na edição localizada", () => {
      const card = {
        id: "card-id",
        oracle_id: "oracle-id",
        name: "English Name",
        printed_name: "Nome em português",
        type_line: "Creature",
        printed_type_line: "Criatura",
        lang: "pt",
        scryfall_uri: "https://scryfall.com/card/example",
        image_uris: {
          large: "https://example.com/card.jpg",
        },
      };

      expect(normalizeScryfallCard(card, ADVENTURE_SLOTS[0])).toMatchObject({
        name: "Nome em português",
        typeLine: "Criatura",
        language: "pt",
        slotId: "problem",
      });
    });
  });
});
