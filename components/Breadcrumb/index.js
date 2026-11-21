import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import { getToolBySlug } from "@/configs/tools.js";
import styles from "./index.module.css";

const ROUTE_LABELS = Object.freeze({
  "/": "Início",
  "/cadastro": "Criar conta",
  "/login": "Entrar",
  "/perfil": "Meu perfil",
  "/status": "Status",
  "/admin": "Administração",
  "/admin/audit": "Auditoria",
  "/admin/audit/banned": "Contas banidas",
  "/admin/features": "Gerenciar features",
  "/admin/users": "Gerenciar usuários",
  "/tools": "Ferramentas",
  "/diario-oficial": "Diário Oficial",
});

function getRouteLabel(path, segment) {
  if (ROUTE_LABELS[path]) return ROUTE_LABELS[path];

  if (path.startsWith("/tools/")) {
    const tool = getToolBySlug(segment);
    if (tool) return tool.title;
  }

  return decodeURIComponent(segment)
    .split("-")
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1))
    .join(" ");
}

function Breadcrumb() {
  const router = useRouter();
  const menuRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const items = useMemo(() => {
    const pathname = router.asPath.split(/[?#]/)[0];
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return [];

    return [
      { href: "/", label: "Início" },
      ...segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        return { href, label: getRouteLabel(href, segment) };
      }),
    ];
  }, [router.asPath]);

  const hiddenItems = items.slice(1, -2);
  const visibleItems = items.length > 3 ? [items[0], ...items.slice(-2)] : items;

  useEffect(() => {
    function handleRouteChange() {
      setIsMenuOpen(false);
    }

    router.events.on("routeChangeStart", handleRouteChange);

    return () => {
      router.events.off("routeChangeStart", handleRouteChange);
    };
  }, [router.events]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  if (items.length < 2) return null;

  return (
    <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
      <ol className={styles.list}>
        <li className={styles.item}>
          <Link href={items[0].href} className={styles.link}>
            {items[0].label}
          </Link>
        </li>

        {hiddenItems.length > 0 && (
          <li className={styles.item} ref={menuRef}>
            <button
              type="button"
              className={styles.moreButton}
              aria-label="Mostrar páginas intermediárias"
              aria-expanded={isMenuOpen}
              aria-controls="breadcrumb-hidden-items"
              title="Mostrar páginas intermediárias"
              onClick={() => setIsMenuOpen((current) => !current)}
            >
              <i className="fas fa-ellipsis-h" aria-hidden="true"></i>
            </button>
            {isMenuOpen && (
              <ul className={styles.dropdown} id="breadcrumb-hidden-items">
                {hiddenItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={styles.dropdownLink}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}

        {visibleItems.slice(1, -1).map((item) => (
          <li className={styles.item} key={item.href}>
            <Link href={item.href} className={styles.link}>
              {item.label}
            </Link>
          </li>
        ))}

        <li className={`${styles.item} ${styles.current}`} aria-current="page">
          <span>{items[items.length - 1].label}</span>
        </li>
      </ol>
    </nav>
  );
}

export default Breadcrumb;
