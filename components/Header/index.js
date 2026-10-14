// components/Header/index.js
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import styles from "./index.module.css";

function Header({ title, icon = "fa-tools", backHref }) {
  return (
    <header className={styles.header}>
      <div className={styles.content}>
        {backHref && (
          <Link
            href={backHref}
            className={styles.backBtn}
            title="Voltar ao menu"
            aria-label="Voltar ao menu"
          >
            <i className="fas fa-arrow-left" aria-hidden="true"></i>
          </Link>
        )}
        <i className={`fas ${icon} ${styles.icon}`} aria-hidden="true"></i>
        <span className={styles.title}>{title}</span>
        <ThemeToggle />
      </div>
    </header>
  );
}

export default Header;
