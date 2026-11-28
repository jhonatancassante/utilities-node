import styles from "./index.module.css";

function TableSection({ title, countLabel, actions, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <h2>{title}</h2>
          {countLabel && <span>{countLabel}</span>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export default TableSection;
