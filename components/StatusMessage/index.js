import { useEffect, useState } from "react";
import styles from "./index.module.css";
const TYPE_CLASS = { info: styles.info, success: styles.success, warning: styles.warning, error: styles.error };
const TYPE_ICON = { info: "fa-info-circle", success: "fa-check-circle", warning: "fa-exclamation-triangle", error: "fa-times-circle" };
function StatusMessage({ type = "info", children, action }) {
  const [visible, setVisible] = useState(Boolean(children));
  useEffect(() => {
    setVisible(Boolean(children));
    if (!children || type === "error") return undefined;
    const timeout = setTimeout(() => setVisible(false), 10000);
    return () => clearTimeout(timeout);
  }, [children, type]);
  if (!visible || !children) return null;
  return (
    <div className={styles.viewport} aria-live={type === "error" ? "assertive" : "polite"}>
      <div className={styles.toast + " " + (TYPE_CLASS[type] || styles.info)} role={type === "error" ? "alert" : "status"}>
        <i className={"fas " + (TYPE_ICON[type] || TYPE_ICON.info) + " " + styles.icon} aria-hidden="true"></i>
        <div className={styles.content}>
          <strong>{type === "success" ? "Sucesso" : type === "warning" ? "Atenção" : type === "error" ? "Erro" : "Informação"}</strong>
          <p>{children}</p>
          {action && <small>{action}</small>}
          {type === "error" ? <button type="button" onClick={() => setVisible(false)}>OK</button> : <span className={styles.progress} />}
        </div>
        {type !== "error" && <button type="button" className={styles.close} aria-label="Dispensar notificação" onClick={() => setVisible(false)}><i className="fas fa-times" aria-hidden="true"></i></button>}
      </div>
    </div>
  );
}
export default StatusMessage;