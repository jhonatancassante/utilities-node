import { useEffect, useState } from "react";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import styles from "./index.module.css";

const TYPE_CLASS = {
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
  error: styles.error,
};

const TYPE_ICON = {
  info: "fa-info-circle",
  success: "fa-check-circle",
  warning: "fa-exclamation-triangle",
  error: "fa-exclamation-circle",
};

const DISPLAY_DURATION = {
  info: 4000,
  success: 4000,
  warning: 6000,
  error: 8000,
};

function StatusMessage({ type = "info", children, action, resetKey }) {
  const messageKey = resetKey ?? children;
  const [dismissedKey, setDismissedKey] = useState(null);
  const visible = Boolean(children) && dismissedKey !== messageKey;

  useEffect(() => {
    const duration = DISPLAY_DURATION[type];
    if (!visible || !duration) return undefined;

    const timeout = setTimeout(() => setDismissedKey(messageKey), duration);
    return () => clearTimeout(timeout);
  }, [children, type, resetKey, visible, messageKey]);

  if (!visible) return null;

  if (type === "inline-error") {
    return (
      <div className={styles.inlineError} role="alert">
        <p>{children}</p>
        {action && <small>{action}</small>}
      </div>
    );
  }

  if (type === "critical") {
    return (
      <Modal
        title={
          <span className={styles.errorTitle}>
            <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
            <span>Não foi possível concluir</span>
          </span>
        }
        onClose={() => setDismissedKey(messageKey)}
        closeOnBackdrop={false}
        showCloseButton={false}
      >
        <div className={styles.errorDialog} role="alert">
          <p>{children}</p>
          {action && <small>{action}</small>}
        </div>
        <div className={styles.errorActions}>
          <Button type="button" onClick={() => setDismissedKey(messageKey)}>
            OK
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <div className={styles.viewport} aria-live="polite">
      <div
        className={styles.toast + " " + (TYPE_CLASS[type] || styles.info)}
        role={type === "error" ? "alert" : "status"}
      >
        <i
          className={"fas " + (TYPE_ICON[type] || TYPE_ICON.info) + " " + styles.icon}
          aria-hidden="true"
        ></i>
        <div className={styles.content}>
          <strong>
            {type === "success"
              ? "Sucesso"
              : type === "warning"
                ? "Atenção"
                : type === "error"
                  ? "Erro"
                  : "Informação"}
          </strong>
          <p>{children}</p>
          {action && <small>{action}</small>}
          <span className={styles.progress} />
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Dispensar notificação"
          onClick={() => setDismissedKey(messageKey)}
        >
          <i className="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}

export default StatusMessage;