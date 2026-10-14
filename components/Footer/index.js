// components/Footer/index.js
import styles from "./index.module.css";

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.social}>
        <a
          href="https://github.com/jhonatancassante"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub de Jhonatan Cassante"
        >
          <i className="fab fa-github" aria-hidden="true"></i>
        </a>
        <a
          href="https://www.instagram.com/jhonatancassante/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram de Jhonatan Cassante"
        >
          <i className="fab fa-instagram" aria-hidden="true"></i>
        </a>
      </div>
      <div className={styles.copyright}>
        © {new Date().getFullYear()} Jhonatan Cassante. Todos os direitos
        reservados.
      </div>
    </footer>
  );
}

export default Footer;
