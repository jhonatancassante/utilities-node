import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import {
  getAvailableAdminSections,
  hasAdminAccess,
} from "@/models/authorization.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function AdminPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }
    if (!isLoading && user && !hasAdminAccess(user)) {
      router.replace("/perfil");
    }
  }, [error, isLoading, router, user]);

  const sections = getAvailableAdminSections(user);

  return (
    <>
      <AppHead
        title="Administração"
        description="Gerencie os recursos administrativos do Utilities."
      />
      <Layout>
        <main className={`${shared.container} ${shared.containerUltraWide}`}>
          {isLoading || (!user && !error) ? (
            <section
              className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}
              aria-live="polite"
            >
              <p>Carregando painel administrativo...</p>
            </section>
          ) : error ? (
            <section
              className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}
            >
              <StatusMessage type="error">
                Não foi possível verificar suas permissões.
              </StatusMessage>
            </section>
          ) : user && hasAdminAccess(user) ? (
            <section
              className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}
            >
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-shield-alt"></i>
              </div>
              <span className={shared.badge}>ÁREA RESTRITA</span>
              <h1>Administração</h1>
              <p className={styles.description}>
                Selecione uma área para administrar os recursos disponíveis de
                acordo com suas permissões.
              </p>

              <div className={styles.sections}>
                {sections.map((section) => (
                  <Link
                    key={section.id}
                    href={section.href}
                    className={styles.section}
                  >
                    <span className={styles.sectionIcon} aria-hidden="true">
                      <i className={`fas ${section.icon}`}></i>
                    </span>
                    <span className={styles.sectionContent}>
                      <strong>{section.title}</strong>
                      <small>{section.description}</small>
                    </span>
                    <i className="fas fa-chevron-right" aria-hidden="true"></i>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </Layout>
    </>
  );
}

export default AdminPage;
