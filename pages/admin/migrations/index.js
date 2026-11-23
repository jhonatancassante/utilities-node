import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import AdminBackButton from "@/components/AdminBackButton";
import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import Modal from "@/components/Modal";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import {
  hasAdminAccess,
  hasAdminSectionAccess,
} from "@/models/authorization.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function AdminMigrationsPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [pendingMigrations, setPendingMigrations] = useState([]);
  const [isLoadingMigrations, setIsLoadingMigrations] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const hasMigrationAccess =
    !isLoading && Boolean(user) && hasAdminSectionAccess(user, "migrations");
  const canExecute = user?.features?.includes("create:migration") ?? false;

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }

    if (
      !isLoading &&
      user &&
      !hasAdminSectionAccess(user, "migrations")
    ) {
      router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
    }
  }, [error, isLoading, router, user]);

  async function loadPendingMigrations({ showFeedback = true } = {}) {
    setIsLoadingMigrations(true);

    try {
      const migrations = await requestAPI("/api/v1/migrations");
      setPendingMigrations(migrations);
      setHasLoadError(false);
      return { success: true, migrations };
    } catch (requestError) {
      setHasLoadError(true);
      if (showFeedback) {
        setFeedback({
          type: "error",
          name: requestError.statusCode ? requestError.name : undefined,
          message: requestError.message,
          action: requestError.action,
        });
      }

      return { success: false, error: requestError };
    } finally {
      setIsLoadingMigrations(false);
    }
  }

  useEffect(() => {
    if (!hasMigrationAccess) return undefined;

    let active = true;

    async function loadInitialState() {
      setIsLoadingMigrations(true);

      try {
        const migrations = await requestAPI("/api/v1/migrations");
        if (active) {
          setPendingMigrations(migrations);
          setHasLoadError(false);
        }
      } catch (requestError) {
        if (!active) return;

        setHasLoadError(true);
        setFeedback({
          type: "error",
          name: requestError.statusCode ? requestError.name : undefined,
          message: requestError.message,
          action: requestError.action,
        });
      } finally {
        if (active) setIsLoadingMigrations(false);
      }
    }

    loadInitialState();

    return () => {
      active = false;
    };
  }, [hasMigrationAccess]);

  async function handleRefresh() {
    setFeedback(null);
    const result = await loadPendingMigrations();

    if (result.success) {
      setFeedback({
        type: "success",
        message: result.migrations.length
          ? "Verificação concluída. Há migrations pendentes."
          : "Verificação concluída. O banco está atualizado.",
      });
    }
  }

  async function handleExecute() {
    const migrationsBeforeExecution = pendingMigrations;
    setIsConfirmationOpen(false);
    setIsExecuting(true);
    setFeedback(null);

    try {
      const appliedMigrations = await requestAPI("/api/v1/migrations", {
        method: "POST",
      });
      const refreshResult = await loadPendingMigrations({
        showFeedback: false,
      });

      if (!refreshResult.success) {
        setFeedback({
          type: "error",
          name: refreshResult.error.statusCode
            ? refreshResult.error.name
            : undefined,
          message:
            "A API confirmou a execução, mas não foi possível consultar o estado atual das migrations.",
          action:
            "Não repita a operação antes de verificar o estado do banco de dados.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: appliedMigrations.length
          ? `${appliedMigrations.length} migration(s) aplicada(s) com sucesso.`
          : "Não havia migrations pendentes para executar.",
      });
    } catch (requestError) {
      const refreshResult = await loadPendingMigrations({
        showFeedback: false,
      });

      if (!refreshResult.success) {
        setFeedback({
          type: "error",
          name: requestError.statusCode ? requestError.name : undefined,
          message:
            "A execução não foi confirmada e não foi possível consultar novamente o estado do banco. O resultado é indeterminado.",
          action:
            "Não tente executar novamente até que a conexão com o banco seja restabelecida e as migrations sejam verificadas.",
        });
        return;
      }

      const remainingPaths = new Set(
        refreshResult.migrations.map((migration) => migration.path),
      );
      const noLongerPending = migrationsBeforeExecution.filter(
        (migration) => !remainingPaths.has(migration.path),
      );
      const appliedNames = noLongerPending.map((migration) => migration.name);
      const pendingNames = refreshResult.migrations.map(
        (migration) => migration.name,
      );

      setFeedback({
        type: "error",
        name: requestError.statusCode ? requestError.name : undefined,
        message: noLongerPending.length
          ? `A execução foi interrompida. Deixaram de constar como pendentes: ${appliedNames.join(", ")}. Ainda pendentes: ${pendingNames.join(", ") || "nenhuma"}.`
          : requestError.message,
        action: noLongerPending.length
          ? "O estado foi consultado novamente. Confira a lista atual antes de qualquer nova tentativa."
          : requestError.action ||
            "Verifique o estado do banco antes de tentar novamente.",
      });
    } finally {
      setIsExecuting(false);
    }
  }

  if (isLoading || (!user && !error)) {
    return (
      <>
        <AppHead title="Gerenciar migrations" />
        <Layout>
          <main className={`${shared.container} ${shared.containerUltraWide}`}>
            <section
              className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}
            >
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
        <AppHead title="Gerenciar migrations" />
        <Layout>
          <main className={`${shared.container} ${shared.containerUltraWide}`}>
            <section
              className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}
            >
              <StatusMessage
                type="critical"
                name={error.statusCode ? error.name : undefined}
                action={error.action}
              >
                {error.statusCode
                  ? error.message
                  : "Não foi possível verificar suas permissões."}
              </StatusMessage>
            </section>
          </main>
        </Layout>
      </>
    );
  }

  if (!user || !hasAdminSectionAccess(user, "migrations")) return null;

  return (
    <>
      <AppHead
        title="Gerenciar migrations"
        description="Consulte e aplique as migrations pendentes do banco de dados."
      />
      <Layout>
        <main className={`${shared.container} ${shared.containerUltraWide}`}>
          <section
            className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}
          >
            <AdminBackButton />

            <header className={styles.header}>
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-database"></i>
              </div>
              <span className={shared.badge}>ADMINISTRAÇÃO</span>
              <h1>Gerenciar migrations</h1>
              <p>
                Consulte as alterações de banco de dados disponíveis no código
                e aplique as migrations pendentes no ambiente atual.
              </p>
            </header>

            <div className={styles.environment}>
              <span className={styles.environmentDot} aria-hidden="true"></span>
              <span>
                Ambiente da aplicação:{" "}
                <strong>
                  {{
                    development: "Desenvolvimento",
                    production: "Produção",
                    test: "Testes",
                  }[process.env.NODE_ENV] || "Desconhecido"}
                </strong>
              </span>
              <small>
                O ambiente é definido pela configuração de execução da
                aplicação e não identifica diretamente o banco de dados
                utilizado.
              </small>
            </div>

            <div className={styles.summary}>
              <div>
                <strong>{isLoadingMigrations ? "..." : hasLoadError ? "—" : pendingMigrations.length}</strong>
                <span>Migrations pendentes</span>
              </div>
              <div>
                <strong>{isLoadingMigrations ? "..." : hasLoadError ? "Indisponível" : pendingMigrations.length === 0 ? "Em dia" : "Ação necessária"}</strong>
                <span>Estado da base de dados</span>
              </div>
            </div>

            {feedback && (
              <StatusMessage
                type={feedback.type}
                name={feedback.name}
                action={feedback.action}
                resetKey={feedback}
              >
                {feedback.message}
              </StatusMessage>
            )}

            <div className={styles.actions}>
              <Button
                type="button"
                variant="outline"
                icon="fa-sync-alt"
                onClick={handleRefresh}
                disabled={isLoadingMigrations || isExecuting}
              >
                {isLoadingMigrations ? "Verificando..." : "Verificar pendências"}
              </Button>
              {canExecute && (
                <Button
                  type="button"
                  icon="fa-play"
                  onClick={() => setIsConfirmationOpen(true)}
                  disabled={
                    isLoadingMigrations ||
                    isExecuting ||
                    pendingMigrations.length === 0 ||
                    hasLoadError
                  }
                >
                  Executar migrations
                </Button>
              )}
            </div>

            <section className={styles.migrations}>
              <div className={styles.sectionHeading}>
                <h2>Migrations pendentes</h2>
                <span>{hasLoadError ? "Estado indisponível" : `${pendingMigrations.length} item(ns)`}</span>
              </div>

              {isLoadingMigrations ? (
                <p className={styles.empty}>Consultando o banco de dados...</p>
              ) : hasLoadError ? (
                <p className={styles.empty}>
                  Não foi possível consultar o estado das migrations.
                </p>
              ) : pendingMigrations.length === 0 ? (
                <p className={styles.empty}>
                  Nenhuma migration pendente. O banco está atualizado.
                </p>
              ) : (
                <ol className={styles.list}>
                  {pendingMigrations.map((migration) => (
                    <li key={migration.path}>
                      <div className={styles.migrationDetails}>
                        <strong>{migration.name}</strong>
                        <code>{migration.path}</code>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <p className={styles.warning}>
              A execução altera o banco de dados do ambiente conectado. Faça
              backup antes de aplicar alterações e não encerre a operação
              enquanto ela estiver em andamento.
            </p>
          </section>
        </main>
      </Layout>

      {isConfirmationOpen && (
        <Modal
          title="Confirmar execução das migrations"
          onClose={() => setIsConfirmationOpen(false)}
          closeOnBackdrop={!isExecuting}
          closeOnEscape={!isExecuting}
          showCloseButton={!isExecuting}
        >
          <div className={styles.confirmation}>
            <p>
              Você está prestes a aplicar{" "}
              <strong>{pendingMigrations.length} migration(s)</strong> no banco
              de dados do ambiente conectado.
            </p>
            <p>
              Essa operação pode alterar estruturas e dados. Certifique-se de
              que existe um backup recente antes de continuar.
            </p>
            <div className={styles.confirmationActions}>
              <Button
                type="button"
                onClick={handleExecute}
                disabled={isExecuting || pendingMigrations.length === 0}
              >
                {isExecuting ? "Executando..." : "Confirmar e executar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmationOpen(false)}
                disabled={isExecuting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default AdminMigrationsPage;
