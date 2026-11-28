import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AdminBackButton from "@/components/AdminBackButton";
import DataTable from "@/components/DataTable";
import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import TableSection from "@/components/TableSection";
import usePagination from "@/hooks/use-pagination.js";
import useRowSelection from "@/hooks/use-row-selection.js";
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
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

function PositionsPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [records, setRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const selection = useRowSelection();
  const clearSelection = selection.clear;
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [search, setSearch] = useState("");
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
      clearSelection();
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
  }, [clearSelection]);

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

  const sort = useSortableData(filteredRecords);
  const pagination = usePagination(sort.sortedRecords);

  function handleDeleteSelected() {
    if (!canDelete || !selection.selectedIds.length) return;

    setDeleteDialog({
      ids: selection.selectedIds,
      message:
        "Deseja excluir " +
        selection.selectedIds.length +
        " cargo(s) selecionado(s)? A exclusão será lógica.",
    });
  }

  async function deleteSelected() {
    setDeleteDialog(null);

    setIsDeleting(true);
    setFeedback(null);
    try {
      await requestAPI("/api/v1/admin/positions/bulk", {
        method: "DELETE",
        body: JSON.stringify({ ids: selection.selectedIds }),
      });
      await loadRecords();
      setFeedback({
        type: "success",
        message:
          selection.selectedIds.length + " cargo(s) excluído(s) com sucesso.",
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
                  type={
                    feedback.type === "success" ? "success" : "inline-error"
                  }
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
                    pagination.resetPage();
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

            <TableSection
              title="Cargos cadastrados"
              countLabel={filteredRecords.length + " cargo(s)"}
              actions={
                canDelete &&
                selection.selectedIds.length > 0 && (
                  <Button
                    type="button"
                    variant="danger"
                    icon="fa-trash"
                    onClick={handleDeleteSelected}
                    disabled={isDeleting}
                  >
                    {isDeleting
                      ? "Excluindo..."
                      : "Excluir selecionados (" +
                        selection.selectedIds.length +
                        ")"}
                  </Button>
                )
              }
            >
              <DataTable
                records={pagination.visibleRecords}
                loading={isLoadingRecords}
                loadingMessage="Carregando cargos..."
                emptyMessage="Nenhum cargo encontrado."
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
                sort={sort}
                pagination={pagination}
                caption="Cargos cadastrados"
                selection={canDelete ? selection : null}
                getSelectionLabel={(record) =>
                  "Selecionar cargo " + record.name
                }
                renderActions={(record) => (
                  <DataTable.RowAction
                    href={"/admin/positions/" + record.id}
                    editable={canUpdate}
                  />
                )}
              />
            </TableSection>
          </section>
        </main>
      </Layout>
      {deleteDialog && (
        <StatusMessage
          type="confirmation"
          resetKey={"delete-positions-" + deleteDialog.ids.join(",")}
          onConfirm={deleteSelected}
          onCancel={() => setDeleteDialog(null)}
        >
          {deleteDialog.message}
        </StatusMessage>
      )}
    </>
  );
}

export default PositionsPage;
