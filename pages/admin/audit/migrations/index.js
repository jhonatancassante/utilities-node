import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import AdminBackButton from "@/components/AdminBackButton";
import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import { hasAdminAccess } from "@/models/authorization.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export default function AdminMigrationAuditPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [migrations, setMigrations] = useState([]);
  const [isLoadingMigrations, setIsLoadingMigrations] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }

    if (!isLoading && user && !user.features?.includes("read:audit")) {
      router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
    }
  }, [error, isLoading, router, user]);

  useEffect(() => {
    if (isLoading || !user?.features?.includes("read:audit")) {
      return undefined;
    }

    let active = true;

    async function loadMigrations() {
      setIsLoadingMigrations(true);

      try {
        const result = await requestAPI("/api/v1/admin/audit/migrations");

        if (active) setMigrations(result);
      } catch (requestError) {
        if (active) {
          setFeedback({
            name: requestError.statusCode ? requestError.name : undefined,
            message: requestError.message,
            action: requestError.action,
          });
        }
      } finally {
        if (active) setIsLoadingMigrations(false);
      }
    }

    loadMigrations();

    return () => {
      active = false;
    };
  }, [isLoading, user]);

  if (isLoading || (!user && !error)) {
    return (
      <>
        <AppHead title="Migrations executadas" />
        <Layout>
          <main className={`${shared.container} ${shared.containerUltraWide}`}>
            <section className={`${shared.card} ${styles.card}`}>
              <p>Carregando permissões...</p>
            </section>
          </main>
        </Layout>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AppHead title="Migrations executadas" />
        <Layout>
          <main className={`${shared.container} ${shared.containerUltraWide}`}>
            <section className={`${shared.card} ${styles.card}`}>
              <StatusMessage type="critical">
                Não foi possível verificar suas permissões.
              </StatusMessage>
            </section>
          </main>
        </Layout>
      </>
    );
  }

  if (!user?.features?.includes("read:audit")) return null;

  return (
    <>
      <AppHead
        title="Migrations executadas"
        description="Histórico de migrations aplicadas ao banco de dados."
      />
      <Layout>
        <main className={`${shared.container} ${shared.containerUltraWide}`}>
          <section
            className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}
          >
            <AdminBackButton
              href="/admin/audit"
              label="Voltar para auditoria"
            />

            <header className={styles.header}>
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-database"></i>
              </div>
              <span className={shared.badge}>AUDITORIA</span>
              <h1>Migrations executadas</h1>
              <p>
                Histórico das migrations registradas pelo node-pg-migrate no
                banco de dados atual.
              </p>
            </header>

            <section className={styles.summary} aria-label="Resumo do histórico">
              <div>
                <strong>
                  {isLoadingMigrations ? "..." : migrations.length}
                </strong>
                <span>Migrations registradas</span>
              </div>
            </section>

            {feedback && (
              <StatusMessage
                type="error"
                name={feedback.name}
                action={feedback.action}
              >
                {feedback.message}
              </StatusMessage>
            )}

            {isLoadingMigrations ? (
              <p className={styles.empty}>Consultando o histórico...</p>
            ) : feedback ? (
              <p className={styles.empty}>
                Não foi possível carregar os registros de migrations.
              </p>
            ) : migrations.length === 0 ? (
              <p className={styles.empty}>
                Ainda não há migrations registradas neste banco de dados.
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Migration</th>
                      <th>Executada em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {migrations.map((migration) => (
                      <tr key={migration.id}>
                        <td>{migration.id}</td>
                        <td>
                          <strong>{migration.name}</strong>
                        </td>
                        <td>{formatDate(migration.run_on)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className={styles.footnote}>
              Os registros são lidos diretamente da tabela pgmigrations. A
              listagem representa o histórico mantido pelo banco consultado e
              não identifica o usuário que iniciou cada execução.
            </p>
          </section>
        </main>
      </Layout>
    </>
  );
}
