// components/HelpToggle/index.js
// Botão "Como funciona?" que mostra e oculta uma caixa informativa.
import { useId, useState } from "react";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function HelpToggle({ label = "Como funciona?", children }) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.button}
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={() => setIsOpen((current) => !current)}
      >
        <i className="fas fa-question-circle" aria-hidden="true"></i>
        {label}
      </button>

      {isOpen && (
        <div id={id} className={shared.infoBox}>
          {children}
        </div>
      )}
    </>
  );
}

export default HelpToggle;
