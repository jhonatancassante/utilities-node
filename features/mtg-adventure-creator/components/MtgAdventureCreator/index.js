import { useEffect, useState } from "react";
import useSWRMutation from "swr/mutation";
import Image from "next/image";
import { ADVENTURE_SLOTS } from "@/features/mtg-adventure-creator/lib/scryfall.js";
import styles from "./index.module.css";

const fetcher = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      "Não foi possível buscar as cartas agora. Tente novamente em instantes.",
    );
  }

  return response.json();
};

function AdventureCard({ card, slot, index, onSelect }) {
  const [imageStatus, setImageStatus] = useState("loading");

  return (
    <li className={styles.slot}>
      <div className={styles.slotHeading}>
        <span className={styles.slotNumber}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3>{slot.title}</h3>
      </div>

      <button
        type="button"
        className={styles.cardButton}
        onClick={() => onSelect(card)}
        aria-label={`Ampliar a carta ${card.name}`}
        disabled={imageStatus !== "loaded"}
      >
        {imageStatus === "loading" && (
          <span className={styles.cardImagePlaceholder} role="status">
            <span className={styles.cardImageLoader}></span>
            <span>Carregando imagem...</span>
          </span>
        )}
        {imageStatus === "error" && (
          <span className={styles.cardImageError} role="status">
            <i className="fas fa-image" aria-hidden="true"></i>
            Imagem indisponível
          </span>
        )}
        <Image
          className={`${styles.cardImage} ${imageStatus === "loaded" ? styles.cardImageLoaded : ""}`}
          src={card.image}
          alt={`Carta ${card.name}, ${card.typeLine}`}
          width={488}
          height={680}
          unoptimized
          onLoad={() => setImageStatus("loaded")}
          onError={() => setImageStatus("error")}
        />
      </button>

      <div className={styles.cardCaption}>
        <h4>{card.name}</h4>
        <span>{card.typeLine}</span>
        {card.language !== "pt" && (
          <span className={styles.languageNotice}>
            <i className="fas fa-language" aria-hidden="true"></i>
            Edição em inglês
          </span>
        )}
      </div>

      {card.flavorText && (
        <blockquote className={styles.flavorText}>
          {card.flavorText}
        </blockquote>
      )}

      <p className={styles.slotDescription}>{slot.description}</p>
    </li>
  );
}

function MtgAdventureCreator() {
  const [selectedCard, setSelectedCard] = useState(null);
  const [cards, setCards] = useState([]);
  const {
    error,
    isMutating,
    trigger: generateAdventure,
  } = useSWRMutation("/api/v1/entertainment/mtg-adventure", fetcher);

  async function handleGenerateAdventure() {
    setCards([]);
    setSelectedCard(null);

    try {
      const result = await generateAdventure();
      setCards(result.cards || []);
    } catch {
      // O erro é apresentado pelo estado de erro do SWR.
    }
  }

  useEffect(() => {
    if (!selectedCard) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setSelectedCard(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCard]);

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>
          <i className="fas fa-dice-d20" aria-hidden="true"></i>
          Gerador de histórias
        </span>
        <h1>Uma aventura em cinco cartas</h1>
        <p>
          Cinco cartas, cinco papéis e infinitas possibilidades. Deixe o acaso
          escolher os ingredientes e descubra que história pode nascer deles.
        </p>
        <button
          type="button"
          className={styles.generateButton}
          onClick={handleGenerateAdventure}
          disabled={isMutating}
        >
          <i
            className={`fas ${isMutating ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`}
            aria-hidden="true"
          ></i>
          {isMutating
            ? "Consultando a biblioteca..."
            : cards.length > 0
              ? "Gerar nova aventura"
              : "Nova aventura"}
        </button>
      </section>

      {error && (
        <div className={styles.error} role="alert">
          <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{error.message}</span>
          <button
            type="button"
            onClick={handleGenerateAdventure}
            disabled={isMutating}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {isMutating && (
        <section
          className={styles.results}
          aria-label="Carregando cartas da aventura"
          aria-live="polite"
        >
          <div className={styles.resultsHeading}>
            <div>
              <span className={styles.sectionEyebrow}>Preparando sua história</span>
              <h2>Os cinco elementos da aventura</h2>
            </div>
            <span className={styles.cardCount}>05 CARTAS</span>
          </div>
          <ol className={styles.cardGrid}>
            {ADVENTURE_SLOTS.map((slot, index) => (
              <li className={styles.slot} key={slot.id}>
                <div className={styles.slotHeading}>
                  <span className={styles.slotNumber}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3>{slot.title}</h3>
                </div>
                <div className={styles.cardLoadingPlaceholder}>
                  <span className={styles.cardImageLoader}></span>
                  <span>Buscando carta...</span>
                </div>
                <div className={styles.skeletonCaption}>
                  <span></span>
                  <span></span>
                </div>
                <p className={styles.slotDescription}>{slot.description}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!isMutating && cards.length > 0 && (
        <section className={styles.results} aria-label="Cartas da aventura">
          <div className={styles.resultsHeading}>
            <div>
              <span className={styles.sectionEyebrow}>Sua história começa aqui</span>
              <h2>Os cinco elementos da aventura</h2>
            </div>
            <span className={styles.cardCount}>05 CARTAS</span>
          </div>

          <ol className={styles.cardGrid}>
            {ADVENTURE_SLOTS.map((slot, index) => {
              const card = cards.find((item) => item.slotId === slot.id);
              if (!card) return null;

              return (
                <AdventureCard
                  key={`${slot.id}-${card.image}`}
                  card={card}
                  slot={slot}
                  index={index}
                  onSelect={setSelectedCard}
                />
              );
            })}
          </ol>
        </section>
      )}

      {selectedCard && (
        <div
          className={styles.imageModal}
          role="presentation"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className={styles.imageModalContent}
            role="dialog"
            aria-modal="true"
            aria-label={`Carta ampliada: ${selectedCard.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.imageModalClose}
              onClick={() => setSelectedCard(null)}
              aria-label="Fechar visualização da carta"
            >
              <i className="fas fa-times" aria-hidden="true"></i>
            </button>
            <Image
              className={styles.imageModalImage}
              src={selectedCard.image}
              alt={`Carta ${selectedCard.name}, ${selectedCard.typeLine}`}
              width={488}
              height={680}
              unoptimized
              priority
            />
          </div>
        </div>
      )}

      <footer className={styles.attribution}>
        <span>
          Cartas e informações fornecidas pela{" "}
          <a href="https://scryfall.com/" target="_blank" rel="noreferrer">
            Scryfall
          </a>
          . Cartas em português são priorizadas; uma edição em inglês será usada
          somente quando não houver uma impressão em português disponível para
          aquele tipo de carta.
        </span>
      </footer>
    </main>
  );
}

export default MtgAdventureCreator;
