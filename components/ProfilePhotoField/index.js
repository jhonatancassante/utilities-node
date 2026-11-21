import { useEffect, useRef, useState } from "react";
import NextImage from "next/image";

import styles from "./index.module.css";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MIN_DIMENSION = 128;
const MAX_DIMENSION = 2048;
const VIEWPORT_SIZE = 280;
const OUTPUT_SIZE = 1024;

function ProfilePhotoField({ value, initialUrl, onChange, disabled = false }) {
  const [error, setError] = useState("");
  const [cropSource, setCropSource] = useState("");
  const [imageSize, setImageSize] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState(VIEWPORT_SIZE);
  const cropViewportRef = useRef(null);
  const dragRef = useRef(null);
  const preview = value || initialUrl;

  const scale = imageSize
    ? Math.max(
        viewportSize / imageSize.width,
        viewportSize / imageSize.height,
      ) * zoom
    : 1;
  const imageWidth = imageSize ? imageSize.width * scale : VIEWPORT_SIZE;
  const imageHeight = imageSize ? imageSize.height * scale : VIEWPORT_SIZE;
  const maxOffsetX = Math.max(0, (imageWidth - viewportSize) / 2);
  const maxOffsetY = Math.max(0, (imageHeight - viewportSize) / 2);
  const safeOffset = {
    x: Math.min(maxOffsetX, Math.max(-maxOffsetX, offset.x)),
    y: Math.min(maxOffsetY, Math.max(-maxOffsetY, offset.y)),
  };
  const imageLeft = (viewportSize - imageWidth) / 2 + safeOffset.x;
  const imageTop = (viewportSize - imageHeight) / 2 + safeOffset.y;

  useEffect(
    () => () => {
      if (cropSource) URL.revokeObjectURL(cropSource);
    },
    [cropSource],
  );

  useEffect(() => {
    if (!cropSource || !cropViewportRef.current) return;
    setViewportSize(cropViewportRef.current.getBoundingClientRect().width);
  }, [cropSource]);

  function closeCropper() {
    setCropSource("");
    setImageSize(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setViewportSize(VIEWPORT_SIZE);
  }

  function handleFileChange(event) {
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
      if (
        image.naturalWidth < MIN_DIMENSION ||
        image.naturalHeight < MIN_DIMENSION ||
        image.naturalWidth > MAX_DIMENSION ||
        image.naturalHeight > MAX_DIMENSION
      ) {
        URL.revokeObjectURL(objectUrl);
        setError("A largura e a altura devem ficar entre 128 e 2048 pixels.");
        event.target.value = "";
        return;
      }
      setImageSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setCropSource(objectUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError("O arquivo selecionado não contém uma imagem válida.");
      event.target.value = "";
    };
    image.src = objectUrl;
    event.target.value = "";
  }

  function handlePointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: safeOffset.x,
      offsetY: safeOffset.y,
    };
  }

  function handlePointerMove(event) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId)
      return;
    setOffset({
      x: dragRef.current.offsetX + event.clientX - dragRef.current.startX,
      y: dragRef.current.offsetY + event.clientY - dragRef.current.startY,
    });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleCrop() {
    if (!cropSource || !imageSize) return;

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) {
        setError("Não foi possível preparar o recorte.");
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      const sourceX = Math.max(0, -imageLeft / scale);
      const sourceY = Math.max(0, -imageTop / scale);
      const sourceSize = viewportSize / scale;

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );
      onChange(canvas.toDataURL("image/jpeg", 0.92));
      closeCropper();
    };
    image.onerror = () => setError("Não foi possível preparar o recorte.");
    image.src = cropSource;
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
          <small>Você poderá mover e ampliar a imagem antes de salvar.</small>
        </div>
      </div>
      {error && (
        <small className={styles.error} role="alert">
          {error}
        </small>
      )}

      {cropSource && imageSize && (
        <div
          className={styles.cropOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCropper();
          }}
        >
          <section
            className={styles.cropDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-photo-crop-title"
          >
            <h2 id="profile-photo-crop-title">Ajustar foto de perfil</h2>
            <p>Arraste a imagem para posicionar o rosto dentro do círculo.</p>
            <div
              ref={cropViewportRef}
              className={styles.cropViewport}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onLostPointerCapture={handlePointerUp}
            >
              <NextImage
                className={styles.cropImage}
                src={cropSource}
                alt="Imagem sendo ajustada"
                width={imageWidth}
                height={imageHeight}
                unoptimized
                draggable={false}
                style={{
                  width: imageWidth,
                  height: "auto",
                  left: imageLeft,
                  top: imageTop,
                }}
              />
              <span className={styles.cropGuide} aria-hidden="true" />
            </div>
            <label className={styles.zoomControl}>
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
            <div className={styles.cropActions}>
              <button type="button" onClick={closeCropper}>
                Cancelar
              </button>
              <button type="button" onClick={handleCrop}>
                Usar esta foto
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default ProfilePhotoField;
