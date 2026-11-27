import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AdminBackButton from "@/components/AdminBackButton";
import AdminDataTable from "@/components/AdminDataTable";
import AdminPagination from "@/components/AdminPagination";
import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useSortableData from "@/hooks/use-sortable-data.js";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import {
  hasAdminAccess,
  hasAdminSectionAccess,
} from "@/models/authorization.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR");
}

function PositionsPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [records, setRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState(null);

  const canCreate = user?.features?.includes("create:position");
  const canUpdate = user?.features?.includes("update:position");
  const canDelete = user?.features?.includes("delete:position");

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }
    if (!isLoading && user && !hasAdminSectionAccess(user, "positions")) {
      router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
    }
  }, [error, isLoading, router, user]);

  const loadRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    try {
      const data = await requestAPI("/api/v1/admin/positions");
      setRecords(data);
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.name,
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    if (user && hasAdminSectionAccess(user, "positions")) {
      Promise.resolve().then(loadRecords);
    }
  }, [loadRecords, user]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return records;
    return records.filter((record) =>
      record.name.toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [records, search]);

  const { sortedRecords, sortState, handleSort, sortAnnouncement } =
    useSortableData(filteredRecords);
  const pageCount = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRecords = sortedRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  async function handleDelete(record) {
    if (
      !window.confirm(
        'Deseja excluir o cargo "' + record.name + '"? Esta ação é lógica.',
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setFeedback(null);
    try {
      await requestAPI(
        "/api/v1/admin/positions/" + encodeURIComponent(record.id),
        { method: "DELETE" },
      );
      await loadRecords();
      setFeedback({
        type: "success",
        message: "Cargo excluído com sucesso.",
      });
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.name,
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading || (!user && !error)) {
    return (
      <>
        <AppHead title="Cargos" />
        <Layout>
          <main className={shared.container}>
            <section className={shared.card}>
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
        <AppHead title="Cargos" />
        <Layout>
          <main className={shared.container}>
            <section className={shared.card}>
              <StatusMessage
                type="critical"
                name={error.name}
                action={error.action}
              >
                {error.message}
              </StatusMessage>
            </section>
          </main>
        </Layout>
      </>
    );
  }

  if (!user || !hasAdminSectionAccess(user, "positions")) return null;

  return (
    <>
      <AppHead
        title="Cargos"
        description="Gerencie os cargos disponíveis no sistema."
      />
      <Layout>
        <main className={shared.container + " " + shared.containerUltraWide}>
          <section
            className={
              shared.card + " " + shared.cardUltraWide + " " + styles.card
            }
          >
            <AdminBackButton />
            <header className={styles.header}>
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-id-badge"></i>
              </div>
              <span className={shared.badge}>ADMINISTRAÇÃO</span>
              <h1>Cargos</h1>
              <p>
                Consulte, cadastre, altere e exclua os cargos disponíveis para
                identificação funcional dos usuários.
              </p>
            </header>

            {feedback && (
              <div className={styles.feedback}>
                <StatusMessage
                  type={feedback.type === "success" ? "success" : "inline-error"}
                  name={feedback.name}
                  action={feedback.action}
                >
                  {feedback.message}
                </StatusMessage>
              </div>
            )}

            <div className={styles.toolbar}>
              <label className={styles.searchField}>
                <span className={shared.label}>Pesquisar cargo</span>
                <input
                  className={shared.input}
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Digite o nome do cargo"
                />
              </label>
              {canCreate && (
                <Link href="/admin/positions/new" className={styles.linkButton}>
                  <i className="fas fa-plus" aria-hidden="true"></i>
                  Novo cargo
                </Link>
              )}
            </div>

            <section className={styles.results}>
              <div className={styles.resultsHeading}>
                <div>
                  <h2>Cargos cadastrados</h2>
                  <span>{filteredRecords.length} cargo(s)</span>
                </div>
              </div>

              {isLoadingRecords ? (
                <p className={styles.empty}>Carregando cargos...</p>
              ) : filteredRecords.length === 0 ? (
                <p className={styles.empty}>Nenhum cargo encontrado.</p>
              ) : (
                <>
                  <AdminDataTable
                    records={visibleRecords}
                    columns={[
                      {
                        key: "name",
                        label: "Cargo",
                        render: (record) => <strong>{record.name}</strong>,
                      },
                      {
                        key: "updated_at",
                        label: "Última atualização",
                        render: (record) => formatDate(record.updated_at),
                      },
                    ]}
                    sortState={sortState}
                    onSort={handleSort}
                    sortAnnouncement={sortAnnouncement}
                    caption="Cargos cadastrados"
                    renderActions={(record, actionClassName) => (
                      <div className={styles.actions}>
                        <Link
                          className={actionClassName}
                          href={"/admin/positions/" + record.id}
                        >
                          <i
                            className={
                              "fas " + (canUpdate ? "fa-edit" : "fa-eye")
                            }
                            aria-hidden="true"
                          ></i>
                          {canUpdate ? "Editar" : "Visualizar"}
                        </Link>
                        {canDelete && (
                          <Button
                            type="button"
                            variant="danger"
                            size="small"
                            disabled={isDeleting}
                            onClick={() => handleDelete(record)}
                          >
                            <i className="fas fa-trash" aria-hidden="true"></i>
                            Excluir
                          </Button>
                        )}
                      </div>
                    )}
                  />
                  <AdminPagination
                    setPage={setPage}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    pageCount={pageCount}
                    currentPage={currentPage}
                  />
                </>
              )}
            </section>
          </section>
        </main>
      </Layout>
    </>
  );
}

export default PositionsPage;
