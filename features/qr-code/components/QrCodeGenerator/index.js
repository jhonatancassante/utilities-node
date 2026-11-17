// features/qr-code/components/QrCodeGenerator/index.js
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import shared from "@/styles/shared.module.css";
import { downloadElementAsPng } from "../../lib/download.js";
import { normalizeUrl } from "../../lib/url.js";
import ColorField from "../ColorField";
import QrCard from "../QrCard";
import styles from "./index.module.css";

const DEFAULT_COLORS = Object.freeze({
  qr: "#000000",
  bg: "#ffffff",
  border: "#2554c7",
  text: "#ffffff",
});

const COLOR_FIELDS = [
  { key: "qr", label: "Cor do QR Code:" },
  { key: "bg", label: "Cor do fundo:" },
  { key: "border", label: "Cor da borda:" },
  { key: "text", label: "Cor do texto:" },
];

function QrCodeGenerator() {
  const [url, setUrl] = useState("");
  const [colors, setColors] = useState(DEFAULT_COLORS);
  // O QR só muda ao clicar em "Gerar": guardamos o que foi gerado.
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const inputRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (generated) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [generated]);

  function handleSubmit(event) {
    event.preventDefault();

    const result = normalizeUrl(url);
    if (!result.ok) {
      setError(result.error);
      inputRef.current?.focus();
      return;
    }

    setError("");
    setGenerated({ value: result.value, colors });
  }

  function handleColorChange(key, value) {
    setColors((current) => ({ ...current, [key]: value }));
  }

  async function handleDownload() {
    if (!cardRef.current) return;

    setIsDownloading(true);
    try {
      await downloadElementAsPng(cardRef.current);
    } catch {
      setError("Não foi possível gerar a imagem. Tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  }

  function handleClear() {
    setUrl("");
    setColors(DEFAULT_COLORS);
    setGenerated(null);
    setError("");
    inputRef.current?.focus();
  }

  return (
    <div className={styles.generator}>
      <button
        type="button"
        className={styles.helpButton}
        aria-expanded={showHelp}
        aria-controls="qr-help"
        onClick={() => setShowHelp((current) => !current)}
      >
        <i className="fas fa-question-circle" aria-hidden="true"></i>
        Como funciona?
      </button>

      {showHelp && (
        <div id="qr-help" className={shared.infoBox}>
          <strong>Como funciona:</strong> digite o link que deseja codificar,
          escolha as cores e clique em &quot;Gerar QR Code&quot;. Depois, baixe
          a imagem com fundo transparente.
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="qr-url" className={shared.label}>
          Link a codificar
        </label>
        <input
          id="qr-url"
          ref={inputRef}
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="Digite o link que deseja codificar..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "qr-error" : undefined}
          className={`${shared.input} ${error ? shared.inputInvalid : ""}`}
        />
        {error && (
          <p id="qr-error" role="alert" className={shared.errorText}>
            {error}
          </p>
        )}

        <div className={styles.colors}>
          {COLOR_FIELDS.map(({ key, label }) => (
            <ColorField
              key={key}
              id={`qr-color-${key}`}
              label={label}
              value={colors[key]}
              onChange={(value) => handleColorChange(key, value)}
            />
          ))}
        </div>

        <div className={styles.actions}>
          <Button type="submit" icon="fa-qrcode">
            Gerar QR Code
          </Button>
        </div>
      </form>

      {generated && (
        <>
          <div className={styles.result}>
            <QrCard
              ref={cardRef}
              value={generated.value}
              colors={generated.colors}
            />
          </div>

          <div className={styles.actions}>
            <Button
              icon="fa-download"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? "Gerando imagem..." : "Download QR Code"}
            </Button>
            <Button variant="danger" icon="fa-trash-alt" onClick={handleClear}>
              Limpar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default QrCodeGenerator;
