import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ADVENTURE_SLOTS } from "@/features/mtg-adventure-creator/lib/scryfall.js";
import styles from "./index.module.css";

function MtgAdventureCreator() {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const generateAdventure = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/v1/entertainment/mtg-adventure");

      if (!response.ok) {
        throw new Error(
          "Não foi possível buscar as cartas agora. Tente novamente em instantes.",
        );
      }

      const result = await response.json();
      setCards(result.cards);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    generateAdventure();
  }, [generateAdventure]);

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
          onClick={generateAdventure}
          disabled={isLoading}
        >
          <i
            className={\`fas ${isLoading ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}\`}
            aria-hidden="true"
          ></i>
          {isLoading ? "Consultando a biblioteca..." : "Gerar nova aventura"}
        </button>
      </section>

      {error && (
        <div className={styles.error} role="alert">
          <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{error}</span>
          <button type="button" onClick={generateAdventure}>
            Tentar novamente
          </button>
        </div>
      )}

      {isLoading && cards.length === 0 && (
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

                  <a
                    className={styles.cardLink}
                    href={card.scryfallUri}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={\`Ver ${card.name} no site da Scryfall\`}
                  >
                    <Image
                      className={styles.cardImage}
                      src={card.image}
                      alt={\`Carta ${card.name}, ${card.typeLine}\`}
                      width={488}
                      height={680}
                      unoptimized
                    />
                  </a>

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

                  <p className={styles.slotDescription}>{slot.description}</p>
                </li>
              );
            })}
          </ol>
        </section>
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
