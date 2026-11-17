// components/WarningList/index.js
// Aviso em destaque amarelo com uma lista de itens. A lista tem altura máxima
// e rolagem própria, para continuar legível mesmo com centenas de itens.
import styles from "./index.module.css";

function WarningList({ title, items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className={styles.warning} role="status">
      <p className={styles.title}>
        <i className="fas fa-exclamation-triangle" aria-hidden="true"></i>
        {title}
      </p>
      <ul className={styles.list} tabIndex={0} aria-label={title}>
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default WarningList;
