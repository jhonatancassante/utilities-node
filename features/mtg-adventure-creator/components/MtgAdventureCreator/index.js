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

function MtgAdventureCreator() {
  const [selectedCard, setSelectedCard] = useState(null);
  const {
    data,
    error,
    isMutating,
    trigger: generateAdventure,
  } = useSWRMutation("/api/v1/entertainment/mtg-adventure", fetcher);
  const cards = data?.cards || [];

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
          onClick={() => generateAdventure()}
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
          <button type="button" onClick={() => generateAdventure()}>
            Tentar novamente
          </button>
        </div>
      )}

      {isMutating && (
        <div className={styles.loading} role="status" aria-live="polite">
          <span className={styles.loader}></span>
          <p>Reunindo os elementos da sua próxima aventura...</p>
        </div>
      )}

      {cards.length > 0 && (
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
                <li className={styles.slot} key={slot.id}>
                  <div className={styles.slotHeading}>
                    <span className={styles.slotNumber}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3>{slot.title}</h3>
                  </div>

                  <button
                    type="button"
                    className={styles.cardButton}
                    onClick={() => setSelectedCard(card)}
                    aria-label={`Ampliar a carta ${card.name}`}
                  >
                    <Image
                      className={styles.cardImage}
                      src={card.image}
                      alt={`Carta ${card.name}, ${card.typeLine}`}
                      width={488}
                      height={680}
                      unoptimized
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
