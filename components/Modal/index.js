import { useEffect } from "react";
import styles from "./index.module.css";

function Modal({
  title,
  children,
  onClose,
  wide = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
}) {
  useEffect(() => {
    if (!closeOnEscape) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, onClose]);

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={styles.modal + (wide ? " " + styles.wide : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className={styles.header}>
          <h2 id="modal-title">{title}</h2>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar modal"
            >
              <i className="fas fa-times" aria-hidden="true"></i>
            </button>
          )}
        </header>
        {children}
      </section>
    </div>
  );
}

export default Modal;