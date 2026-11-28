import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";

import StatusMessage from "@/components/StatusMessage";
import ThemeToggle from "@/components/ThemeToggle";
import headConfigs from "@/configs/head.js";
import { tools, TOOLS_BASE_PATH } from "@/configs/tools.js";
import {
  entertainmentApps,
  ENTERTAINMENT_BASE_PATH,
} from "@/configs/entertainment.js";
import { hasAdminAccess } from "@/models/authorization.js";
import useUser from "@/hooks/use-user.js";
import session from "@/lib/client/session.js";
import styles from "./index.module.css";

const MENU = Object.freeze({
  mobile: "mobile",
  tools: "tools",
  account: "account",
});

function Header() {
  const router = useRouter();
  const headerRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const [isEntertainmentExpanded, setIsEntertainmentExpanded] = useState(false);
  const [logoutError, setLogoutError] = useState(null);
  const { user, clearUser } = useUser();

  const closeMenus = () => {
    setOpenMenu(null);
    setIsToolsExpanded(false);
    setIsEntertainmentExpanded(false);
  };
  const isMobileOpen = openMenu === MENU.mobile;
  const isToolsOpen = isToolsExpanded;
  const isAccountOpen = openMenu === MENU.account;
  const isToolsRoute = router.pathname.startsWith(TOOLS_BASE_PATH);
  const isEntertainmentOpen = isEntertainmentExpanded;
  const isEntertainmentRoute = router.pathname.startsWith(
    ENTERTAINMENT_BASE_PATH,
  );

  useEffect(() => {
    const close = () => {
      setOpenMenu(null);
      setIsToolsExpanded(false);
      setIsEntertainmentExpanded(false);
    };
    router.events.on("routeChangeStart", close);
    return () => router.events.off("routeChangeStart", close);
  }, [router.events]);

  useEffect(() => {
    if (!openMenu && !isToolsExpanded && !isEntertainmentExpanded) {
      return;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setIsToolsExpanded(false);
        setIsEntertainmentExpanded(false);
      }
    }

    function handlePointerDown(event) {
      if (!headerRef.current?.contains(event.target)) {
        setOpenMenu(null);
        setIsToolsExpanded(false);
        setIsEntertainmentExpanded(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openMenu, isToolsExpanded, isEntertainmentExpanded]);

  function toggleMenu(menu) {
    setOpenMenu((current) => (current === menu ? null : menu));
    setLogoutError(null);
  }

  function toggleTools() {
    setIsToolsExpanded((current) => !current);
    setIsEntertainmentExpanded(false);
  }

  function toggleEntertainment() {
    setIsEntertainmentExpanded((current) => !current);
    setIsToolsExpanded(false);
  }

  async function handleLogout() {
    try {
      await session.logout();
      await clearUser();
      closeMenus();
      router.push("/login");
    } catch (error) {
      setLogoutError({ id: Date.now(), message: error.message });
    }
  }

  return (
    <header className={styles.header} ref={headerRef}>
      <div className={styles.content}>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={isMobileOpen}
          aria-controls="main-nav"
          aria-label={isMobileOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => {
            toggleMenu(MENU.mobile);
            if (isMobileOpen) {
              setIsToolsExpanded(false);
              setIsEntertainmentExpanded(false);
            }
          }}
        >
          <i
            className={`fas ${isMobileOpen ? "fa-times" : "fa-bars"}`}
            aria-hidden="true"
          ></i>
        </button>

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
                <i className="fas fa-home" aria-hidden="true"></i>
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
                  <i className="fas fa-briefcase" aria-hidden="true"></i>
                  Ferramentas
                </Link>
                <button
                  type="button"
                  className={styles.chevronButton}
                  aria-expanded={isToolsOpen}
                  aria-controls="tools-menu"
                  aria-label={
                    isToolsOpen
                      ? "Recolher lista de ferramentas"
                      : "Expandir lista de ferramentas"
                  }
                  onClick={toggleTools}
                >
                  <i className="fas fa-chevron-down" aria-hidden="true"></i>
                </button>
              </div>

              <ul
                id="tools-menu"
                className={`${styles.dropdown} ${isToolsOpen ? styles.dropdownOpen : ""}`}
              >
                {tools
                  .filter(
                    (tool) =>
                      !tool.requiredFeature ||
                      user?.features?.includes(tool.requiredFeature),
                  )
                  .map((tool) => (
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

            <li className={styles.group}>
              <div
                className={`${styles.splitItem} ${isEntertainmentRoute ? styles.navItemActive : ""}`}
              >
                <Link
                  href={ENTERTAINMENT_BASE_PATH}
                  className={styles.navItem}
                  aria-current={
                    router.pathname === ENTERTAINMENT_BASE_PATH
                      ? "page"
                      : undefined
                  }
                  onClick={closeMenus}
                >
                  <i className="fas fa-gamepad" aria-hidden="true"></i>
                  Entretenimento
                </Link>
                <button
                  type="button"
                  className={styles.chevronButton}
                  aria-expanded={isEntertainmentOpen}
                  aria-controls="entertainment-menu"
                  aria-label={
                    isEntertainmentOpen
                      ? "Recolher lista de entretenimento"
                      : "Expandir lista de entretenimento"
                  }
                  onClick={toggleEntertainment}
                >
                  <i className="fas fa-chevron-down" aria-hidden="true"></i>
                </button>
              </div>

              <ul
                id="entertainment-menu"
                className={`${styles.dropdown} ${isEntertainmentOpen ? styles.dropdownOpen : ""}`}
              >
                {entertainmentApps.map((app) => (
                  <li key={app.slug}>
                    <Link
                      href={app.href}
                      className={styles.toolItem}
                      aria-current={
                        router.asPath === app.href ? "page" : undefined
                      }
                      onClick={closeMenus}
                    >
                      <i className={`fas ${app.icon}`} aria-hidden="true"></i>
                      <span>{app.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>

            {router.pathname === "/status" && (
              <li>
                <NavLink href="/status" active onNavigate={closeMenus}>
                  Status
                </NavLink>
              </li>
            )}

            {user === null && (
              <>
                <li className={styles.mobileSignup}>
                  <Link
                    href="/cadastro"
                    className={styles.signupLink}
                    onClick={closeMenus}
                  >
                    <i className="fas fa-user-plus" aria-hidden="true"></i>
                    Criar conta
                  </Link>
                </li>
                <li className={styles.mobileSignup}>
                  <Link
                    href="/login"
                    className={styles.loginLink}
                    onClick={closeMenus}
                  >
                    <i className="fas fa-sign-in-alt" aria-hidden="true"></i>
                    Entrar
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>

        <div className={styles.actions}>
          {user === null && (
            <div className={styles.accountActions}>
              <Link
                href="/cadastro"
                className={styles.signupLink}
                onClick={closeMenus}
              >
                <i className="fas fa-user-plus" aria-hidden="true"></i>
                Criar conta
              </Link>
              <Link
                href="/login"
                className={styles.loginLink}
                onClick={closeMenus}
              >
                <i className="fas fa-sign-in-alt" aria-hidden="true"></i>
                Entrar
              </Link>
            </div>
          )}

          {user && (
            <div className={styles.accountMenu}>
              <button
                type="button"
                className={styles.avatar}
                aria-label={`Abrir menu da conta de ${user.username}`}
                aria-expanded={isAccountOpen}
                aria-controls="account-menu"
                onClick={() => toggleMenu(MENU.account)}
              >
                {user.profile_photo_url ? (
                  <Image
                    className={styles.avatarPhoto}
                    src={user.profile_photo_url}
                    alt=""
                    width={42}
                    height={42}
                    loading="eager"
                    unoptimized
                  />
                ) : (
                  getInitials(user.username)
                )}
              </button>
              <div
                id="account-menu"
                className={`${styles.accountDropdown} ${isAccountOpen ? styles.accountDropdownOpen : ""}`}
              >
                <span className={styles.accountName}>{user.username}</span>
                <Link
                  href="/perfil"
                  className={styles.accountItem}
                  onClick={closeMenus}
                >
                  <i className="fas fa-user" aria-hidden="true"></i>
                  Meu perfil
                </Link>
                {hasAdminAccess(user) && (
                  <Link
                    href="/admin"
                    className={styles.accountItem}
                    onClick={closeMenus}
                  >
                    <i className="fas fa-shield-alt" aria-hidden="true"></i>
                    Administração
                  </Link>
                )}
                <div className={styles.themeItem}>
                  <ThemeToggle />
                </div>
                <button
                  type="button"
                  className={styles.accountItem}
                  onClick={handleLogout}
                >
                  <i className="fas fa-sign-out-alt" aria-hidden="true"></i>
                  Sair
                </button>
              </div>
            </div>
          )}

          {user === null && <ThemeToggle />}
        </div>
      </div>
      {logoutError && (
        <StatusMessage type="error" resetKey={logoutError.id}>
          {logoutError.message}
        </StatusMessage>
      )}
    </header>
  );
}

function getInitials(username) {
  const parts = username.split(/[-_]+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (initials || username.slice(0, 2)).toUpperCase();
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
