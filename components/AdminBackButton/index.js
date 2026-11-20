import Link from "next/link";
import styles from "./index.module.css";

function AdminBackButton() {
  return (
    <Link
      href="/admin"
      className={styles.button}
      aria-label="Voltar ao painel administrativo"
      title="Voltar ao painel administrativo"
    >
      <i className="fas fa-arrow-left" aria-hidden="true"></i>
    </Link>
  );
}

export default AdminBackButton;
