// components/Header/index.js
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import ThemeToggle from "@/components/ThemeToggle";
import headConfigs from "@/configs/head.js";
import { tools, TOOLS_BASE_PATH } from "@/configs/tools.js";
import styles from "./index.module.css";

const MENU = Object.freeze({ mobile: "mobile", tools: "tools" });

function Header() {
  const router = useRouter();
  const headerRef = useRef(null);
  // Qual menu está aberto: o painel mobile, o submenu de ferramentas ou nenhum.
  const [openMenu, setOpenMenu] = useState(null);

  const closeMenus = () => setOpenMenu(null);
  const isMobileOpen = openMenu === MENU.mobile;
  const isToolsOpen = openMenu === MENU.tools;
  const isToolsRoute = router.pathname.startsWith(TOOLS_BASE_PATH);

  useEffect(() => {
    const close = () => setOpenMenu(null);
    router.events.on("routeChangeStart", close);
    return () => router.events.off("routeChangeStart", close);
  }, [router.events]);

  useEffect(() => {
    if (!openMenu) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpenMenu(null);
    }

    function handlePointerDown(event) {
      if (!headerRef.current?.contains(event.target)) setOpenMenu(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openMenu]);

  function toggleMenu(menu) {
    setOpenMenu((current) => (current === menu ? null : menu));
  }

  return (
    <header className={styles.header} ref={headerRef}>
      <div className={styles.content}>
        <Link href="/" className={styles.brand} onClick={closeMenus}>
          <i className="fas fa-tools" aria-hidden="true"></i>
          <span>{headConfigs.appName}</span>
        </Link>

        <nav
          id="main-nav"
          aria-label="Principal"
          className={`${styles.nav} ${isMobileOpen ? styles.navOpen : ""}`}
        >
          <ul className={styles.navList}>
            <li>
              <NavLink
                href="/"
                active={router.pathname === "/"}
                onNavigate={closeMenus}
              >
                Início
              </NavLink>
            </li>

            <li className={styles.group}>
              <div
                className={`${styles.splitItem} ${isToolsRoute ? styles.navItemActive : ""}`}
              >
                <Link
                  href={TOOLS_BASE_PATH}
                  className={styles.navItem}
                  aria-current={
                    router.pathname === TOOLS_BASE_PATH ? "page" : undefined
                  }
                  onClick={closeMenus}
                >
                  Ferramentas
                </Link>
                <button
                  type="button"
                  className={styles.chevronButton}
                  aria-expanded={isToolsOpen}
                  aria-controls="tools-menu"
                  aria-label="Abrir lista de ferramentas"
                  onClick={() => toggleMenu(MENU.tools)}
                >
                  <i className="fas fa-chevron-down" aria-hidden="true"></i>
                </button>
              </div>

              <ul
                id="tools-menu"
                className={`${styles.dropdown} ${
                  isToolsOpen ? styles.dropdownOpen : ""
                }`}
              >
                {tools.map((tool) => (
                  <li key={tool.slug}>
                    {tool.isAvailable ? (
                      <Link
                        href={tool.href}
                        className={styles.toolItem}
                        aria-current={
                          router.asPath === tool.href ? "page" : undefined
                        }
                        onClick={closeMenus}
                      >
                        <i
                          className={`fas ${tool.icon}`}
                          aria-hidden="true"
                        ></i>
                        <span>{tool.title}</span>
                      </Link>
                    ) : (
                      <span
                        className={`${styles.toolItem} ${styles.toolItemSoon}`}
                        aria-disabled="true"
                      >
                        <i
                          className={`fas ${tool.icon}`}
                          aria-hidden="true"
                        ></i>
                        <span>{tool.title}</span>
                        <small className={styles.soonTag}>Em breve</small>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>

            {router.pathname === "/status" && (
              <li>
                <NavLink
                  href="/status"
                  active={router.pathname === "/status"}
                  onNavigate={closeMenus}
                >
                  Status
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        <div className={styles.actions}>
          {/* Espaço reservado para a futura sessão de login (Entrar / menu do usuário). */}
          <ThemeToggle />
          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={isMobileOpen}
            aria-controls="main-nav"
            aria-label={isMobileOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => toggleMenu(MENU.mobile)}
          >
            <i
              className={`fas ${isMobileOpen ? "fa-times" : "fa-bars"}`}
              aria-hidden="true"
            ></i>
          </button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, active, onNavigate, children }) {
  return (
    <Link
      href={href}
      className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {children}
    </Link>
  );
}

export default Header;
