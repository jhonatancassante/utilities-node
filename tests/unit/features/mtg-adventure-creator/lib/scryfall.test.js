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

    it("filtra o cenário por terreno e exclui terrenos básicos", () => {
      expect(buildScryfallQuery(ADVENTURE_SLOTS[1], "pt")).toBe(
        "t:land -t:basic lang:pt",
      );
    });

    it("filtra a solução por artefato ou feitiço", () => {
      expect(buildScryfallQuery(ADVENTURE_SLOTS[2], "pt")).toBe(
        "(t:artifact OR t:sorcery) lang:pt",
      );
    });

    it("filtra ajudante e antagonista como criaturas", () => {
      expect(ADVENTURE_SLOTS.slice(3).every((slot) => slot.query === "t:creature")).toBe(true);
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
    it("preserva o texto de ambientação da carta", () => {
      const card = {
        id: "card-id",
        oracle_id: "oracle-id",
        name: "Xorn",
        type_line: "Creature",
        flavor_text: "Xorns are native to the Elemental Plane of Earth.",
        lang: "en",
        scryfall_uri: "https://scryfall.com/card/example",
        image_uris: {
          normal: "https://example.com/card.jpg",
        },
      };

      expect(normalizeScryfallCard(card, ADVENTURE_SLOTS[0]).flavorText).toBe(
        "Xorns are native to the Elemental Plane of Earth.",
      );
    });

    it("combina o texto de ambientação das faces de uma carta dupla", () => {
      const card = {
        id: "card-id",
        oracle_id: "oracle-id",
        name: "Front // Back",
        type_line: "Creature // Creature",
        lang: "en",
        scryfall_uri: "https://scryfall.com/card/example",
        card_faces: [
          { flavor_text: "Flavor text from the front." },
          { flavor_text: "Flavor text from the back." },
        ],
        image_uris: {
          normal: "https://example.com/card.jpg",
        },
      };

      expect(normalizeScryfallCard(card, ADVENTURE_SLOTS[0]).flavorText).toBe(
        "Flavor text from the front.\n\nFlavor text from the back.",
      );
    });

    it("não inventa texto de ambientação quando a carta não possui um", () => {
      const card = {
        id: "card-id",
        oracle_id: "oracle-id",
        name: "Card without flavor text",
        type_line: "Creature",
        lang: "en",
        scryfall_uri: "https://scryfall.com/card/example",
        image_uris: {
          normal: "https://example.com/card.jpg",
        },
      };

      expect(normalizeScryfallCard(card, ADVENTURE_SLOTS[0]).flavorText).toBeUndefined();
    });

    it("prioriza nome e tipo impressos na edição localizada", () => {
      const card = {
        id: "card-id",
        oracle_id: "oracle-id",
        name: "English Name",
        printed_name: "Nome em português",
        type_line: "Creature",
        printed_type_line: "Criatura",
        printed_text: "Texto impresso em português.",
        oracle_text: "English rules text.",
        lang: "pt",
        scryfall_uri: "https://scryfall.com/card/example",
        image_uris: {
          normal: "https://example.com/card.jpg",
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
