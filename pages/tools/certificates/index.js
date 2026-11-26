import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AdminBackButton from "@/components/AdminBackButton";
import AppHead from "@/components/AppHead";
import AdminDataTable from "@/components/AdminDataTable";
import useSortableData from "@/hooks/use-sortable-data.js";
import AdminPagination from "@/components/AdminPagination";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function CertificatesPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [records, setRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [feedback, setFeedback] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialog, setDialog] = useState(null);

  const canRead = user?.features?.includes("read:certificate");
  const canCreate = user?.features?.includes("create:certificate");
  const canUpdateOwn = user?.features?.includes("update:certificate");
  const canUpdateOthers = user?.features?.includes("update:certificate:others");
  const canDelete = user?.features?.includes("delete:certificate");

  const loadRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    try {
      setRecords(await requestAPI("/api/v1/certificates"));
      setSelectedIds([]);
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
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }
    if (!isLoading && user && !canRead) {
      router.replace("/tools");
    }
  }, [canRead, error, isLoading, router, user]);

  useEffect(() => {
    if (user && canRead) {
      Promise.resolve().then(loadRecords);
    }
  }, [canRead, loadRecords, user]);

  const availableYears = useMemo(
    () =>
      Array.from(new Set(records.map((record) => Number(record.year))))
        .filter(Number.isInteger)
        .sort((first, second) => second - first),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesYear =
        yearFilter === "all" || String(record.year) === yearFilter;
      const matchesSearch =
        !term ||
        [
          record.protocol_number,
          record.protocol_year,
          record.applicant_name,
          record.physical_property_id,
          record.physical_registration,
          record.owner_name,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(term),
        );
      return matchesYear && matchesSearch;
    });
  }, [records, search, yearFilter]);

  const { sortedRecords, sortState, handleSort, sortAnnouncement } = useSortableData(filteredRecords);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRecords = sortedRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const allVisibleSelected =
    visibleRecords.length > 0 &&
    visibleRecords.every((record) => selectedIds.includes(record.id));

  function toggleSelection(id) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function togglePageSelection(checked) {
    const visibleIds = visibleRecords.map((record) => record.id);
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, ...visibleIds]))
        : current.filter((id) => !visibleIds.includes(id)),
    );
  }

  function handleDelete(ids) {
    if (!ids.length || !canDelete) return;
    setDialog({
      ids,
      message:
        "Deseja excluir " +
        ids.length +
        " certidão(ões) selecionada(s)? A exclusão será lógica.",
    });
  }

  async function confirmDelete() {
    if (!dialog || !canDelete) return;
    const ids = dialog.ids;
    setDialog(null);
    setIsDeleting(true);
    setFeedback(null);
    try {
      if (ids.length === 1) {
        await requestAPI("/api/v1/certificates/" + encodeURIComponent(ids[0]), {
          method: "DELETE",
        });
      } else {
        await requestAPI("/api/v1/certificates/bulk", {
          method: "DELETE",
          body: JSON.stringify({ ids }),
        });
      }
      await loadRecords();
      setFeedback({
        type: "success",
        message: ids.length + " certidão(ões) excluída(s) com sucesso.",
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

  function handlePrint() {
    if (!selectedIds.length) return;
    setFeedback({
      type: "success",
      message:
        "A ação de impressão foi executada para " +
        selectedIds.length +
        " certidão(ões). A impressão ainda será implementada.",
    });
  }

  if (isLoading || (!user && !error)) {
    return (
      <>
        <AppHead title="Certidão de Valor Venal" />
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
        <AppHead title="Certidões" />
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

  if (!user || !canRead) return null;

  const columns = [
    { key: "protocol_number", label: "Protocolo" },
    { key: "protocol_year", label: "Ano protocolo" },
    { key: "applicant_name", label: "Requerente" },
    { key: "purpose", label: "Finalidade" },
    { key: "physical_property_id", label: "Código físico" },
    { key: "physical_registration", label: "Inscrição física" },
    { key: "year", label: "Exercício" },
    { key: "owner_name", label: "Proprietário" },
    { key: "promissory_buyer", label: "Compromissário" },
    { key: "owner_rg", label: "RG proprietário" },
    { key: "property_street", label: "Logradouro" },
    { key: "property_number", label: "Número" },
    { key: "property_neighborhood", label: "Bairro" },
    { key: "property_block", label: "Quadra" },
    { key: "property_lots", label: "Lote(s)" },
    { key: "property_complement", label: "Complemento" },
    {
      key: "land_area",
      label: "Área do terreno",
      render: (record) =>
        Number(record.land_area).toLocaleString("pt-BR") + " m²",
    },
    {
      key: "built_area",
      label: "Área construída",
      render: (record) =>
        Number(record.built_area).toLocaleString("pt-BR") + " m²",
    },
    ...["land_value", "building_value", "total_value"].map((key) => ({
      key,
      label:
        key === "land_value"
          ? "Valor venal do terreno"
          : key === "building_value"
            ? "Valor venal da edificação"
            : "Valor venal total",
      render: (record) =>
        Number(record[key]).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
    })),
    { key: "observations", label: "Observações" },
    {
      key: "validity_days",
      label: "Validade",
      render: (record) => record.validity_days + " dias",
    },
    {
      key: "created_at",
      label: "Emissão",
      render: (record) => formatDate(record.created_at),
    },
  ];

  return (
    <>
      <AppHead
        title="Certidão de Valor Venal"
        description="Consulte e emita certidões de valor venal."
      />
      <Layout>
        <main className={shared.container + " " + shared.containerUltraWide}>
          <section
            className={
              shared.card + " " + shared.cardUltraWide + " " + styles.card
            }
          >
            <AdminBackButton href="/tools" label="Voltar às ferramentas" />
            <header className={styles.header}>
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-file-alt"></i>
              </div>
              <h1>Certidão de Valor Venal</h1>
              <p>
                Consulte as certidões emitidas e faça novas emissões com cálculo
                automático dos valores venais.
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
                <span className={shared.label}>Pesquisar certidões</span>
                <input
                  className={shared.input}
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Protocolo, requerente, imóvel ou inscrição..."
                />
              </label>
              <label className={styles.yearField}>
                <span className={shared.label}>Exercício</span>
                <select
                  className={shared.input}
                  value={yearFilter}
                  onChange={(event) => {
                    setYearFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Todos</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              {canCreate && (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => router.push("/tools/certificates/new")}
                >
                  <i className="fas fa-plus" aria-hidden="true"></i>
                  Nova certidão
                </button>
              )}
            </div>
            <section className={styles.results}>
              <div className={styles.resultsHeading}>
                <div>
                  <h2>Certidões emitidas</h2>
                  <span>{filteredRecords.length} certidão(ões)</span>
                </div>
                <div className={styles.selectionActions}>
                  {canDelete && selectedIds.length > 0 && (
                    <Button
                      type="button"
                      variant="danger"
                      icon="fa-trash"
                      onClick={() => handleDelete(selectedIds)}
                      disabled={isDeleting}
                    >
                      {isDeleting
                        ? "Excluindo..."
                        : "Excluir selecionadas (" + selectedIds.length + ")"}
                    </Button>
                  )}
                  {selectedIds.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      icon="fa-print"
                      onClick={handlePrint}
                    >
                      Imprimir ({selectedIds.length})
                    </Button>
                  )}
                </div>
              </div>
              {isLoadingRecords ? (
                <p className={styles.empty}>Carregando certidões...</p>
              ) : filteredRecords.length === 0 ? (
                <p className={styles.empty}>Nenhuma certidão encontrada.</p>
              ) : (
                <>
                  <AdminDataTable
                    records={visibleRecords}
                    columns={columns}
                    sortState={sortState}
                    onSort={handleSort}
                    sortAnnouncement={sortAnnouncement}
                    caption="Certidões emitidas"
                    selectable
                    selectedIds={selectedIds}
                    allVisibleSelected={allVisibleSelected}
                    onToggleRecord={toggleSelection}
                    onTogglePage={togglePageSelection}
                    getSelectionLabel={(record) =>
                      "Selecionar certidão " +
                      (record.protocol_number
                        ? record.protocol_number + "/" + record.protocol_year
                        : record.id)
                    }
                    onRowClick={(record) =>
                      router.push(
                        "/tools/certificates/" +
                          encodeURIComponent(record.id) +
                          "?mode=view",
                      )
                    }
                    renderActions={(record, actionClassName) => {
                      const canEdit =
                        canUpdateOthers ||
                        (canUpdateOwn && record.user_id === user.id);
                      return (
                        <button
                          type="button"
                          className={actionClassName}
                          onClick={() =>
                            router.push(
                              "/tools/certificates/" +
                                encodeURIComponent(record.id) +
                                (canEdit ? "" : "?mode=view"),
                            )
                          }
                        >
                          <i
                            className={
                              "fas " + (canEdit ? "fa-edit" : "fa-eye")
                            }
                            aria-hidden="true"
                          ></i>{" "}
                          {canEdit ? "Editar" : "Visualizar"}
                        </button>
                      );
                    }}
                  />
                  <AdminPagination
                    page={page}
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
      {dialog && (
        <StatusMessage
          type="confirmation"
          resetKey={"delete-certificates-" + dialog.ids.join(",")}
          onConfirm={confirmDelete}
          onCancel={() => setDialog(null)}
        >
          {dialog.message}
        </StatusMessage>
      )}
    </>
  );
}

export default CertificatesPage;
