import { useEffect, useState } from "react";

import AdminBackButton from "@/components/AdminBackButton";
import AccessFallback from "@/components/AccessFallback";
import AppHead from "@/components/AppHead";
import DataTable from "@/components/DataTable";
import useSortableData from "@/hooks/use-sortable-data.js";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useAccessGate, { featureCheck } from "@/hooks/use-access-gate.js";
import { feedbackFromError } from "@/lib/client/feedback.js";
import { formatDateTime } from "@/lib/client/format.js";
import requestAPI from "@/lib/client/api.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

export default function AdminMigrationAuditPage() {
  const access = useAccessGate({
    checks: [featureCheck("read:audit")],
  });
  const { user, isLoading } = access;
  const [migrations, setMigrations] = useState([]);
  const [isLoadingMigrations, setIsLoadingMigrations] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (isLoading || !user?.features?.includes("read:audit")) {
      return undefined;
    }

    let active = true;

    async function loadMigrations() {
      setIsLoadingMigrations(true);

      try {
        const result = await requestAPI("/api/v1/admin/audit/migrations");

        if (active) {
          setMigrations(result);
        }
      } catch (requestError) {
        if (active) {
          setFeedback({
            ...feedbackFromError(requestError),
          });
        }
      } finally {
        if (active) {
          setIsLoadingMigrations(false);
        }
      }
    }

    loadMigrations();

    return () => {
      active = false;
    };
  }, [isLoading, user]);

  const sort = useSortableData(migrations);

  if (access.state !== "allowed") {
    return <AccessFallback title="Migrations executadas" access={access} />;
  }

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

            <section
              className={styles.summary}
              aria-label="Resumo do histórico"
            >
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

            <DataTable
              records={sort.sortedRecords}
              loading={isLoadingMigrations}
              loadingMessage="Consultando o histórico..."
              emptyMessage={
                feedback
                  ? "Não foi possível carregar os registros de migrations."
                  : "Ainda não há migrations registradas neste banco de dados."
              }
              columns={[
                { key: "id", label: "ID" },
                {
                  key: "name",
                  label: "Migration",
                  render: (migration) => <strong>{migration.name}</strong>,
                },
                {
                  key: "run_on",
                  label: "Executada em",
                  render: (migration) => formatDateTime(migration.run_on),
                },
              ]}
              sort={sort}
              caption="Migrations executadas"
            />

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
