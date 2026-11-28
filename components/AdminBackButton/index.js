import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./index.module.css";

function AdminBackButton({
  href = "/admin",
  label = "Voltar ao painel administrativo",
}) {
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    function updatePosition() {
      const button = document.querySelector("[data-admin-back-button]");
      if (!button) {
        return;
      }

      const stickyTop = Number.parseFloat(window.getComputedStyle(button).top);
      setIsStuck(button.getBoundingClientRect().top <= stickyTop + 1);
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, []);

  return (
    <Link
      href={href}
      className={`${styles.button} ${isStuck ? styles.stuck : ""}`}
      aria-label={label}
      title={label}
      data-admin-back-button
    >
      <i className="fas fa-arrow-left" aria-hidden="true"></i>
    </Link>
  );
}

export default AdminBackButton;
