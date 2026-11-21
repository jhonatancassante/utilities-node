import { useState } from "react";
import NextImage from "next/image";

import styles from "./index.module.css";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MIN_DIMENSION = 128;
const MAX_DIMENSION = 2048;

function ProfilePhotoField({ value, initialUrl, onChange, disabled = false }) {
  const [error, setError] = useState("");
  const preview = value || initialUrl;

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Selecione uma imagem JPEG, PNG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("A imagem deve ter no máximo 2 MB.");
      event.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (
        image.naturalWidth < MIN_DIMENSION ||
        image.naturalHeight < MIN_DIMENSION ||
        image.naturalWidth > MAX_DIMENSION ||
        image.naturalHeight > MAX_DIMENSION
      ) {
        setError("A largura e a altura devem ficar entre 128 e 2048 pixels.");
        event.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result);
      reader.onerror = () =>
        setError("Não foi possível ler a imagem selecionada.");
      reader.readAsDataURL(file);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError("O arquivo selecionado não contém uma imagem válida.");
      event.target.value = "";
    };
    image.src = objectUrl;
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>Foto de perfil</span>
      <div className={styles.control}>
        {preview ? (
          <NextImage
            className={styles.preview}
            src={preview}
            alt="Prévia da foto de perfil"
            width={88}
            height={88}
            unoptimized
          />
        ) : (
          <span className={styles.placeholder} aria-hidden="true">
            <i className="fas fa-user" />
          </span>
        )}
        <div className={styles.actions}>
          <label className={styles.uploadButton}>
            <i className="fas fa-camera" aria-hidden="true" />
            {preview ? "Trocar imagem" : "Escolher imagem"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={disabled}
            />
          </label>
          <small>JPEG, PNG ou WebP · até 2 MB · 128–2048 px</small>
          <small>
            Imagens serão exibidas em formato quadrado, com corte central
            automático.
          </small>
        </div>
      </div>
      {error && (
        <small className={styles.error} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export default ProfilePhotoField;
