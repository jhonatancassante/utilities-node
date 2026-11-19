// components/FileDropzone/index.js
// Área de upload por clique ou arrastar e soltar, reutilizável pelas
// ferramentas que recebem arquivos (PDF, CSV, JSON, TXT).
import { useRef, useState } from "react";
import styles from "./index.module.css";

function FileDropzone({
  label,
  accept,
  multiple = false,
  onFiles,
  ariaLabel = label,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) {
      onFiles(Array.from(event.dataTransfer.files));
    }
  }

  function handleChange(event) {
    if (event.target.files.length > 0) {
      onFiles(Array.from(event.target.files));
    }
    // Permite selecionar o mesmo arquivo de novo depois de limpar a lista.
    event.target.value = "";
  }

  return (
    <div
      className={`${styles.dropzone} ${isDragging ? styles.dragging : ""}`}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <i className="fas fa-file-upload" aria-hidden="true"></i>
      <span>{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        tabIndex={-1}
        hidden
      />
    </div>
  );
}

export default FileDropzone;
