import { useEffect, useState } from "react";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import styles from "./index.module.css";

const TYPE_CLASS = {
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
};

const TYPE_ICON = {
  info: "fa-info-circle",
  success: "fa-check-circle",
  warning: "fa-exclamation-triangle",
};

const DISPLAY_DURATION = {
  info: 4000,
  success: 4000,
  warning: 6000,
};

function StatusMessage({ type = "info", children, action }) {
  const [visible, setVisible] = useState(Boolean(children));

  useEffect(() => {
    setVisible(Boolean(children));

    const duration = DISPLAY_DURATION[type];
    if (!children || !duration) return undefined;

    const timeout = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timeout);
  }, [children, type]);

  if (!visible || !children) return null;

  if (type === "error") {
    return (
      <Modal
        title={
          <span className={styles.errorTitle}>
            <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
            <span>Não foi possível concluir</span>
          </span>
        }
        onClose={() => setVisible(false)}
        closeOnBackdrop={false}
        showCloseButton={false}
      >
        <div className={styles.errorDialog} role="alert">
          <p>{children}</p>
          {action && <small>{action}</small>}
        </div>
        <div className={styles.errorActions}>
          <Button type="button" onClick={() => setVisible(false)}>
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
        role="status"
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
          onClick={() => setVisible(false)}
        >
          <i className="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}

export default StatusMessage;