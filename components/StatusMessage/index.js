// components/StatusMessage/index.js
// Mensagem de andamento, sucesso ou erro. O contêiner fica sempre na página
// para que leitores de tela anunciem as mudanças de texto.
import styles from "./index.module.css";

const TYPE_CLASS = {
  info: styles.info,
  success: styles.success,
  error: styles.error,
};

function StatusMessage({ type = "info", children }) {
  return (
    <div className={styles.container} aria-live="polite">
      {children && (
        <p className={`${styles.message} ${TYPE_CLASS[type] ?? styles.info}`}>
          {children}
        </p>
      )}
    </div>
  );
}

export default StatusMessage;
