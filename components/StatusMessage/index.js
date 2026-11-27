import { useCallback, useEffect, useState } from "react";
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

function ToastNotification({ item, onDismiss }) {
  useEffect(() => {
    const timeout = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(timeout);
  }, [item, onDismiss]);

  return (
    <div
      className={styles.toast + " " + (TYPE_CLASS[item.type] || styles.info)}
      role={item.type === "error" ? "alert" : "status"}
    >
      <i
        className={
          "fas " + (TYPE_ICON[item.type] || TYPE_ICON.info) + " " + styles.icon
        }
        aria-hidden="true"
      ></i>
      <div className={styles.content}>
        <strong>
          {item.type === "success"
            ? "Sucesso"
            : item.type === "warning"
              ? "Atenção"
              : item.type === "error"
                ? "Erro"
                : "Informação"}
        </strong>
        <p>{item.children}</p>
        {item.action && <small>{item.action}</small>}
        <span
          className={styles.progress}
          style={{ animationDuration: `${item.duration}ms` }}
        />
      </div>
      <button
        type="button"
        className={styles.close}
        aria-label="Dispensar notificação"
        onClick={() => onDismiss(item.id)}
      >
        <i className="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  );
}

function StatusMessage({
  type = "info",
  children,
  action,
  name,
  resetKey,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
}) {
  const messageKey = resetKey ?? children;
  const [dismissedKey, setDismissedKey] = useState(null);
  const [toastState, setToastState] = useState({ items: [], nextId: 0 });
  const [lastToastKey, setLastToastKey] = useState(null);
  const isToast =
    !name &&
    !["inline-error", "critical", "warning-modal", "confirmation"].includes(
      type,
    );

  if (isToast && children && messageKey !== lastToastKey) {
    setLastToastKey(messageKey);
    setToastState((currentState) =>
      currentState.items.length >= 3
        ? currentState
        : {
            items: [
              ...currentState.items,
              {
                id: currentState.nextId,
                type,
                children,
                action,
                duration: DISPLAY_DURATION[type] ?? DISPLAY_DURATION.info,
              },
            ],
            nextId: currentState.nextId + 1,
          },
    );
  }

  const dismissToast = useCallback((id) => {
    setToastState((currentState) => ({
      ...currentState,
      items: currentState.items.filter((item) => item.id !== id),
    }));
  }, []);

  if (
    name ||
    type === "critical" ||
    type === "warning-modal" ||
    type === "confirmation"
  ) {
    if (!children || dismissedKey === messageKey) return null;

    const isWarning = ["warning-modal", "confirmation"].includes(type);
    const closeDialog = () => setDismissedKey(messageKey);

    return (
      <Modal
        title={
          <span className={isWarning ? styles.warningTitle : styles.errorTitle}>
            <i
              className={
                "fas " +
                (isWarning
                  ? "fa-exclamation-triangle"
                  : "fa-exclamation-circle")
              }
              aria-hidden="true"
            ></i>
            <span>
              {isWarning ? "Atenção" : name || "Não foi possível concluir"}
            </span>
          </span>
        }
        onClose={type === "confirmation" ? onCancel : closeDialog}
        closeOnBackdrop={false}
        closeOnEscape={false}
        showCloseButton={false}
      >
        <div
          className={isWarning ? styles.warningDialog : styles.errorDialog}
          role="alert"
        >
          <p>{children}</p>
          {action && <small>{action}</small>}
        </div>
        <div className={styles.errorActions}>
          {type === "confirmation" ? (
            <>
              <Button type="button" variant="outline" onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button type="button" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={closeDialog}>
              OK
            </Button>
          )}
        </div>
      </Modal>
    );
  }

  if (type === "inline-error") {
    return (
      <div className={styles.inlineError} role="alert">
        <p>{children}</p>
        {action && <small>{action}</small>}
      </div>
    );
  }

  if (toastState.items.length === 0) return null;

  return (
    <div className={styles.viewport} aria-live="polite">
      <div className={styles.stack}>
        {toastState.items.map((item) => (
          <ToastNotification
            key={item.id}
            item={item}
            onDismiss={dismissToast}
          />
        ))}
      </div>
    </div>
  );
}

export default StatusMessage;
