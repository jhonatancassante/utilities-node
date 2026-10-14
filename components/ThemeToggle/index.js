// components/ThemeToggle/index.js
import { useSyncExternalStore } from "react";
import styles from "./index.module.css";

const STORAGE_KEY = "theme";

// A fonte da verdade é o atributo data-theme em <html>, aplicado antes da
// primeira pintura pelo script do _document.js (a partir do localStorage).
function subscribe(callback) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

const getSnapshot = () =>
  document.documentElement.getAttribute("data-theme") || "light";

// No servidor o tema é desconhecido; o ícone é corrigido após a hidratação.
const getServerSnapshot = () => "light";

function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === "dark";

  function toggleTheme() {
    const nextTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Armazenamento indisponível: o tema vale apenas nesta sessão.
    }
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      title="Alternar tema"
      aria-label="Alternar entre tema claro e escuro"
    >
      <i
        className={`fas ${isDark ? "fa-sun" : "fa-moon"}`}
        aria-hidden="true"
      ></i>
    </button>
  );
}

export default ThemeToggle;
